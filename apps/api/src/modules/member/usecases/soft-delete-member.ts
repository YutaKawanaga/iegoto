import { EventRepository, MemberRepository } from '@iegoto/db'
import { toId } from '@iegoto/domain'
import { TRPCError } from '@trpc/server'
import type { FamilyContext } from '../../../trpc.js'

/**
 * S-3: プロフィール削除 (論理削除)。1トランザクションで
 * ①論理削除 ②未来の担当予定を「担当者未定」へ ③未来の予定の対象から外す
 */
export async function softDeleteMember(
  ctx: FamilyContext,
  input: { memberId: string },
): Promise<void> {
  const memberId = toId<'Member'>(input.memberId)
  if (memberId === ctx.memberId) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: '自分自身は削除できません (退出は設定から)',
    })
  }
  const now = new Date()
  await ctx.db.$transaction(async (tx) => {
    await new MemberRepository(tx).softDelete(ctx.familyId, memberId)
    const events = new EventRepository(tx)
    await events.unassignFutureEvents(ctx.familyId, memberId, now)
    await events.removeMemberFromFutureTargets(ctx.familyId, memberId, now)
  })
}
