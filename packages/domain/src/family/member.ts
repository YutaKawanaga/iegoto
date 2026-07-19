import { DomainError } from '../shared/errors.js'
import { type FamilyId, type MemberId, type UserAccountId, newId } from '../shared/id.js'

/** メンバーカラーのプリセット。web 側の CSS variables (--member-*) と1:1 (06 §5) */
export const MEMBER_COLORS = [
  'coral',
  'sky',
  'leaf',
  'amber',
  'plum',
  'teal',
  'rose',
  'indigo',
] as const
export type MemberColor = (typeof MEMBER_COLORS)[number]

/**
 * 家族内プロフィール (S-1)。
 * userAccountId が null = ログイン不可のプロフィール (子ども等)
 */
export type Member = {
  id: MemberId
  familyId: FamilyId
  userAccountId: UserAccountId | null
  displayName: string
  color: MemberColor
  sortOrder: number
  deletedAt: Date | null
}

export function createMember(input: {
  familyId: FamilyId
  userAccountId?: UserAccountId | null
  displayName: string
  color: MemberColor
  sortOrder: number
}): Member {
  return {
    id: newId<'Member'>(),
    familyId: input.familyId,
    userAccountId: input.userAccountId ?? null,
    displayName: validateDisplayName(input.displayName),
    color: input.color,
    sortOrder: input.sortOrder,
    deletedAt: null,
  }
}

export function validateDisplayName(name: string): string {
  const trimmed = name.trim()
  if (trimmed.length === 0 || trimmed.length > 30) {
    throw new DomainError('INVALID_MEMBER_NAME', '名前は1〜30文字で入力してください')
  }
  return trimmed
}
