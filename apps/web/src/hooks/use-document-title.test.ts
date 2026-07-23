import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useDocumentTitle } from './use-document-title'

describe('useDocumentTitle', () => {
  it('マウントでタイトルを設定し、アンマウントで既定値に戻す', () => {
    const { unmount } = renderHook(() => useDocumentTitle('カレンダー'))
    expect(document.title).toBe('カレンダー | iegoto')
    unmount()
    expect(document.title).toBe('iegoto')
  })

  it('title の変更に追従する', () => {
    const { rerender } = renderHook(({ t }) => useDocumentTitle(t), {
      initialProps: { t: '買い物リスト' },
    })
    expect(document.title).toBe('買い物リスト | iegoto')
    rerender({ t: '設定' })
    expect(document.title).toBe('設定 | iegoto')
  })
})
