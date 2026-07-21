import type { FamilyId, InvitationId, MemberId } from '../shared/id.js'

/** 招待リンク (S-2)。トークン平文は保存せずハッシュのみ持つ */
export type Invitation = {
  id: InvitationId
  familyId: FamilyId
  tokenHash: string
  expiresAt: Date
  revokedAt: Date | null
  createdByMemberId: MemberId
}

export const INVITATION_TTL_DAYS = 7

export function invitationExpiry(issuedAt: Date): Date {
  return new Date(issuedAt.getTime() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000)
}

/** 期限内かつ未失効か (S-2)。無効時の理由は返さない (情報を漏らさない) */
export function isInvitationUsable(invitation: Invitation, now: Date): boolean {
  return invitation.revokedAt === null && invitation.expiresAt.getTime() > now.getTime()
}
