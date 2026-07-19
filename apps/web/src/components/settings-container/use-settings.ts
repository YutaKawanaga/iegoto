import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useAppToast } from '@/hooks/use-app-toast'
import type { FamilyInfo } from '@/hooks/use-me'
import { useTRPC } from '@/lib/trpc'

/** 設定画面 (F-01): メンバー管理・招待リンク・退出・ログアウト */
export function useSettings(family: FamilyInfo) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const toast = useAppToast()

  const invalidateMe = () => queryClient.invalidateQueries(trpc.account.me.queryFilter())

  // --- メンバー管理 ---
  const [newMemberName, setNewMemberName] = useState('')
  const addMember = useMutation(
    trpc.member.add.mutationOptions({
      onSuccess: async () => {
        setNewMemberName('')
        await invalidateMe()
        toast.success('メンバーを追加しました')
      },
      onError: (e) => toast.error(e.message),
    }),
  )
  const updateMember = useMutation(
    trpc.member.update.mutationOptions({
      onSuccess: invalidateMe,
      onError: (e) => toast.error(e.message),
    }),
  )
  const deleteMember = useMutation(
    trpc.member.softDelete.mutationOptions({
      onSuccess: async () => {
        await invalidateMe()
        toast.success('メンバーを削除しました (過去の予定は残ります)')
      },
      onError: (e) => toast.error(e.message),
    }),
  )

  // --- 招待リンク (S-2) ---
  const activeInvitation = useQuery(trpc.family.invitation.active.queryOptions())
  const [issuedToken, setIssuedToken] = useState<string | null>(null)
  const issueInvitation = useMutation(
    trpc.family.invitation.issue.mutationOptions({
      onSuccess: async (data) => {
        setIssuedToken(data.token)
        await queryClient.invalidateQueries(trpc.family.invitation.active.queryFilter())
      },
      onError: (e) => toast.error(e.message),
    }),
  )
  const revokeInvitation = useMutation(
    trpc.family.invitation.revoke.mutationOptions({
      onSuccess: async () => {
        setIssuedToken(null)
        await queryClient.invalidateQueries(trpc.family.invitation.active.queryFilter())
        toast.success('招待リンクを無効にしました')
      },
      onError: (e) => toast.error(e.message),
    }),
  )

  const inviteUrl = issuedToken === null ? null : `${window.location.origin}/invite/${issuedToken}`

  const copyInviteUrl = async () => {
    if (inviteUrl !== null) {
      await navigator.clipboard.writeText(inviteUrl)
      toast.success('招待リンクをコピーしました (有効期限7日)')
    }
  }

  // --- 退出・ログアウト ---
  const leave = useMutation(
    trpc.member.leave.mutationOptions({
      onSuccess: () => window.location.assign('/login'),
      onError: (e) => toast.error(e.message),
    }),
  )

  const logout = async () => {
    await fetch('/auth/logout', { method: 'POST' })
    window.location.assign('/login')
  }

  return {
    members: family.members,
    newMemberName,
    setNewMemberName,
    submitNewMember: () => {
      if (newMemberName.trim().length > 0) {
        addMember.mutate({ displayName: newMemberName })
      }
    },
    renameMember: (memberId: string, displayName: string) =>
      updateMember.mutate({ memberId, displayName }),
    removeMember: (memberId: string) => deleteMember.mutate({ memberId }),
    hasActiveInvitation: activeInvitation.data != null,
    invitationExpiresAt: activeInvitation.data?.expiresAt ?? null,
    inviteUrl,
    issueInvitation: () => issueInvitation.mutate(),
    isIssuing: issueInvitation.isPending,
    revokeInvitation: () => revokeInvitation.mutate(),
    copyInviteUrl,
    leaveFamily: () => leave.mutate(),
    logout,
  }
}
