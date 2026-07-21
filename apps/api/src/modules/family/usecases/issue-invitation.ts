import { InvitationRepository } from '@iegoto/db'
import { invitationExpiry, newId } from '@iegoto/domain'
import type { FamilyContext } from '../../../trpc.js'
import { generateInvitationToken, hashInvitationToken } from './invitation-token.js'

/** S-2: 発行と同時に旧リンクを自動失効 (同時有効は家族ごと1本)。平文トークンはこの応答でのみ返す */
export async function issueInvitation(
  ctx: FamilyContext,
): Promise<{ token: string; expiresAt: Date }> {
  const token = generateInvitationToken()
  const now = new Date()
  const expiresAt = invitationExpiry(now)
  await ctx.db.$transaction(async (tx) => {
    const repo = new InvitationRepository(tx)
    await repo.revokeAllActive(ctx.familyId, now)
    await repo.create({
      id: newId<'Invitation'>(),
      familyId: ctx.familyId,
      tokenHash: hashInvitationToken(token),
      expiresAt,
      revokedAt: null,
      createdByMemberId: ctx.memberId,
    })
  })
  return { token, expiresAt }
}
