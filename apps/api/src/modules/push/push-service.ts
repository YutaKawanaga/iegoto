import { MemberRepository, type NotificationSetting, PushRepository } from '@iegoto/db'
import type { FamilyId, MemberId, UserAccountId } from '@iegoto/domain'
import webpush from 'web-push'
import { loadEnv } from '../../config/env.js'
import type { TrpcContext } from '../../trpc.js'

export type NotificationKind = keyof NotificationSetting

export type PushPayload = {
  title: string
  body: string
  /** 通知タップで開くパス */
  url: string
}

export function isPushConfigured(): boolean {
  const env = loadEnv()
  return env.VAPID_PUBLIC_KEY !== '' && env.VAPID_PRIVATE_KEY !== ''
}

let vapidReady = false
function ensureVapid(): void {
  if (!vapidReady) {
    const env = loadEnv()
    webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY)
    vapidReady = true
  }
}

/**
 * 指定アカウント群へ Web Push を送る。
 * - 種別ごとの通知設定が OFF のアカウントには送らない
 * - 配信不能 (404/410) になった購読は掃除する
 * - 送信失敗は握りつぶす (通知は best-effort。元の操作を失敗させない)
 */
export async function sendPushToAccounts(
  db: TrpcContext['db'],
  userAccountIds: UserAccountId[],
  kind: NotificationKind,
  payload: PushPayload,
): Promise<void> {
  if (!isPushConfigured() || userAccountIds.length === 0) {
    return
  }
  ensureVapid()
  const repo = new PushRepository(db)
  const settings = await repo.getSettings(userAccountIds)
  const enabled = userAccountIds.filter((id) => settings.get(id)?.[kind] !== false)
  const subs = await repo.listSubscriptions(enabled)
  const body = JSON.stringify(payload)
  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body,
          { TTL: 60 * 60 },
        )
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) {
          await repo.deleteByEndpoint(sub.endpoint)
        }
      }
    }),
  )
}

/**
 * 家族全員 (操作した本人を除く) のログイン可能メンバーへ通知する。
 * fire-and-forget 前提: 呼び出し側は await しても失敗しない
 */
export async function notifyFamily(
  db: TrpcContext['db'],
  familyId: FamilyId,
  actorMemberId: MemberId,
  kind: NotificationKind,
  payload: PushPayload,
): Promise<void> {
  try {
    const members = await new MemberRepository(db).list(familyId)
    const accountIds = members
      .filter((m) => m.id !== actorMemberId && m.userAccountId !== null)
      .map((m) => m.userAccountId as UserAccountId)
    await sendPushToAccounts(db, accountIds, kind, payload)
  } catch {
    // 通知失敗で元の操作を失敗させない
  }
}
