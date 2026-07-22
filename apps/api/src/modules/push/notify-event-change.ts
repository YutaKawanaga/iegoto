import { EventRepository, MemberRepository } from '@iegoto/db'
import { toId } from '@iegoto/domain'
import type { FamilyContext } from '../../trpc.js'
import { notifyFamily } from './push-service.js'

/**
 * 予定の変更/削除ミューテーションを包んで、成功時に家族へ通知する (F-08)。
 * タイトルは削除後に引けないため実行前に取得しておく
 */
export async function withEventChangeNotification(
  ctx: FamilyContext,
  eventId: string,
  action: '変更' | '削除',
  run: () => Promise<void>,
): Promise<void> {
  const found = await new EventRepository(ctx.db).find(ctx.familyId, toId<'Event'>(eventId))
  await run()
  const actor = await new MemberRepository(ctx.db).find(ctx.familyId, ctx.memberId)
  await notifyFamily(ctx.db, ctx.familyId, ctx.memberId, 'eventChanged', {
    title: `予定が${action}されました`,
    body: `${actor?.displayName ?? '家族'}が「${found?.event.title ?? '予定'}」を${action}しました`,
    url: '/calendar',
  })
}
