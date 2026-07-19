import { EventRepository } from '@iegoto/db'
import {
  applyAllEdit,
  buildThisOnlyOverride,
  type EditScope,
  type EventChanges,
  type EventTime,
  nextReminderAt,
  splitEventAtOccurrence,
  toId,
} from '@iegoto/domain'
import { TRPCError } from '@trpc/server'
import type { FamilyContext } from '../../../trpc.js'
import { assertMembersBelongToFamily } from './create-event.js'

export type UpdateEventInput = {
  eventId: string
  scope: EditScope
  /** 繰り返しの this/following 編集で対象回を特定するキー */
  originalStartAt?: Date
  /** this/following で対象回の現在の時間 (override 適用前の展開結果) */
  occurrenceTime?: EventTime
  changes: {
    title?: string
    memo?: string | null
    location?: string | null
    time?: EventTime
    rrule?: string | null
    targetMemberIds?: string[]
    assigneeMemberId?: string | null
    reminderMinutesBefore?: number | null
  }
}

/** F-03 予定編集 (編集スコープ3択)。トランザクション境界は UseCase (07 §3) */
export async function updateEvent(ctx: FamilyContext, input: UpdateEventInput): Promise<void> {
  const found = await new EventRepository(ctx.db).find(ctx.familyId, toId<'Event'>(input.eventId))
  if (found === null) {
    throw new TRPCError({ code: 'NOT_FOUND', message: '予定が見つかりません' })
  }
  const { event, overrides } = found
  await assertMembersBelongToFamily(ctx, [
    ...(input.changes.targetMemberIds ?? []),
    ...(input.changes.assigneeMemberId != null ? [input.changes.assigneeMemberId] : []),
  ])
  const changes: EventChanges = {
    ...input.changes,
    targetMemberIds: input.changes.targetMemberIds?.map((id) => toId<'Member'>(id)),
    assigneeMemberId:
      input.changes.assigneeMemberId === undefined
        ? undefined
        : input.changes.assigneeMemberId === null
          ? null
          : toId<'Member'>(input.changes.assigneeMemberId),
  }
  const now = new Date()

  // 単発予定は scope に関わらずマスタ直接更新
  if (event.rrule === null || input.scope === 'all') {
    const updated = applyAllEdit(event, changes)
    const reminder = nextReminderAt(updated, overrides, now)
    await ctx.db.$transaction(async (tx) => {
      await new EventRepository(tx).save(ctx.familyId, updated, reminder)
    })
    return
  }

  if (input.originalStartAt === undefined || input.occurrenceTime === undefined) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: '対象回の指定が必要です' })
  }

  if (input.scope === 'this') {
    const existing = overrides.find(
      (o) => o.originalStartAt.getTime() === input.originalStartAt?.getTime(),
    )
    const override = buildThisOnlyOverride(event, input.originalStartAt, changes, existing)
    const newOverrides = [...overrides.filter((o) => o.id !== override.id), override]
    const reminder = nextReminderAt(event, newOverrides, now)
    await ctx.db.$transaction(async (tx) => {
      const repo = new EventRepository(tx)
      await repo.upsertOverride(ctx.familyId, override)
      await repo.updateNextReminderAt(event.id, reminder)
    })
    return
  }

  // scope === 'following': マスタ分割 (03 §3)
  const result = splitEventAtOccurrence(
    event,
    overrides,
    input.originalStartAt,
    input.occurrenceTime,
    changes,
  )
  await ctx.db.$transaction(async (tx) => {
    const repo = new EventRepository(tx)
    const oldOverrides = overrides.filter(
      (o) =>
        !result.droppedOverrideIds.includes(o.id) &&
        !result.movedOverrides.some((m) => m.id === o.id),
    )
    await repo.save(
      ctx.familyId,
      result.updatedOldMaster,
      nextReminderAt(result.updatedOldMaster, oldOverrides, now),
    )
    await repo.save(
      ctx.familyId,
      result.newMaster,
      nextReminderAt(result.newMaster, result.movedOverrides, now),
    )
    await repo.deleteOverrides(ctx.familyId, result.droppedOverrideIds)
    await repo.moveOverrides(ctx.familyId, result.movedOverrides)
  })
}
