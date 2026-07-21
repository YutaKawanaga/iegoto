import type { SessionId, UserAccountId } from '@iegoto/domain'
import { toId } from '@iegoto/domain'
import type { Tx } from '../client.js'

export type Session = {
  id: SessionId
  userAccountId: UserAccountId
  expiresAt: Date
}

/** DB セッション (07 §8)。即時失効を可能にするためクッキー完結にしない */
export class SessionRepository {
  constructor(private readonly tx: Tx) {}

  async create(session: Session): Promise<void> {
    await this.tx.session.create({
      data: {
        id: session.id,
        userAccountId: session.userAccountId,
        expiresAt: session.expiresAt,
      },
    })
  }

  async findValid(id: SessionId, now: Date): Promise<Session | null> {
    const row = await this.tx.session.findUnique({ where: { id } })
    if (row === null || row.expiresAt.getTime() <= now.getTime()) {
      return null
    }
    return {
      id: toId<'Session'>(row.id),
      userAccountId: toId<'UserAccount'>(row.userAccountId),
      expiresAt: row.expiresAt,
    }
  }

  /** スライディング更新 (30日) */
  async extend(id: SessionId, expiresAt: Date): Promise<void> {
    await this.tx.session.updateMany({ where: { id }, data: { expiresAt } })
  }

  async delete(id: SessionId): Promise<void> {
    await this.tx.session.deleteMany({ where: { id } })
  }

  /** 全端末ログアウト (端末紛失時) */
  async deleteAllForUser(userAccountId: UserAccountId): Promise<void> {
    await this.tx.session.deleteMany({ where: { userAccountId } })
  }
}
