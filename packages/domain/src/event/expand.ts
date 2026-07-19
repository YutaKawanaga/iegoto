import { utcMidnightToDateString, utcToWall, wallToUtc } from '../shared/tz.js'
import { type Event, type EventTime, eventDurationMs, eventStartInstant } from './event.js'
import type { EventOverride } from './override.js'
import { MAX_OCCURRENCES, buildRule } from './recurrence-rule.js'

/** カレンダー表示用に展開された1回分の予定 (03-domain-model.md §3) */
export type Occurrence = {
  eventId: Event['id']
  /** override との突き合わせキー。単発予定は開始時刻そのもの */
  originalStartAt: Date
  title: string
  memo: string | null
  location: string | null
  time: EventTime
  targetMemberIds: Event['targetMemberIds']
  assigneeMemberId: Event['assigneeMemberId']
  reminderMinutesBefore: number | null
  isRecurring: boolean
  isModified: boolean
}

export type TimeRange = { start: Date; end: Date }

/** 期間が重なるか (開始・終了を含む) */
function overlaps(start: Date, end: Date, range: TimeRange): boolean {
  return start.getTime() < range.end.getTime() && end.getTime() > range.start.getTime()
}

function occurrenceEnd(time: EventTime): Date {
  if (time.kind === 'timed') {
    return time.endAt
  }
  return new Date(
    new Date(`${time.endDate}T00:00:00Z`).getTime() + 24 * 60 * 60 * 1000,
  )
}

function baseOccurrence(event: Event, originalStartAt: Date, time: EventTime): Occurrence {
  return {
    eventId: event.id,
    originalStartAt,
    title: event.title,
    memo: event.memo,
    location: event.location,
    time,
    targetMemberIds: event.targetMemberIds,
    assigneeMemberId: event.assigneeMemberId,
    reminderMinutesBefore: event.reminderMinutesBefore,
    isRecurring: event.rrule !== null,
    isModified: false,
  }
}

function applyOverride(occ: Occurrence, override: EventOverride): Occurrence {
  const p = override.patch
  return {
    ...occ,
    title: p.title ?? occ.title,
    memo: p.memo !== undefined ? p.memo : occ.memo,
    location: p.location !== undefined ? p.location : occ.location,
    time: p.time ?? occ.time,
    targetMemberIds: p.targetMemberIds ?? occ.targetMemberIds,
    assigneeMemberId: p.assigneeMemberId !== undefined ? p.assigneeMemberId : occ.assigneeMemberId,
    isModified: true,
  }
}

/**
 * 予定を期間内の Occurrence 列に展開する。
 * - 単発: 期間に重なれば1件
 * - 繰り返し: RRULE をイベント TZ の壁時計で展開 → UTC へ変換 → override 適用
 *   (削除回は除去・上書き回は差し替え)
 * 展開結果は DB に保存しない (表示時展開。Google 方式)
 */
export function expandEvent(
  event: Event,
  overrides: EventOverride[],
  range: TimeRange,
): Occurrence[] {
  if (event.rrule === null) {
    const start = eventStartInstant(event)
    const end = occurrenceEnd(event.time)
    if (!overlaps(start, end, range)) {
      return []
    }
    return [baseOccurrence(event, start, event.time)]
  }

  const durationMs = eventDurationMs(event)
  const overrideByKey = new Map(overrides.map((o) => [o.originalStartAt.getTime(), o]))
  const rule = buildRule(event.rrule, event.time)

  // 期間より duration ぶん手前から展開し「期間開始前に始まり期間に食い込む回」を拾う
  const isTimed = event.time.kind === 'timed'
  const tz = event.time.kind === 'timed' ? event.time.timezone : 'UTC'
  const searchStart = new Date(range.start.getTime() - durationMs)
  const wallStart = isTimed ? utcToWall(searchStart, tz) : searchStart
  const wallEnd = isTimed ? utcToWall(range.end, tz) : range.end

  const wallDates = rule.between(wallStart, wallEnd, true).slice(0, MAX_OCCURRENCES)

  const result: Occurrence[] = []
  for (const wall of wallDates) {
    const startUtc = isTimed ? wallToUtc(wall, tz) : wall
    const endUtc = new Date(startUtc.getTime() + durationMs)
    const time: EventTime = isTimed
      ? { kind: 'timed', startAt: startUtc, endAt: endUtc, timezone: tz }
      : {
          kind: 'allDay',
          startDate: utcMidnightToDateString(startUtc),
          endDate: utcMidnightToDateString(new Date(endUtc.getTime() - 24 * 60 * 60 * 1000)),
        }

    const override = overrideByKey.get(startUtc.getTime())
    if (override?.isCancelled) {
      continue
    }
    let occ = baseOccurrence(event, startUtc, time)
    if (override !== undefined) {
      occ = applyOverride(occ, override)
    }
    const effectiveStart =
      occ.time.kind === 'timed' ? occ.time.startAt : new Date(`${occ.time.startDate}T00:00:00Z`)
    if (overlaps(effectiveStart, occurrenceEnd(occ.time), range)) {
      result.push(occ)
    }
  }
  return result
}

/** 複数イベントをまとめて展開し開始時刻順に返す (listEventsInRange の中核) */
export function expandEvents(
  events: { event: Event; overrides: EventOverride[] }[],
  range: TimeRange,
): Occurrence[] {
  return events
    .flatMap(({ event, overrides }) => expandEvent(event, overrides, range))
    .sort((a, b) => startInstantOf(a).getTime() - startInstantOf(b).getTime())
}

export function startInstantOf(occ: Occurrence): Date {
  return occ.time.kind === 'timed' ? occ.time.startAt : new Date(`${occ.time.startDate}T00:00:00Z`)
}
