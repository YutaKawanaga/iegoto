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

/** CSS変数参照 (styles の --color-member-*)。グラデーション等の動的スタイル用 */
export const MEMBER_CSS_VAR: Record<MemberColor, string> = {
  coral: 'var(--color-member-coral)',
  sky: 'var(--color-member-sky)',
  leaf: 'var(--color-member-leaf)',
  amber: 'var(--color-member-amber)',
  plum: 'var(--color-member-plum)',
  teal: 'var(--color-member-teal)',
  rose: 'var(--color-member-rose)',
  indigo: 'var(--color-member-indigo)',
}

/**
 * 予定の塗り色 (F-02: 予定はメンバーカラーで表す)。
 * 1人 = 単色 / 複数人 = メンバーカラーのグラデーション (最大3色)
 */
export function memberFill(colors: MemberColor[]): string | undefined {
  const vars = colors.slice(0, 3).map((c) => MEMBER_CSS_VAR[c])
  if (vars.length === 0) {
    return undefined
  }
  if (vars.length === 1) {
    return vars[0]
  }
  return `linear-gradient(90deg, ${vars.join(', ')})`
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
