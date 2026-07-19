import { SessionRepository } from '@iegoto/db'
import { MemberRepository } from '@iegoto/db'
import type { FamilyContext } from '../../../trpc.js'

/** S-3 退出: 自分のプロフィールからログイン紐づけを外す (プロフィール・予定は残る)。全セッションも破棄 */
export async function leaveFamily(ctx: FamilyContext): Promise<void> {
  await ctx.db.$transaction(async (tx) => {
    await new MemberRepository(tx).unlinkUserAccount(ctx.familyId, ctx.memberId)
    await new SessionRepository(tx).deleteAllForUser(ctx.userAccountId)
  })
}
