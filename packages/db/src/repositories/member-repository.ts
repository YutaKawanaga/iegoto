import type { FamilyId, Member, MemberColor, MemberId, UserAccountId } from '@iegoto/domain'
import { toId } from '@iegoto/domain'
import type { Tx } from '../client.js'
import type { Member as MemberRow } from '../generated/client/index.js'

function fromRow(row: MemberRow): Member {
  return {
    id: toId<'Member'>(row.id),
    familyId: toId<'Family'>(row.familyId),
    userAccountId: row.userAccountId === null ? null : toId<'UserAccount'>(row.userAccountId),
    displayName: row.displayName,
    color: row.color as MemberColor,
    sortOrder: row.sortOrder,
    deletedAt: row.deletedAt,
  }
}

export class MemberRepository {
  constructor(private readonly tx: Tx) {}

  async list(familyId: FamilyId, options?: { includeDeleted?: boolean }): Promise<Member[]> {
    const rows = await this.tx.member.findMany({
      where: {
        familyId,
        ...(options?.includeDeleted === true ? {} : { deletedAt: null }),
      },
      orderBy: { sortOrder: 'asc' },
    })
    return rows.map(fromRow)
  }

  async find(familyId: FamilyId, id: MemberId): Promise<Member | null> {
    const row = await this.tx.member.findFirst({ where: { id, familyId } })
    return row === null ? null : fromRow(row)
  }

  /**
   * ログインユーザーのテナント解決用 (familyProcedure middleware)。
   * 1ユーザー1家族 (S-7) を前提に、アクティブな所属プロフィールを返す
   */
  async findActiveByUserAccount(userAccountId: UserAccountId): Promise<Member | null> {
    const row = await this.tx.member.findFirst({
      where: { userAccountId, deletedAt: null },
    })
    return row === null ? null : fromRow(row)
  }

  async create(member: Member): Promise<void> {
    await this.tx.member.create({
      data: {
        id: member.id,
        familyId: member.familyId,
        userAccountId: member.userAccountId,
        displayName: member.displayName,
        color: member.color,
        sortOrder: member.sortOrder,
      },
    })
  }

  async update(
    familyId: FamilyId,
    id: MemberId,
    data: { displayName?: string; color?: MemberColor; sortOrder?: number },
  ): Promise<void> {
    await this.tx.member.updateMany({ where: { id, familyId, deletedAt: null }, data })
  }

  async softDelete(familyId: FamilyId, id: MemberId): Promise<void> {
    await this.tx.member.updateMany({
      where: { id, familyId },
      data: { deletedAt: new Date(), userAccountId: null },
    })
  }

  /** S-1 昇格: 既存プロフィールへログインアカウントを紐づける */
  async linkUserAccount(
    familyId: FamilyId,
    id: MemberId,
    userAccountId: UserAccountId,
  ): Promise<void> {
    await this.tx.member.updateMany({
      where: { id, familyId, deletedAt: null, userAccountId: null },
      data: { userAccountId },
    })
  }

  /** S-3 退出: 紐づけ解除のみ (プロフィール・予定は残す) */
  async unlinkUserAccount(familyId: FamilyId, id: MemberId): Promise<void> {
    await this.tx.member.updateMany({
      where: { id, familyId },
      data: { userAccountId: null },
    })
  }

  async maxSortOrder(familyId: FamilyId): Promise<number> {
    const agg = await this.tx.member.aggregate({
      where: { familyId },
      _max: { sortOrder: true },
    })
    return agg._max.sortOrder ?? 0
  }
}
