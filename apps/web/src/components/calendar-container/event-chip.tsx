import type { MemberColor } from '@iegoto/domain'
import type { MemberInfo } from '@/hooks/use-me'
import type { Occurrence } from '@/lib/api-types'
import { MEMBER_BG, MEMBER_BG_SOFT } from '@/lib/member-colors'
import { cn } from '@/lib/utils'
import { formatTime } from '@/utils/date-format'

type Props = {
  occurrence: Occurrence
  members: MemberInfo[]
  compact?: boolean
  /** 未指定 = 非インタラクティブ表示 (月セル内。タップは日セル側の日別ビューに委ねる) */
  onClick?: () => void
}

/** 予定チップ (F-02: メンバーカラー色分け。対象複数時は色ドットを並べる) */
export function EventChip({ occurrence, members, compact = false, onClick }: Props) {
  const memberById = new Map(members.map((m) => [m.id, m]))
  const colors: MemberColor[] = occurrence.targetMemberIds
    .map((id) => memberById.get(id)?.color)
    .filter((c): c is MemberColor => c !== undefined)
  const primary = colors[0]

  const className = cn(
    'block w-full rounded px-1 py-0.5 text-left text-[11px] leading-tight',
    compact ? 'md:text-xs' : 'truncate text-sm py-1.5 px-2 rounded-lg',
    primary !== undefined ? MEMBER_BG_SOFT[primary] : 'bg-muted',
  )

  const inner = (
    <>
      {/* compact (月セル): 幅が狭いためドットは複数メンバー時のみ。単独は背景色で表現し、
          タイトルは省略せず2行まで折り返す (iPhoneで数文字でも「…」になる問題の対策) */}
      {(!compact || colors.length > 1) && (
        <span className="mr-1 inline-flex -space-x-0.5 align-middle">
          {colors.slice(0, 3).map((c, i) => (
            <span
              // biome-ignore lint/suspicious/noArrayIndexKey: 同色メンバーが並びうるため index を含める
              key={`${c}-${i}`}
              className={cn('inline-block h-2 w-2 rounded-full ring-1 ring-card', MEMBER_BG[c])}
            />
          ))}
          {colors.length === 0 && (
            <span className="inline-block h-2 w-2 rounded-full bg-muted-foreground/40" />
          )}
        </span>
      )}
      {occurrence.time.kind === 'timed' && !compact && (
        <span className="mr-1 text-muted-foreground">{formatTime(occurrence.time.startAt)}</span>
      )}
      <span className={cn('align-middle', compact && 'line-clamp-2 break-all')}>
        {occurrence.title}
      </span>
    </>
  )

  if (onClick === undefined) {
    return <div className={className}>{inner}</div>
  }
  return (
    <button
      type="button"
      onClick={(e) => {
        // 日セル側のクリック (日別ビューを開く) にバブリングさせない
        e.stopPropagation()
        onClick()
      }}
      className={className}
    >
      {inner}
    </button>
  )
}
