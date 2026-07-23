import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest'
import { useRealtime } from './use-realtime'

// useTRPC は tRPC Provider を要求するため、pathFilter だけ返すスタブに差し替える
vi.mock('@/lib/trpc', () => ({
  useTRPC: () => ({
    shopping: { pathFilter: () => ({ queryKey: [['shopping']] }) },
    event: { pathFilter: () => ({ queryKey: [['event']] }) },
  }),
}))

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true })
}

describe('useRealtime', () => {
  let queryClient: QueryClient
  let invalidateSpy: MockInstance<QueryClient['invalidateQueries']>

  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children)

  beforeEach(() => {
    vi.useFakeTimers()
    queryClient = new QueryClient()
    invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    setVisibility('visible')
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('フォアグラウンドでは5秒ごとに対象ドメインの query を invalidate する', () => {
    renderHook(() => useRealtime('shopping'), { wrapper })
    expect(invalidateSpy).not.toHaveBeenCalled()
    vi.advanceTimersByTime(5000)
    expect(invalidateSpy).toHaveBeenCalledTimes(1)
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: [['shopping']] })
    vi.advanceTimersByTime(10_000)
    expect(invalidateSpy).toHaveBeenCalledTimes(3)
  })

  it('バックグラウンド (hidden) 中は invalidate しない', () => {
    setVisibility('hidden')
    renderHook(() => useRealtime('event'), { wrapper })
    vi.advanceTimersByTime(15_000)
    expect(invalidateSpy).not.toHaveBeenCalled()
  })

  it('アンマウントでポーリングが止まる', () => {
    const { unmount } = renderHook(() => useRealtime('event'), { wrapper })
    vi.advanceTimersByTime(5000)
    expect(invalidateSpy).toHaveBeenCalledTimes(1)
    unmount()
    vi.advanceTimersByTime(15_000)
    expect(invalidateSpy).toHaveBeenCalledTimes(1)
  })
})
