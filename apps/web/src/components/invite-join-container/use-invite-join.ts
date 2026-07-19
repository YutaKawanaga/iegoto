import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppToast } from '@/hooks/use-app-toast'
import { useMe } from '@/hooks/use-me'
import { storePendingInviteToken } from '@/lib/pending-invite'
import { useTRPC } from '@/lib/trpc'

/** 招待合流 (S-1/S-2): プレビュー → 新規プロフィール or 既存プロフィール紐づけを選んで参加 */
export function useInviteJoin(token: string) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const toast = useAppToast()
  const { me, isLoading: meLoading, isUnauthorized } = useMe()

  const preview = useQuery({
    ...trpc.family.invitation.preview.queryOptions({ token }),
    enabled: !meLoading && !isUnauthorized,
    retry: false,
  })

  const [mode, setMode] = useState<'new' | 'link'>('new')
  const [displayName, setDisplayName] = useState('')
  const [memberId, setMemberId] = useState<string | null>(null)

  const join = useMutation(
    trpc.family.invitation.join.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries()
        toast.success('家族に参加しました')
        navigate('/', { replace: true })
      },
      onError: (e) => toast.error(e.message),
    }),
  )

  const loginAndComeBack = () => {
    storePendingInviteToken(token)
    window.location.assign('/auth/google')
  }

  const canSubmit = mode === 'new' ? displayName.trim().length > 0 : memberId !== null

  return {
    meLoading,
    isUnauthorized,
    alreadyInFamily: me?.family != null,
    preview: preview.data ?? null,
    previewLoading: preview.isLoading,
    mode,
    setMode,
    displayName,
    setDisplayName,
    memberId,
    setMemberId,
    canSubmit,
    isJoining: join.isPending,
    loginAndComeBack,
    submit: () =>
      join.mutate(
        mode === 'new' ? { token, mode, displayName } : { token, mode, memberId: memberId ?? '' },
      ),
  }
}
