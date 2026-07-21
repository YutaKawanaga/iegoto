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
  onClick: () => void
}

/** 予定チップ (F-02: メンバーカラー色分け。対象複数時は色ドットを並べる) */
export function EventChip({ occurrence, members, compact = false, onClick }: Props) {
  const memberById = new Map(members.map((m) => [m.id, m]))
  const colors: MemberColor[] = occurrence.targetMemberIds
    .map((id) => memberById.get(id)?.color)
    .filter((c): c is MemberColor => c !== undefined)
  const primary = colors[0]

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'block w-full truncate rounded px-1 py-0.5 text-left text-[11px] leading-tight',
        compact ? 'md:text-xs' : 'text-sm py-1.5 px-2 rounded-lg',
        primary !== undefined ? MEMBER_BG_SOFT[primary] : 'bg-muted',
      )}
    >
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
      {occurrence.time.kind === 'timed' && !compact && (
        <span className="mr-1 text-muted-foreground">{formatTime(occurrence.time.startAt)}</span>
      )}
      <span className="align-middle">{occurrence.title}</span>
    </button>
  )
}
