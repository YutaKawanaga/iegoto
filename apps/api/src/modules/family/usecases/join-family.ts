import { FamilyRepository, InvitationRepository, MemberRepository } from '@iegoto/db'
import {
  createMember,
  isInvitationUsable,
  MEMBER_COLORS,
  type MemberColor,
  toId,
} from '@iegoto/domain'
import { TRPCError } from '@trpc/server'
import type { TrpcContext } from '../../../trpc.js'
import { hashInvitationToken } from './invitation-token.js'

type AuthedContext = TrpcContext & { userAccountId: NonNullable<TrpcContext['userAccountId']> }

/**
 * 招待リンクのプレビュー (S-2)。
 * 無効なトークンには家族名等を一切返さず INVALID のみ (情報を漏らさない)
 */
export async function previewInvitation(
  ctx: AuthedContext,
  token: string,
): Promise<
  | { status: 'invalid' }
  | {
      status: 'ok'
      familyName: string
      /** S-1: 既存プロフィールへの紐づけ候補 (ログイン未紐づけのメンバー) */
      linkableMembers: { id: string; displayName: string }[]
    }
> {
  const invitation = await new InvitationRepository(ctx.db).findByTokenHash(
    hashInvitationToken(token),
  )
  if (invitation === null || !isInvitationUsable(invitation, new Date())) {
    return { status: 'invalid' }
  }
  const family = await new FamilyRepository(ctx.db).find(invitation.familyId)
  if (family === null) {
    return { status: 'invalid' }
  }
  const members = await new MemberRepository(ctx.db).list(invitation.familyId)
  return {
    status: 'ok',
    familyName: family.name,
    linkableMembers: members
      .filter((m) => m.userAccountId === null)
      .map((m) => ({ id: m.id, displayName: m.displayName })),
  }
}

export type JoinFamilyInput = {
  token: string
  /** 'new' = 新しいプロフィールを作る / 'link' = 既存プロフィールに紐づける (S-1 昇格) */
  mode: 'new' | 'link'
  displayName?: string
  memberId?: string
}

export async function joinFamilyByInvitation(
  ctx: AuthedContext,
  input: JoinFamilyInput,
): Promise<{ familyId: string }> {
  const memberRepo = new MemberRepository(ctx.db)
  const existing = await memberRepo.findActiveByUserAccount(ctx.userAccountId)
  if (existing !== null) {
    throw new TRPCError({
      code: 'CONFLICT',
      message: 'すでに家族に所属しています (S-7: 1ユーザー1家族)',
    })
  }
  const invitation = await new InvitationRepository(ctx.db).findByTokenHash(
    hashInvitationToken(input.token),
  )
  if (invitation === null || !isInvitationUsable(invitation, new Date())) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'リンクが無効です' })
  }
  const familyId = invitation.familyId

  return ctx.db.$transaction(async (tx) => {
    const txMembers = new MemberRepository(tx)
    if (input.mode === 'link') {
      if (input.memberId === undefined) {
        throw new TRPCError({ code: 'BAD_REQUEST' })
      }
      const target = await txMembers.find(familyId, toId<'Member'>(input.memberId))
      if (target === null || target.userAccountId !== null || target.deletedAt !== null) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'このプロフィールには紐づけできません',
        })
      }
      await txMembers.linkUserAccount(familyId, target.id, ctx.userAccountId)
      return { familyId }
    }
    const displayName = input.displayName?.trim()
    if (displayName === undefined || displayName.length === 0) {
      throw new TRPCError({ code: 'BAD_REQUEST' })
    }
    const count = await txMembers.maxSortOrder(familyId)
    const color = MEMBER_COLORS[count % MEMBER_COLORS.length] as MemberColor
    await txMembers.create(
      createMember({
        familyId,
        userAccountId: ctx.userAccountId,
        displayName,
        color,
        sortOrder: count + 1,
      }),
    )
    return { familyId }
  })
}
