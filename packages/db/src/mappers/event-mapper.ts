import type {
  Event as DomainEvent,
  EventOverride as DomainOverride,
  EventTime,
  OverridePatch,
} from '@iegoto/domain'
import { toId } from '@iegoto/domain'
import type { Event as EventRow, EventOverride as OverrideRow, EventTarget } from '../generated/client/index.js'

type EventRowWithRelations = EventRow & { targets: EventTarget[]; overrides: OverrideRow[] }

export function eventTimeFromRow(row: EventRow): EventTime {
  if (row.isAllDay) {
    if (row.startDate === null || row.endDate === null) {
      throw new Error(`event ${row.id}: 終日予定に start_date/end_date がありません`)
    }
    return { kind: 'allDay', startDate: row.startDate, endDate: row.endDate }
  }
  if (row.startAt === null || row.endAt === null) {
    throw new Error(`event ${row.id}: 時間指定予定に start_at/end_at がありません`)
  }
  return { kind: 'timed', startAt: row.startAt, endAt: row.endAt, timezone: row.timezone }
}

export function eventFromRow(row: EventRowWithRelations): {
  event: DomainEvent
  overrides: DomainOverride[]
} {
  const event: DomainEvent = {
    id: toId<'Event'>(row.id),
    familyId: toId<'Family'>(row.familyId),
    title: row.title,
    memo: row.memo,
    location: row.location,
    time: eventTimeFromRow(row),
    rrule: row.rrule,
    recurrenceEndAt: row.recurrenceEndAt,
    targetMemberIds: row.targets.map((t) => toId<'Member'>(t.memberId)),
    assigneeMemberId: row.assigneeMemberId === null ? null : toId<'Member'>(row.assigneeMemberId),
    reminderMinutesBefore: row.reminderMinutesBefore,
    createdByMemberId: toId<'Member'>(row.createdByMemberId),
  }
  return { event, overrides: row.overrides.map(overrideFromRow) }
}

export function overrideFromRow(row: OverrideRow): DomainOverride {
  return {
    id: toId<'EventOverride'>(row.id),
    eventId: toId<'Event'>(row.eventId),
    originalStartAt: row.originalStartAt,
    isCancelled: row.isCancelled,
    patch: patchFromJson(row.patch),
  }
}

/** OverridePatch の JSONB シリアライズ。Date は ISO 文字列に落とす */
type PatchJson = {
  title?: string
  memo?: string | null
  location?: string | null
  time?:
    | { kind: 'timed'; startAt: string; endAt: string; timezone: string }
    | { kind: 'allDay'; startDate: string; endDate: string }
  targetMemberIds?: string[]
  assigneeMemberId?: string | null
}

export function patchToJson(patch: OverridePatch): PatchJson {
  const json: PatchJson = {}
  if (patch.title !== undefined) json.title = patch.title
  if (patch.memo !== undefined) json.memo = patch.memo
  if (patch.location !== undefined) json.location = patch.location
  if (patch.time !== undefined) {
    json.time =
      patch.time.kind === 'timed'
        ? {
            kind: 'timed',
            startAt: patch.time.startAt.toISOString(),
            endAt: patch.time.endAt.toISOString(),
            timezone: patch.time.timezone,
          }
        : patch.time
  }
  if (patch.targetMemberIds !== undefined) json.targetMemberIds = patch.targetMemberIds
  if (patch.assigneeMemberId !== undefined) json.assigneeMemberId = patch.assigneeMemberId
  return json
}

export function patchFromJson(value: unknown): OverridePatch {
  const json = value as PatchJson
  const patch: OverridePatch = {}
  if (json.title !== undefined) patch.title = json.title
  if (json.memo !== undefined) patch.memo = json.memo
  if (json.location !== undefined) patch.location = json.location
  if (json.time !== undefined) {
    patch.time =
      json.time.kind === 'timed'
        ? {
            kind: 'timed',
            startAt: new Date(json.time.startAt),
            endAt: new Date(json.time.endAt),
            timezone: json.time.timezone,
          }
        : json.time
  }
  if (json.targetMemberIds !== undefined) {
    patch.targetMemberIds = json.targetMemberIds.map((id) => toId<'Member'>(id))
  }
  if (json.assigneeMemberId !== undefined) {
    patch.assigneeMemberId =
      json.assigneeMemberId === null ? null : toId<'Member'>(json.assigneeMemberId)
  }
  return patch
}

export function eventToRow(event: DomainEvent, normalizedTitle: string) {
  const timed = event.time.kind === 'timed'
  return {
    title: event.title,
    normalizedTitle,
    memo: event.memo,
    location: event.location,
    isAllDay: !timed,
    startAt: timed && event.time.kind === 'timed' ? event.time.startAt : null,
    endAt: event.time.kind === 'timed' ? event.time.endAt : null,
    startDate: event.time.kind === 'allDay' ? event.time.startDate : null,
    endDate: event.time.kind === 'allDay' ? event.time.endDate : null,
    timezone: event.time.kind === 'timed' ? event.time.timezone : 'Asia/Tokyo',
    rrule: event.rrule,
    recurrenceEndAt: event.recurrenceEndAt,
    assigneeMemberId: event.assigneeMemberId,
    reminderMinutesBefore: event.reminderMinutesBefore,
    createdByMemberId: event.createdByMemberId,
  }
}
