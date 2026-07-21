import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useTRPC } from '@/lib/trpc'

const POLL_INTERVAL_MS = 5000

/**
 * 変更検知 (T-2)。MVP はフォアグラウンド限定の5秒ポーリングで、
 * 指定ドメインの query を定期 invalidate する。
 * 将来 SSE 化するときはこの hook の内部だけを差し替える (呼び出し側は変更しない)
 */
export function useRealtime(target: 'shopping' | 'event'): void {
  const trpc = useTRPC()
  const queryClient = useQueryClient()

  // biome-ignore lint/correctness/useExhaustiveDependencies: trpc/queryClient は安定参照
  useEffect(() => {
    const filter = target === 'shopping' ? trpc.shopping.pathFilter() : trpc.event.pathFilter()
    const tick = () => {
      if (document.visibilityState === 'visible') {
        void queryClient.invalidateQueries(filter)
      }
    }
    const interval = setInterval(tick, POLL_INTERVAL_MS)
    document.addEventListener('visibilitychange', tick)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [target])
}
