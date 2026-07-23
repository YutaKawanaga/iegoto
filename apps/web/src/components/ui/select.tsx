import type { SelectHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

/** ネイティブ select ベース (モバイル第一優先のため OS ピッカーをそのまま使う) */
export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        // モバイルは16px (text-base) 必須: iOS はフォント16px未満のフォーカスで画面を自動ズームする
        'flex h-10 w-full appearance-none rounded-lg border border-border bg-card px-3 py-2 text-base outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:opacity-50 md:text-sm',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  )
}
