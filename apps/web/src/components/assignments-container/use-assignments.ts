import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAppToast } from '@/hooks/use-app-toast'
import { useRealtime } from '@/hooks/use-realtime'
import type { Occurrence } from '@/lib/api-types'
import { useTRPC } from '@/lib/trpc'

/** 担当画面 (F-04): 自分の担当一覧 / 担当者未定一覧 (押し付け合い可視化) */
export function useAssignments() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const toast = useAppToast()
  useRealtime('event')

  const mine = useQuery(trpc.event.myAssigned.queryOptions())
  const unassigned = useQuery(trpc.event.unassigned.queryOptions())

  const claim = useMutation(
    trpc.event.update.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries(trpc.event.pathFilter())
        toast.success('担当しました')
      },
      onError: (e) => toast.error(e.message),
    }),
  )

  return {
    mine: mine.data ?? [],
    unassigned: unassigned.data ?? [],
    isLoading: mine.isLoading || unassigned.isLoading,
    /**
     * 「担当する」: 繰り返し予定はシリーズ全体に適用 (scope: all)。
     * 回ごとの細かい担当分けはカレンダーの予定編集 (この予定のみ) で行う
     */
    claim: (occ: Occurrence, myMemberId: string) =>
      claim.mutate({
        eventId: occ.eventId,
        scope: 'all',
        originalStartAt: occ.originalStartAt,
        occurrenceTime: occ.time,
        changes: { assigneeMemberId: myMemberId },
      }),
    isClaiming: claim.isPending,
  }
}
