import { InvalidEventTimeError } from '../shared/errors.js'
import { type EventId, type FamilyId, type MemberId, newId } from '../shared/id.js'
import { dateStringToUtcMidnight } from '../shared/tz.js'
import { computeRecurrenceEndAt, parseRRuleBody } from './recurrence-rule.js'

/** 予定の時間表現。終日予定は date 型で TZ 非依存 (S-4) */
export type EventTime =
  | { kind: 'timed'; startAt: Date; endAt: Date; timezone: string }
  | { kind: 'allDay'; startDate: string; endDate: string }

/** 繰り返しマスタを含む予定エンティティ (03-domain-model.md §2) */
export type Event = {
  id: EventId
  familyId: FamilyId
  title: string
  memo: string | null
  location: string | null
  time: EventTime
  /** RRULE 本文 (例 'FREQ=WEEKLY;BYDAY=MO')。null = 単発 */
  rrule: string | null
  /** RRULE の UNTIL/COUNT から事前計算した実終端 (期間クエリ最適化用)。無期限は null */
  recurrenceEndAt: Date | null
  /** 対象メンバー = 誰の予定か (複数可、F-03) */
  targetMemberIds: MemberId[]
  /** 担当者 = 誰が対応するか。null = 担当者未定 (F-04) */
  assigneeMemberId: MemberId | null
  reminderMinutesBefore: number | null
  createdByMemberId: MemberId
}

export type CreateEventInput = {
  familyId: FamilyId
  title: string
  memo?: string | null
  location?: string | null
  time: EventTime
  rrule?: string | null
  targetMemberIds: MemberId[]
  assigneeMemberId?: MemberId | null
  reminderMinutesBefore?: number | null
  createdByMemberId: MemberId
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export function validateEventTime(time: EventTime): void {
  if (time.kind === 'timed') {
    if (time.endAt.getTime() <= time.startAt.getTime()) {
      throw new InvalidEventTimeError('終了時刻は開始時刻より後にしてください')
    }
  } else {
    if (!DATE_RE.test(time.startDate) || !DATE_RE.test(time.endDate)) {
      throw new InvalidEventTimeError('日付の形式が不正です')
    }
    if (time.endDate < time.startDate) {
      throw new InvalidEventTimeError('終了日は開始日以降にしてください')
    }
  }
}

/** 予定のファクトリ。業務ルールの検証と ID 生成はここで行う (呼び出し側から ID を渡さない) */
export function createEvent(input: CreateEventInput): Event {
  validateEventTime(input.time)
  const rrule = input.rrule ?? null
  if (rrule !== null) {
    parseRRuleBody(rrule)
  }
  const title = input.title.trim()
  if (title.length === 0 || title.length > 200) {
    throw new InvalidEventTimeError('タイトルは1〜200文字で入力してください')
  }
  return {
    id: newId<'Event'>(),
    familyId: input.familyId,
    title,
    memo: input.memo ?? null,
    location: input.location ?? null,
    time: input.time,
    rrule,
    recurrenceEndAt: rrule === null ? null : computeRecurrenceEndAt(rrule, input.time),
    targetMemberIds: [...new Set(input.targetMemberIds)],
    assigneeMemberId: input.assigneeMemberId ?? null,
    reminderMinutesBefore: input.reminderMinutesBefore ?? null,
    createdByMemberId: input.createdByMemberId,
  }
}

/** マスタの開始時刻 (展開の起点)。終日予定は UTC 深夜0時で表現する */
export function eventStartInstant(event: Pick<Event, 'time'>): Date {
  return event.time.kind === 'timed'
    ? event.time.startAt
    : dateStringToUtcMidnight(event.time.startDate)
}

/** 予定の所要時間 (ms)。終日予定は日数 × 24h (展開時の期間維持に使う) */
export function eventDurationMs(event: Pick<Event, 'time'>): number {
  if (event.time.kind === 'timed') {
    return event.time.endAt.getTime() - event.time.startAt.getTime()
  }
  const start = dateStringToUtcMidnight(event.time.startDate).getTime()
  const end = dateStringToUtcMidnight(event.time.endDate).getTime()
  return end - start + 24 * 60 * 60 * 1000
}
