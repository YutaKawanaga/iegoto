import { useCallback, useState } from 'react'

type Updater<T> = T | ((prev: T) => T)

/**
 * localStorage 連動の useState。タブ(ルート)切替でコンポーネントが unmount されても
 * 選択状態 (カレンダーのメンバーフィルタ・買い物のアクティブリスト等) を維持する。
 * 読み書きに失敗する環境 (Safari プライベートモード等) ではメモリ上の state のみで動く
 */
export function usePersistentState<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = window.localStorage.getItem(key)
      return raw === null ? initialValue : (JSON.parse(raw) as T)
    } catch {
      return initialValue
    }
  })

  const set = useCallback(
    (next: Updater<T>) => {
      setValue((prev) => {
        const resolved = typeof next === 'function' ? (next as (p: T) => T)(prev) : next
        try {
          window.localStorage.setItem(key, JSON.stringify(resolved))
        } catch {
          // 保存できなくても表示中の state は更新する
        }
        return resolved
      })
    },
    [key],
  )

  return [value, set] as const
}
