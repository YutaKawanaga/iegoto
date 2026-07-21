import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { occurrenceDateKeys } from '@/components/calendar-container/use-calendar'
import type { FamilyInfo } from '@/hooks/use-me'
import { useRealtime } from '@/hooks/use-realtime'
import { useTRPC } from '@/lib/trpc'
import { addDaysKey } from '@/utils/calendar-grid'
import { jstDateKey } from '@/utils/date-format'

/** 今日のまとめビュー (F-06): 今日の家族全員の予定・自分の担当・買い物残・明日のプレビュー */
export function useToday(family: FamilyInfo) {
  const trpc = useTRPC()
  useRealtime('event')

  const todayKey = jstDateKey(new Date())
  const tomorrowKey = addDaysKey(todayKey, 1)
  const range = useMemo(
    () => ({
      start: new Date(`${todayKey}T00:00:00+09:00`),
      end: new Date(`${addDaysKey(todayKey, 2)}T00:00:00+09:00`),
    }),
    [todayKey],
  )

  const eventsQuery = useQuery(
    trpc.event.listInRange.queryOptions({ start: range.start, end: range.end }),
  )
  const uncheckedQuery = useQuery(trpc.shopping.uncheckedCount.queryOptions())

  const all = eventsQuery.data ?? []
  const todayEvents = all.filter((o) => occurrenceDateKeys(o).includes(todayKey))
  const tomorrowEvents = all.filter((o) => occurrenceDateKeys(o).includes(tomorrowKey))
  const myAssigned = todayEvents.filter((o) => o.assigneeMemberId === family.myMemberId)

  return {
    isLoading: eventsQuery.isLoading,
    todayEvents,
    tomorrowEvents,
    myAssigned,
    uncheckedCount: uncheckedQuery.data?.count ?? 0,
  }
}
