import type { TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        // モバイルは16px (text-base) 必須: iOS はフォント16px未満のフォーカスで画面を自動ズームする
        'flex min-h-20 w-full rounded-lg border border-border bg-card px-3 py-2 text-base outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary/50 disabled:opacity-50 md:text-sm',
        className,
      )}
      {...props}
    />
  )
}
