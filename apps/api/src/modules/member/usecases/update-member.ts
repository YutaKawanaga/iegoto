import { MemberRepository } from '@iegoto/db'
import {
  type MemberColor,
  toId,
  validateDisplayName,
  validateMemberAvatar,
  validateMemberIcon,
} from '@iegoto/domain'
import type { FamilyContext } from '../../../trpc.js'

export async function updateMember(
  ctx: FamilyContext,
  input: {
    memberId: string
    displayName?: string
    color?: MemberColor
    icon?: string | null
    avatar?: string | null
  },
): Promise<void> {
  const data: {
    displayName?: string
    color?: MemberColor
    icon?: string | null
    avatar?: string | null
  } = {}
  if (input.displayName !== undefined) {
    data.displayName = validateDisplayName(input.displayName)
  }
  if (input.color !== undefined) {
    data.color = input.color
  }
  if (input.icon !== undefined) {
    data.icon = validateMemberIcon(input.icon)
  }
  if (input.avatar !== undefined) {
    data.avatar = validateMemberAvatar(input.avatar)
  }
  await new MemberRepository(ctx.db).update(ctx.familyId, toId<'Member'>(input.memberId), data)
}
