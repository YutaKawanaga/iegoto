import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { usePersistentState } from './use-persistent-state'

describe('usePersistentState', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('保存値がなければ初期値を返す', () => {
    const { result } = renderHook(() => usePersistentState('k', ['a']))
    expect(result.current[0]).toEqual(['a'])
  })

  it('set した値を localStorage に保存し、次回マウントで復元する', () => {
    const first = renderHook(() => usePersistentState<string[]>('k', []))
    act(() => first.result.current[1](['m1', 'm2']))
    expect(first.result.current[0]).toEqual(['m1', 'm2'])
    first.unmount()

    const second = renderHook(() => usePersistentState<string[]>('k', []))
    expect(second.result.current[0]).toEqual(['m1', 'm2'])
  })

  it('関数 updater で前の値から更新できる', () => {
    const { result } = renderHook(() => usePersistentState('count', 1))
    act(() => result.current[1]((prev) => prev + 1))
    expect(result.current[0]).toBe(2)
    expect(window.localStorage.getItem('count')).toBe('2')
  })

  it('壊れた保存値 (不正JSON) は無視して初期値を返す', () => {
    window.localStorage.setItem('k', '{broken')
    const { result } = renderHook(() => usePersistentState('k', 'fallback'))
    expect(result.current[0]).toBe('fallback')
  })

  it('null も保存・復元できる (買い物のアクティブリスト未選択)', () => {
    const first = renderHook(() => usePersistentState<string | null>('list', null))
    act(() => first.result.current[1]('list-1'))
    first.unmount()
    const second = renderHook(() => usePersistentState<string | null>('list', null))
    expect(second.result.current[0]).toBe('list-1')
  })
})
