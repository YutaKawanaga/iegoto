import { renderHook } from '@testing-library/react'
import { toast } from 'sonner'
import { describe, expect, it, vi } from 'vitest'
import { useAppToast } from './use-app-toast'

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

describe('useAppToast', () => {
  it('success / error が sonner に委譲される', () => {
    const { result } = renderHook(() => useAppToast())
    result.current.success('保存しました')
    result.current.error('失敗しました')
    expect(toast.success).toHaveBeenCalledWith('保存しました')
    expect(toast.error).toHaveBeenCalledWith('失敗しました')
  })
})
