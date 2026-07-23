import type { InputHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        // モバイルは16px (text-base) 必須: iOS はフォント16px未満のinputフォーカスで画面を自動ズームする
        'flex h-10 w-full rounded-lg border border-border bg-card px-3 py-2 text-base outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary/50 disabled:opacity-50 md:text-sm',
        className,
      )}
      {...props}
    />
  )
}
