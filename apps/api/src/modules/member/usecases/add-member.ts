import { MEMBER_COLORS, type MemberColor, createMember } from '@iegoto/domain'
import { MemberRepository } from '@iegoto/db'
import type { FamilyContext } from '../../../trpc.js'

/** F-01: プロフィール追加 (ログイン不要のメンバー。子ども等) */
export async function addMember(
  ctx: FamilyContext,
  input: { displayName: string; color?: MemberColor },
): Promise<{ memberId: string }> {
  return ctx.db.$transaction(async (tx) => {
    const repo = new MemberRepository(tx)
    const max = await repo.maxSortOrder(ctx.familyId)
    const member = createMember({
      familyId: ctx.familyId,
      displayName: input.displayName,
      color: input.color ?? (MEMBER_COLORS[max % MEMBER_COLORS.length] as MemberColor),
      sortOrder: max + 1,
    })
    await repo.create(member)
    return { memberId: member.id }
  })
}
