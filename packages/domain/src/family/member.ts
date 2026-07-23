import { DomainError } from '../shared/errors.js'
import { type FamilyId, type MemberId, newId, type UserAccountId } from '../shared/id.js'

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
  /** アイコン (絵文字)。null = 未設定 (表示は名前の頭文字で代替) */
  icon: string | null
  sortOrder: number
  deletedAt: Date | null
}

export function createMember(input: {
  familyId: FamilyId
  userAccountId?: UserAccountId | null
  displayName: string
  color: MemberColor
  icon?: string | null
  sortOrder: number
}): Member {
  return {
    id: newId<'Member'>(),
    familyId: input.familyId,
    userAccountId: input.userAccountId ?? null,
    displayName: validateDisplayName(input.displayName),
    color: input.color,
    icon: validateMemberIcon(input.icon ?? null),
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

/** 絵文字1つ想定。ZWJ結合絵文字 (家族絵文字等) があるため UTF-16 長で最大16まで許容 */
export function validateMemberIcon(icon: string | null): string | null {
  if (icon === null) {
    return null
  }
  const trimmed = icon.trim()
  if (trimmed.length === 0) {
    return null
  }
  if (trimmed.length > 16) {
    throw new DomainError('INVALID_MEMBER_ICON', 'アイコンが長すぎます')
  }
  return trimmed
}
