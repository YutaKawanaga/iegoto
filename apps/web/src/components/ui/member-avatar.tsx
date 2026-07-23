import type { MemberInfo } from '@/hooks/use-me'
import { MEMBER_BG } from '@/lib/member-colors'
import { cn } from '@/lib/utils'

type Props = {
  member: Pick<MemberInfo, 'displayName' | 'color' | 'icon' | 'avatar'>
  /** サイズ・文字サイズは呼び出し側で指定 (例: 'h-8 w-8 text-xs') */
  className?: string
}

/** メンバーアバター (F-01)。表示優先順: 画像 > 絵文字 > 名前の頭文字 */
export function MemberAvatar({ member, className }: Props) {
  if (member.avatar !== null) {
    return (
      <img
        src={member.avatar}
        alt={member.displayName}
        className={cn('shrink-0 rounded-full object-cover', className)}
      />
    )
  }
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full font-bold text-white',
        MEMBER_BG[member.color],
        className,
      )}
    >
      {member.icon ?? member.displayName.slice(0, 1)}
    </span>
  )
}
