import { PushRepository } from '@iegoto/db'
import { loadEnv } from '../../../config/env.js'
import type { FamilyContext } from '../../../trpc.js'
import { isPushConfigured } from '../push-service.js'

/** F-08 Web Push の購読・設定管理。純 CRUD のため1ファイル集約 (07 §3) */

export async function getPushStatus(ctx: FamilyContext) {
  const repo = new PushRepository(ctx.db)
  return {
    configured: isPushConfigured(),
    publicKey: loadEnv().VAPID_PUBLIC_KEY,
    subscriptionCount: await repo.countSubscriptions(ctx.userAccountId),
    setting: await repo.getSetting(ctx.userAccountId),
  }
}

export async function subscribePush(
  ctx: FamilyContext,
  input: { endpoint: string; p256dh: string; auth: string },
) {
  await new PushRepository(ctx.db).upsertSubscription({
    userAccountId: ctx.userAccountId,
    ...input,
  })
}

export async function unsubscribePush(ctx: FamilyContext, input: { endpoint: string }) {
  await new PushRepository(ctx.db).deleteSubscription(ctx.userAccountId, input.endpoint)
}

export async function updateNotificationSetting(
  ctx: FamilyContext,
  input: { eventCreated: boolean; eventChanged: boolean; reminder: boolean },
) {
  await new PushRepository(ctx.db).updateSetting(ctx.userAccountId, input)
}
