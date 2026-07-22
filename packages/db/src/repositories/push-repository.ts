import type { UserAccountId } from '@iegoto/domain'
import { newId, toId } from '@iegoto/domain'
import type { Tx } from '../client.js'

export type PushSubscription = {
  userAccountId: UserAccountId
  endpoint: string
  p256dh: string
  auth: string
}

export type NotificationSetting = {
  eventCreated: boolean
  eventChanged: boolean
  reminder: boolean
}

export const DEFAULT_NOTIFICATION_SETTING: NotificationSetting = {
  eventCreated: true,
  eventChanged: true,
  reminder: true,
}

/**
 * Web Push 購読と通知設定 (F-08)。
 * 認証主体 (UserAccount) 単位のため familyId 必須ルールの例外 (07 §2)
 */
export class PushRepository {
  constructor(private readonly tx: Tx) {}

  /** 購読を保存する。同一 endpoint は所有者ごと付け替える (端末の使い回し・再ログイン対応) */
  async upsertSubscription(sub: PushSubscription): Promise<void> {
    await this.tx.pushSubscription.upsert({
      where: { endpoint: sub.endpoint },
      create: {
        id: newId<'PushSubscription'>(),
        userAccountId: sub.userAccountId,
        endpoint: sub.endpoint,
        p256dh: sub.p256dh,
        auth: sub.auth,
      },
      update: { userAccountId: sub.userAccountId, p256dh: sub.p256dh, auth: sub.auth },
    })
  }

  async deleteSubscription(userAccountId: UserAccountId, endpoint: string): Promise<void> {
    await this.tx.pushSubscription.deleteMany({ where: { userAccountId, endpoint } })
  }

  /** 配信不能 (410 Gone 等) になった購読の掃除。送信側経路のため所有者を問わない */
  async deleteByEndpoint(endpoint: string): Promise<void> {
    await this.tx.pushSubscription.deleteMany({ where: { endpoint } })
  }

  async listSubscriptions(userAccountIds: UserAccountId[]): Promise<PushSubscription[]> {
    if (userAccountIds.length === 0) {
      return []
    }
    const rows = await this.tx.pushSubscription.findMany({
      where: { userAccountId: { in: userAccountIds } },
    })
    return rows.map((row) => ({
      userAccountId: toId<'UserAccount'>(row.userAccountId),
      endpoint: row.endpoint,
      p256dh: row.p256dh,
      auth: row.auth,
    }))
  }

  async countSubscriptions(userAccountId: UserAccountId): Promise<number> {
    return this.tx.pushSubscription.count({ where: { userAccountId } })
  }

  /** 行がない = 全種別ON (デフォルト) */
  async getSetting(userAccountId: UserAccountId): Promise<NotificationSetting> {
    const row = await this.tx.notificationSetting.findUnique({ where: { userAccountId } })
    return row === null
      ? DEFAULT_NOTIFICATION_SETTING
      : { eventCreated: row.eventCreated, eventChanged: row.eventChanged, reminder: row.reminder }
  }

  async getSettings(
    userAccountIds: UserAccountId[],
  ): Promise<Map<UserAccountId, NotificationSetting>> {
    const rows = await this.tx.notificationSetting.findMany({
      where: { userAccountId: { in: userAccountIds } },
    })
    const map = new Map<UserAccountId, NotificationSetting>()
    for (const id of userAccountIds) {
      map.set(id, DEFAULT_NOTIFICATION_SETTING)
    }
    for (const row of rows) {
      map.set(toId<'UserAccount'>(row.userAccountId), {
        eventCreated: row.eventCreated,
        eventChanged: row.eventChanged,
        reminder: row.reminder,
      })
    }
    return map
  }

  async updateSetting(userAccountId: UserAccountId, setting: NotificationSetting): Promise<void> {
    await this.tx.notificationSetting.upsert({
      where: { userAccountId },
      create: { userAccountId, ...setting },
      update: setting,
    })
  }
}
