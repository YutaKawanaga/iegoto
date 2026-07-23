import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@/lib/utils'

export const Dialog = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger
export const DialogClose = DialogPrimitive.Close

/**
 * ヘッダ (タイトル+閉じる) は上部固定、footer を渡すと下部固定で表示する。
 * 本文だけがスクロールするため、長いフォームでも閉じる/保存が常に見える
 */
export function DialogContent({
  className,
  children,
  title,
  footer,
  headerAction,
  ...props
}: ComponentProps<typeof DialogPrimitive.Content> & {
  title: string
  children: ReactNode
  footer?: ReactNode
  /** ヘッダ右側 (閉じるボタンの左) に置く操作。日別ビューの「予定を作成」等 */
  headerAction?: ReactNode
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40" />
      <DialogPrimitive.Content
        className={cn(
          'fixed left-1/2 top-1/2 z-50 flex max-h-[85dvh] w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl bg-card shadow-xl',
          className,
        )}
        {...props}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-3.5">
          <DialogPrimitive.Title className="text-base font-semibold">{title}</DialogPrimitive.Title>
          <div className="flex items-center gap-1">
            {headerAction}
            {/* 当たり判定は headerAction (Button size=icon: h-10 w-10) と同じ大きさに揃える */}
            <DialogPrimitive.Close
              className="flex h-10 w-10 items-center justify-center rounded-md hover:bg-muted"
              aria-label="閉じる"
            >
              <X className="h-4 w-4" />
            </DialogPrimitive.Close>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
        {footer !== undefined && (
          <div className="shrink-0 border-t border-border px-5 py-3">{footer}</div>
        )}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}
