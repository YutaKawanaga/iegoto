import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppToast } from '@/hooks/use-app-toast'
import { consumePendingInviteToken } from '@/lib/pending-invite'
import { useTRPC } from '@/lib/trpc'

/** 家族作成 (F-01 サインアップ)。招待経由のログイン復帰なら合流画面へ流す */
export function useOnboarding() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const toast = useAppToast()
  const [familyName, setFamilyName] = useState('')
  const [myDisplayName, setMyDisplayName] = useState('')

  useEffect(() => {
    const token = consumePendingInviteToken()
    if (token !== null) {
      navigate(`/invite/${token}`, { replace: true })
    }
  }, [navigate])

  const signUp = useMutation(
    trpc.family.signUp.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries(trpc.account.me.queryFilter())
        toast.success('家族を作成しました')
        navigate('/', { replace: true })
      },
      onError: (e) => toast.error(e.message),
    }),
  )

  return {
    familyName,
    setFamilyName,
    myDisplayName,
    setMyDisplayName,
    canSubmit: familyName.trim().length > 0 && myDisplayName.trim().length > 0,
    isPending: signUp.isPending,
    submit: () => signUp.mutate({ familyName, myDisplayName }),
  }
}
