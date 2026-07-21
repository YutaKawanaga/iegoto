import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** shadcn 標準のクラス合成 (clsx + tailwind-merge。06 §5) */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
