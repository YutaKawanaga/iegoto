import { EventRepository } from '@iegoto/db'
import {
  buildCancelOverride,
  computeRecurrenceEndAt,
  type EditScope,
  nextReminderAt,
  toId,
  truncateRRuleBefore,
  utcToWall,
} from '@iegoto/domain'
import { TRPCError } from '@trpc/server'
import type { FamilyContext } from '../../../trpc.js'

export type DeleteEventInput = {
  eventId: string
  scope: EditScope
  originalStartAt?: Date
}

/** F-03 予定削除 (スコープ3択)。'this' はキャンセル override、'following' は UNTIL 切詰め、'all' は論理削除 */
export async function deleteEvent(ctx: FamilyContext, input: DeleteEventInput): Promise<void> {
  const repo0 = new EventRepository(ctx.db)
  const found = await repo0.find(ctx.familyId, toId<'Event'>(input.eventId))
  if (found === null) {
    throw new TRPCError({ code: 'NOT_FOUND', message: '予定が見つかりません' })
  }
  const { event, overrides } = found
  const now = new Date()

  if (event.rrule === null || input.scope === 'all') {
    await ctx.db.$transaction(async (tx) => {
      await new EventRepository(tx).softDelete(ctx.familyId, event.id)
    })
    return
  }

  if (input.originalStartAt === undefined) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: '対象回の指定が必要です' })
  }
  const originalStartAt = input.originalStartAt

  if (input.scope === 'this') {
    const existing = overrides.find(
      (o) => o.originalStartAt.getTime() === originalStartAt.getTime(),
    )
    const cancel = buildCancelOverride(event, originalStartAt, existing)
    const newOverrides = [...overrides.filter((o) => o.id !== cancel.id), cancel]
    const reminder = nextReminderAt(event, newOverrides, now)
    await ctx.db.$transaction(async (tx) => {
      const repo = new EventRepository(tx)
      await repo.upsertOverride(ctx.familyId, cancel)
      await repo.updateNextReminderAt(event.id, reminder)
    })
    return
  }

  // scope === 'following': UNTIL を対象回の直前に設定 (新マスタは作らない)
  const splitWall =
    event.time.kind === 'timed' ? utcToWall(originalStartAt, event.time.timezone) : originalStartAt
  const truncated = truncateRRuleBefore(event.rrule, splitWall)
  const updated = {
    ...event,
    rrule: truncated,
    recurrenceEndAt: computeRecurrenceEndAt(truncated, event.time),
  }
  const remaining = overrides.filter((o) => o.originalStartAt.getTime() < originalStartAt.getTime())
  const dropped = overrides.filter((o) => o.originalStartAt.getTime() >= originalStartAt.getTime())
  await ctx.db.$transaction(async (tx) => {
    const repo = new EventRepository(tx)
    await repo.save(ctx.familyId, updated, nextReminderAt(updated, remaining, now))
    await repo.deleteOverrides(
      ctx.familyId,
      dropped.map((o) => o.id),
    )
  })
}
