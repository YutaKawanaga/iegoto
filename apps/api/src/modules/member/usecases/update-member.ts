import { MemberRepository } from '@iegoto/db'
import { type MemberColor, toId, validateDisplayName } from '@iegoto/domain'
import type { FamilyContext } from '../../../trpc.js'

export async function updateMember(
  ctx: FamilyContext,
  input: { memberId: string; displayName?: string; color?: MemberColor },
): Promise<void> {
  const data: { displayName?: string; color?: MemberColor } = {}
  if (input.displayName !== undefined) {
    data.displayName = validateDisplayName(input.displayName)
  }
  if (input.color !== undefined) {
    data.color = input.color
  }
  await new MemberRepository(ctx.db).update(ctx.familyId, toId<'Member'>(input.memberId), data)
}
