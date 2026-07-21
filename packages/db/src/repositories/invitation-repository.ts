import type { FamilyId, Invitation, InvitationId } from '@iegoto/domain'
import { toId } from '@iegoto/domain'
import type { Tx } from '../client.js'
import type { Invitation as InvitationRow } from '../generated/client/index.js'

function fromRow(row: InvitationRow): Invitation {
  return {
    id: toId<'Invitation'>(row.id),
    familyId: toId<'Family'>(row.familyId),
    tokenHash: row.tokenHash,
    expiresAt: row.expiresAt,
    revokedAt: row.revokedAt,
    createdByMemberId: toId<'Member'>(row.createdByMemberId),
  }
}

export class InvitationRepository {
  constructor(private readonly tx: Tx) {}

  /** 家族の現在有効な招待 (S-2: 同時有効は最大1本) */
  async findActive(familyId: FamilyId, now: Date): Promise<Invitation | null> {
    const row = await this.tx.invitation.findFirst({
      where: { familyId, revokedAt: null, expiresAt: { gt: now } },
      orderBy: { createdAt: 'desc' },
    })
    return row === null ? null : fromRow(row)
  }

  /**
   * トークンハッシュによる参照。トークン自体が資格情報のため familyId スコープを取らない
   * (未参加ユーザーの合流経路。07 §2 の明示的例外)
   */
  async findByTokenHash(tokenHash: string): Promise<Invitation | null> {
    const row = await this.tx.invitation.findUnique({ where: { tokenHash } })
    return row === null ? null : fromRow(row)
  }

  async create(invitation: Invitation): Promise<void> {
    await this.tx.invitation.create({
      data: {
        id: invitation.id,
        familyId: invitation.familyId,
        tokenHash: invitation.tokenHash,
        expiresAt: invitation.expiresAt,
        createdByMemberId: invitation.createdByMemberId,
      },
    })
  }

  /** 新規発行時の旧リンク自動失効・手動失効 (S-2) */
  async revokeAllActive(familyId: FamilyId, now: Date): Promise<void> {
    await this.tx.invitation.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: now },
    })
  }

  async revoke(familyId: FamilyId, id: InvitationId, now: Date): Promise<void> {
    await this.tx.invitation.updateMany({
      where: { id, familyId },
      data: { revokedAt: now },
    })
  }
}
