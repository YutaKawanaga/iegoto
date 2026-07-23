import type { MemberColor } from '@iegoto/domain'
import type { MemberInfo } from '@/hooks/use-me'
import type { Occurrence } from '@/lib/api-types'
import { memberFill } from '@/lib/member-colors'
import { cn } from '@/lib/utils'
import { formatTime } from '@/utils/date-format'

type Props = {
  occurrence: Occurrence
  members: MemberInfo[]
  compact?: boolean
  /** 未指定 = 非インタラクティブ表示 (月セル内。タップは日セル側の日別ビューに委ねる) */
  onClick?: () => void
}

/** occurrence の対象メンバーの色一覧 (バー描画側とロジック共有) */
export function occurrenceColors(occurrence: Occurrence, members: MemberInfo[]): MemberColor[] {
  const memberById = new Map(members.map((m) => [m.id, m]))
  return occurrence.targetMemberIds
    .map((id) => memberById.get(id)?.color)
    .filter((c): c is MemberColor => c !== undefined)
}

/**
 * 予定チップ (F-02: 予定はメンバーカラーの塗りで表す。
 * 1人 = 単色 / 複数人 = グラデーション / 対象なし = グレー)
 */
export function EventChip({ occurrence, members, compact = false, onClick }: Props) {
  const fill = memberFill(occurrenceColors(occurrence, members))

  const className = cn(
    'block w-full rounded px-1 py-0.5 text-left text-[11px] leading-tight',
    compact ? 'md:text-xs' : 'truncate text-sm py-1.5 px-2 rounded-lg',
    fill === undefined ? 'bg-muted' : 'font-medium text-white',
  )
  const style = fill === undefined ? undefined : { background: fill }

  const inner = (
    <>
      {occurrence.time.kind === 'timed' && !compact && (
        <span
          className={cn('mr-1', fill === undefined ? 'text-muted-foreground' : 'text-white/80')}
        >
          {formatTime(occurrence.time.startAt)}
        </span>
      )}
      {/* compact (月セル): タイトルは省略せず2行まで折り返す */}
      <span className={cn('align-middle', compact && 'line-clamp-2 break-all')}>
        {occurrence.title}
      </span>
    </>
  )

  if (onClick === undefined) {
    return (
      <div className={className} style={style}>
        {inner}
      </div>
    )
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
      style={style}
    >
      {inner}
    </button>
  )
}
