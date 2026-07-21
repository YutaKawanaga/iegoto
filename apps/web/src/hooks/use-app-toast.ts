import { toast } from 'sonner'

/** toast 呼び出しの一元化 (06 §5。plainer の use-plainer-toast 方式)。直接 sonner を import しない */
export function useAppToast() {
  return {
    success: (message: string) => toast.success(message),
    error: (message: string) => toast.error(message),
  }
}
