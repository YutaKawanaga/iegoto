import type { MemberColor } from '@iegoto/domain'

/**
 * メンバーカラー → Tailwind クラスの対応表。
 * 固定色直書き禁止 (06 §5)。着色はこの Record 経由のみ
 */
export const MEMBER_BG: Record<MemberColor, string> = {
  coral: 'bg-member-coral',
  sky: 'bg-member-sky',
  leaf: 'bg-member-leaf',
  amber: 'bg-member-amber',
  plum: 'bg-member-plum',
  teal: 'bg-member-teal',
  rose: 'bg-member-rose',
  indigo: 'bg-member-indigo',
}

export const MEMBER_BG_SOFT: Record<MemberColor, string> = {
  coral: 'bg-member-coral/15',
  sky: 'bg-member-sky/15',
  leaf: 'bg-member-leaf/15',
  amber: 'bg-member-amber/15',
  plum: 'bg-member-plum/15',
  teal: 'bg-member-teal/15',
  rose: 'bg-member-rose/15',
  indigo: 'bg-member-indigo/15',
}

export const MEMBER_BORDER: Record<MemberColor, string> = {
  coral: 'border-member-coral',
  sky: 'border-member-sky',
  leaf: 'border-member-leaf',
  amber: 'border-member-amber',
  plum: 'border-member-plum',
  teal: 'border-member-teal',
  rose: 'border-member-rose',
  indigo: 'border-member-indigo',
}
