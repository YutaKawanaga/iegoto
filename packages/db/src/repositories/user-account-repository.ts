import type { UserAccountId } from '@iegoto/domain'
import { newId, toId } from '@iegoto/domain'
import type { Tx } from '../client.js'

export type UserAccount = {
  id: UserAccountId
  googleSub: string
  email: string
  displayName: string
  avatarUrl: string | null
}

/** 家族非依存の認証主体。familyId 必須ルールの例外 (07 §2) */
export class UserAccountRepository {
  constructor(private readonly tx: Tx) {}

  async find(id: UserAccountId): Promise<UserAccount | null> {
    const row = await this.tx.userAccount.findUnique({ where: { id } })
    return row === null ? null : this.fromRow(row)
  }

  async upsertByGoogleSub(input: {
    googleSub: string
    email: string
    displayName: string
    avatarUrl: string | null
  }): Promise<UserAccount> {
    const row = await this.tx.userAccount.upsert({
      where: { googleSub: input.googleSub },
      create: { id: newId<'UserAccount'>(), ...input },
      update: { email: input.email, displayName: input.displayName, avatarUrl: input.avatarUrl },
    })
    return this.fromRow(row)
  }

  private fromRow(row: {
    id: string
    googleSub: string
    email: string
    displayName: string
    avatarUrl: string | null
  }): UserAccount {
    return {
      id: toId<'UserAccount'>(row.id),
      googleSub: row.googleSub,
      email: row.email,
      displayName: row.displayName,
      avatarUrl: row.avatarUrl,
    }
  }
}
