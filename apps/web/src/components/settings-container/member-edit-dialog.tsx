import type { MemberColor } from '@iegoto/domain'
import { ImagePlus } from 'lucide-react'
import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MemberAvatar } from '@/components/ui/member-avatar'
import { useAppToast } from '@/hooks/use-app-toast'
import type { MemberInfo } from '@/hooks/use-me'
import { resizeImageToAvatar } from '@/lib/image'
import { MEMBER_BG } from '@/lib/member-colors'
import { cn } from '@/lib/utils'

// domain の MEMBER_COLORS を値 import するとバレル経由で rrule (CJS) まで
// ブラウザに引き込んで dev サーバで壊れるため、web 側の色対応表からキーを導出する
const COLOR_OPTIONS = Object.keys(MEMBER_BG) as MemberColor[]

/** アイコンのプリセット (絵文字1つ)。自由入力は設けずタップで選ぶだけにする */
const ICON_PRESETS = [
  '👨',
  '👩',
  '👦',
  '👧',
  '👶',
  '👴',
  '👵',
  '🐶',
  '🐱',
  '🐰',
  '🐻',
  '🐼',
  '🦊',
  '🐥',
  '⭐',
  '🌸',
  '⚽',
  '🎀',
] as const

type Props = {
  member: MemberInfo
  onSave: (changes: {
    displayName: string
    icon: string | null
    avatar: string | null
    color: MemberInfo['color']
  }) => void
  onClose: () => void
  isPending: boolean
}

/** メンバー編集ダイアログ (F-01): 名前・アイコン (写真 or 絵文字)・カラーの変更 */
export function MemberEditDialog({ member, onSave, onClose, isPending }: Props) {
  const toast = useAppToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState(member.displayName)
  const [icon, setIcon] = useState<string | null>(member.icon)
  const [avatar, setAvatar] = useState<string | null>(member.avatar)
  const [color, setColor] = useState(member.color)

  const pickPhoto = async (file: File | undefined) => {
    if (file === undefined) {
      return
    }
    try {
      setAvatar(await resizeImageToAvatar(file))
    } catch {
      toast.error('画像を読み込めませんでした')
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        title="メンバーを編集"
        footer={
          <div className="flex justify-end">
            <Button
              disabled={name.trim().length === 0 || isPending}
              onClick={() => onSave({ displayName: name, icon, avatar, color })}
            >
              保存
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="member-name">名前</Label>
            <Input
              id="member-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={30}
            />
          </div>

          <div className="space-y-1.5">
            <Label>アイコン写真</Label>
            <div className="flex items-center gap-3">
              <MemberAvatar
                member={{ displayName: name, color, icon, avatar }}
                className="h-14 w-14 text-xl"
              />
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                aria-label="アイコン写真を選ぶ"
                onChange={(e) => pickPhoto(e.target.files?.[0])}
              />
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                <ImagePlus className="h-4 w-4" />
                写真を選ぶ
              </Button>
              {avatar !== null && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                  onClick={() => setAvatar(null)}
                >
                  写真を削除
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>絵文字アイコン (写真がないときに表示)</Label>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setIcon(null)}
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-full border border-border text-xs text-muted-foreground',
                  icon === null && 'border-primary bg-primary/10',
                )}
              >
                なし
              </button>
              {ICON_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  aria-label={`アイコン ${preset}`}
                  onClick={() => setIcon(preset)}
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-full border border-border text-xl',
                    icon === preset && 'border-primary bg-primary/10',
                  )}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>カラー</Label>
            <div className="flex flex-wrap gap-2">
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`カラー ${c}`}
                  onClick={() => setColor(c)}
                  className={cn(
                    'h-8 w-8 rounded-full ring-offset-2',
                    MEMBER_BG[c],
                    color === c && 'ring-2 ring-primary',
                  )}
                />
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
