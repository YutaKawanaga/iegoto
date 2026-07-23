import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { usePersistentState } from '@/hooks/use-persistent-state'
import { useRealtime } from '@/hooks/use-realtime'
import type { Occurrence } from '@/lib/api-types'
import { useTRPC } from '@/lib/trpc'
import {
  addDaysKey,
  type GridDay,
  gridRangeUtc,
  monthGrid,
  toDateKey,
  weekGrid,
} from '@/utils/calendar-grid'
import { jstDateKey } from '@/utils/date-format'
import type { MultiDayItem } from '@/utils/multi-day-layout'
import type { EditTarget } from './event-edit-modal/use-event-form'

export type CalendarView = 'month' | 'week'

/** occurrence が跨る日付キーの一覧 (複数日予定を各日のセルに表示するため) */
export function occurrenceDateKeys(occ: Occurrence): string[] {
  if (occ.time.kind === 'allDay') {
    const keys: string[] = []
    let key = occ.time.startDate
    for (let i = 0; i < 60 && key <= occ.time.endDate; i++) {
      keys.push(key)
      key = addDaysKey(key, 1)
    }
    return keys
  }
  const startKey = jstDateKey(occ.time.startAt)
  // 終了時刻がちょうど0:00の場合は前日までとみなす
  const endKey = jstDateKey(new Date(occ.time.endAt.getTime() - 1))
  const keys: string[] = []
  let key = startKey
  for (let i = 0; i < 60 && key <= endKey; i++) {
    keys.push(key)
    key = addDaysKey(key, 1)
  }
  return keys
}

/** カレンダー画面のロジック集約 (F-02): ビュー/アンカーは URL に持ちリロード耐性を確保 (06 §3) */
export function useCalendar() {
  const trpc = useTRPC()
  const [params, setParams] = useSearchParams()
  useRealtime('event')

  const view: CalendarView = params.get('view') === 'week' ? 'week' : 'month'
  const todayKey = jstDateKey(new Date())
  const anchor = params.get('date') ?? todayKey

  const grid: GridDay[] = useMemo(() => {
    if (view === 'week') {
      return weekGrid(anchor)
    }
    const [y, m] = anchor.split('-').map(Number)
    return monthGrid(y ?? new Date().getFullYear(), m ?? 1)
  }, [view, anchor])

  const range = useMemo(() => gridRangeUtc(grid), [grid])
  const eventsQuery = useQuery({
    ...trpc.event.listInRange.queryOptions({ start: range.start, end: range.end }),
    // 月送り/週送りで前の表示を残したまま裏で取得する (スピナー点滅による体感遅延の防止)
    placeholderData: keepPreviousData,
  })

  // メンバーフィルタ (F-02)。空 = 全員表示。タブ切替後も維持するため永続化 (localStorage)
  const [filterMemberIds, setFilterMemberIds] = usePersistentState<string[]>(
    'iegoto.calendar.filterMembers',
    [],
  )
  const occurrences = useMemo(() => {
    const all = eventsQuery.data ?? []
    if (filterMemberIds.length === 0) {
      return all
    }
    return all.filter((o) => o.targetMemberIds.some((id) => filterMemberIds.includes(id)))
  }, [eventsQuery.data, filterMemberIds])

  /**
   * byDate: 日付キー → その日の occurrence 一覧 (日別ビュー・週ビュー用。複数日予定も各日に含む)
   * singleByDate: 単日予定のみの日別マップ (月グリッドのチップ用)
   * multiDay: 複数日予定 (月グリッドでは連続バーとして描画する)
   */
  const { byDate, singleByDate, multiDay } = useMemo(() => {
    const byDate = new Map<string, Occurrence[]>()
    const singleByDate = new Map<string, Occurrence[]>()
    const multiDay: { item: MultiDayItem; occurrence: Occurrence }[] = []
    for (const occ of occurrences) {
      const keys = occurrenceDateKeys(occ)
      for (const key of keys) {
        const list = byDate.get(key)
        if (list === undefined) {
          byDate.set(key, [occ])
        } else {
          list.push(occ)
        }
      }
      const startKey = keys[0]
      const endKey = keys[keys.length - 1]
      if (startKey === undefined || endKey === undefined) {
        continue
      }
      if (keys.length === 1) {
        const list = singleByDate.get(startKey)
        if (list === undefined) {
          singleByDate.set(startKey, [occ])
        } else {
          list.push(occ)
        }
      } else {
        multiDay.push({
          item: { key: `${occ.eventId}-${occ.originalStartAt.getTime()}`, startKey, endKey },
          occurrence: occ,
        })
      }
    }
    return { byDate, singleByDate, multiDay }
  }, [occurrences])

  const navigate = (direction: -1 | 1) => {
    const next = view === 'week' ? addDaysKey(anchor, direction * 7) : monthShift(anchor, direction)
    setParams((p) => {
      p.set('date', next)
      return p
    })
  }

  const setView = (v: CalendarView) => {
    setParams((p) => {
      p.set('view', v)
      return p
    })
  }

  const [editTarget, setEditTarget] = useState<EditTarget | null>(null)
  // 日別ビュー (月セルタップで開く)。作成/編集モーダルと同時に開かないよう排他にする
  const [dayKey, setDayKey] = useState<string | null>(null)

  return {
    view,
    setView,
    anchor,
    todayKey,
    grid,
    byDate,
    singleByDate,
    multiDay,
    isLoading: eventsQuery.isLoading,
    filterMemberIds,
    toggleFilterMember: (id: string) =>
      setFilterMemberIds((prev) =>
        prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
      ),
    clearFilter: () => setFilterMemberIds([]),
    navigate,
    goToday: () =>
      setParams((p) => {
        p.set('date', todayKey)
        return p
      }),
    editTarget,
    dayKey,
    openDay: (key: string) => setDayKey(key),
    closeDay: () => setDayKey(null),
    // フィルタで誰かを選択中なら、その人を新規予定の対象メンバーの初期値にする
    openCreate: (dateKey: string) => {
      setDayKey(null)
      setEditTarget({ mode: 'create', dateKey, defaultMemberIds: filterMemberIds })
    },
    openEdit: (occurrence: Occurrence) => {
      setDayKey(null)
      setEditTarget({ mode: 'edit', occurrence })
    },
    closeEdit: () => setEditTarget(null),
    headerLabel:
      view === 'week'
        ? `${anchor.slice(0, 7).replace('-', '年')}月`
        : `${anchor.slice(0, 7).replace('-', '年')}月`,
  }
}

function monthShift(anchor: string, direction: -1 | 1): string {
  const [y, m] = anchor.split('-').map(Number)
  const d = new Date(Date.UTC(y ?? 2026, (m ?? 1) - 1 + direction, 1))
  return toDateKey(d)
}
