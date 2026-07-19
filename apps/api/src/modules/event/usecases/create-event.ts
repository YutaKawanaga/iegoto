import { type EventTime, createEvent as createEventEntity, nextReminderAt, toId } from '@iegoto/domain'
import { EventRepository, MemberRepository } from '@iegoto/db'
import { TRPCError } from '@trpc/server'
import type { FamilyContext } from '../../../trpc.js'

export type CreateEventInput = {
  title: string
  memo?: string | null
  location?: string | null
  time: EventTime
  rrule?: string | null
  targetMemberIds: string[]
  assigneeMemberId?: string | null
  reminderMinutesBefore?: number | null
}

export async function createEvent(
  ctx: FamilyContext,
  input: CreateEventInput,
): Promise<{ eventId: string }> {
  await assertMembersBelongToFamily(ctx, [
    ...input.targetMemberIds,
    ...(input.assigneeMemberId != null ? [input.assigneeMemberId] : []),
  ])
  const event = createEventEntity({
    familyId: ctx.familyId,
    title: input.title,
    memo: input.memo ?? null,
    location: input.location ?? null,
    time: input.time,
    rrule: input.rrule ?? null,
    targetMemberIds: input.targetMemberIds.map((id) => toId<'Member'>(id)),
    assigneeMemberId: input.assigneeMemberId == null ? null : toId<'Member'>(input.assigneeMemberId),
    reminderMinutesBefore: input.reminderMinutesBefore ?? null,
    createdByMemberId: ctx.memberId,
  })
  const reminder = nextReminderAt(event, [], new Date())
  await ctx.db.$transaction(async (tx) => {
    await new EventRepository(tx).save(ctx.familyId, event, reminder)
  })
  return { eventId: event.id }
}

/** 対象・担当に他家族のメンバー ID を混ぜられないことの防御 (二層防御の補強) */
export async function assertMembersBelongToFamily(
  ctx: FamilyContext,
  memberIds: string[],
): Promise<void> {
  if (memberIds.length === 0) {
    return
  }
  const members = await new MemberRepository(ctx.db).list(ctx.familyId, { includeDeleted: true })
  const known = new Set<string>(members.map((m) => m.id))
  if (memberIds.some((id) => !known.has(id))) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'メンバーが不正です' })
  }
}
