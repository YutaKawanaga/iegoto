import { InvalidRecurrenceRuleError } from '../shared/errors.js'
import { type EventOverrideId, newId } from '../shared/id.js'
import { utcToWall } from '../shared/tz.js'
import { type Event, type EventTime, validateEventTime } from './event.js'
import type { EventOverride, OverridePatch } from './override.js'
import { computeRecurrenceEndAt, truncateRRuleBefore } from './recurrence-rule.js'

/** F-03 繰り返し予定の編集スコープ3択 */
export type EditScope = 'this' | 'following' | 'all'

export type EventChanges = {
  title?: string
  memo?: string | null
  location?: string | null
  time?: EventTime
  rrule?: string | null
  targetMemberIds?: Event['targetMemberIds']
  assigneeMemberId?: Event['assigneeMemberId']
  reminderMinutesBefore?: number | null
}

/** 「この予定のみ」編集 → event_override の UPSERT 内容を作る */
export function buildThisOnlyOverride(
  event: Event,
  originalStartAt: Date,
  changes: EventChanges,
  existing: EventOverride | undefined,
): EventOverride {
  if (changes.time !== undefined) {
    validateEventTime(changes.time)
  }
  const patch: OverridePatch = { ...existing?.patch }
  if (changes.title !== undefined) patch.title = changes.title
  if (changes.memo !== undefined) patch.memo = changes.memo
  if (changes.location !== undefined) patch.location = changes.location
  if (changes.time !== undefined) patch.time = changes.time
  if (changes.targetMemberIds !== undefined) patch.targetMemberIds = changes.targetMemberIds
  if (changes.assigneeMemberId !== undefined) patch.assigneeMemberId = changes.assigneeMemberId
  return {
    id: existing?.id ?? newId<'EventOverride'>(),
    eventId: event.id,
    originalStartAt,
    isCancelled: false,
    patch,
  }
}

/** この回のみ削除 → キャンセル override */
export function buildCancelOverride(
  event: Event,
  originalStartAt: Date,
  existing: EventOverride | undefined,
): EventOverride {
  return {
    id: existing?.id ?? newId<'EventOverride'>(),
    eventId: event.id,
    originalStartAt,
    isCancelled: true,
    patch: {},
  }
}

/** 「すべて」編集 → マスタを直接更新 (例外は保持。03 §3) */
export function applyAllEdit(event: Event, changes: EventChanges): Event {
  const updated: Event = {
    ...event,
    title: changes.title !== undefined ? changes.title.trim() : event.title,
    memo: changes.memo !== undefined ? changes.memo : event.memo,
    location: changes.location !== undefined ? changes.location : event.location,
    time: changes.time ?? event.time,
    rrule: changes.rrule !== undefined ? changes.rrule : event.rrule,
    targetMemberIds: changes.targetMemberIds ?? event.targetMemberIds,
    assigneeMemberId:
      changes.assigneeMemberId !== undefined ? changes.assigneeMemberId : event.assigneeMemberId,
    reminderMinutesBefore:
      changes.reminderMinutesBefore !== undefined
        ? changes.reminderMinutesBefore
        : event.reminderMinutesBefore,
  }
  validateEventTime(updated.time)
  updated.recurrenceEndAt =
    updated.rrule === null ? null : computeRecurrenceEndAt(updated.rrule, updated.time)
  return updated
}

export type SplitResult = {
  /** UNTIL を設定した旧マスタ */
  updatedOldMaster: Event
  /** 対象回以降を引き継ぐ新マスタ (新 ID 採番済み) */
  newMaster: Event
  /** 新期間に属し新マスタへ付け替える例外 (eventId は差し替え済み) */
  movedOverrides: EventOverride[]
  /** 破棄する例外 (時刻・繰り返しが変わり新マスタの回に一致しなくなるもの) */
  droppedOverrideIds: EventOverrideId[]
}

/**
 * 「これ以降すべて」編集 → マスタ分割 (03 §3)。
 * 旧マスタの RRULE に UNTIL=対象回の直前 を設定し、対象回以降を新マスタとして作る。
 * 例外のうち新期間に属するものは、開始時刻と RRULE が変わらない場合のみ新マスタへ付け替える
 * (変わる場合は回の格子が一致しなくなるため破棄)
 */
export function splitEventAtOccurrence(
  event: Event,
  overrides: EventOverride[],
  originalStartAt: Date,
  occurrenceTime: EventTime,
  changes: EventChanges,
): SplitResult {
  if (event.rrule === null) {
    throw new InvalidRecurrenceRuleError('単発予定は分割できません')
  }

  const splitWall =
    event.time.kind === 'timed'
      ? utcToWall(originalStartAt, event.time.timezone)
      : originalStartAt
  const truncatedRRule = truncateRRuleBefore(event.rrule, splitWall)
  const updatedOldMaster: Event = {
    ...event,
    rrule: truncatedRRule,
    recurrenceEndAt: computeRecurrenceEndAt(truncatedRRule, event.time),
  }

  // 新マスタ: 対象回の時間を起点に、変更を適用
  const baseTime = changes.time ?? occurrenceTime
  validateEventTime(baseTime)
  const newRRule = changes.rrule !== undefined ? changes.rrule : event.rrule
  const newMaster: Event = {
    ...event,
    id: newId<'Event'>(),
    title: changes.title !== undefined ? changes.title.trim() : event.title,
    memo: changes.memo !== undefined ? changes.memo : event.memo,
    location: changes.location !== undefined ? changes.location : event.location,
    time: baseTime,
    rrule: newRRule,
    recurrenceEndAt: newRRule === null ? null : computeRecurrenceEndAt(newRRule, baseTime),
    targetMemberIds: changes.targetMemberIds ?? event.targetMemberIds,
    assigneeMemberId:
      changes.assigneeMemberId !== undefined ? changes.assigneeMemberId : event.assigneeMemberId,
    reminderMinutesBefore:
      changes.reminderMinutesBefore !== undefined
        ? changes.reminderMinutesBefore
        : event.reminderMinutesBefore,
  }

  const futureOverrides = overrides.filter(
    (o) => o.originalStartAt.getTime() >= originalStartAt.getTime(),
  )
  const gridUnchanged = changes.time === undefined && changes.rrule === undefined
  return {
    updatedOldMaster,
    newMaster,
    movedOverrides: gridUnchanged
      ? futureOverrides.map((o) => ({ ...o, eventId: newMaster.id }))
      : [],
    droppedOverrideIds: gridUnchanged ? [] : futureOverrides.map((o) => o.id),
  }
}
