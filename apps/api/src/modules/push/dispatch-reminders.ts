import { EventRepository } from '@iegoto/db'
import { nextReminderAt, type UserAccountId } from '@iegoto/domain'
import type { TrpcContext } from '../../trpc.js'
import { sendPushToAccounts } from './push-service.js'

const BATCH_LIMIT = 100

/**
 * リマインダー配信ジョブ (F-08。/jobs/dispatch-reminders から実行)。
 * next_reminder_at が期限到来した予定を拾い、対象メンバーのアカウントへ push を送り、
 * 次回のリマインダー時刻を再計算して保存する。
 * 起動は GitHub Actions のスケジュール実行 (5分間隔) を想定
 */
export async function dispatchDueReminders(
  db: TrpcContext['db'],
  now: Date,
): Promise<{ dispatched: number }> {
  const repo = new EventRepository(db)
  const due = await repo.listDueRemindersForJob(now, BATCH_LIMIT)
  let dispatched = 0
  for (const { event, overrides } of due) {
    // 対象メンバーのログインアカウントへ通知 (対象が空なら家族全員ではなく誰にも送らない)
    const memberRows = await db.member.findMany({
      where: { id: { in: event.targetMemberIds }, userAccountId: { not: null } },
      select: { userAccountId: true },
    })
    const accountIds = memberRows.map((r) => r.userAccountId as UserAccountId)
    await sendPushToAccounts(db, accountIds, 'reminder', {
      title: 'まもなく予定の時間です',
      body: `「${event.title}」のリマインダー`,
      url: '/calendar',
    })
    // 次回分を再計算 (今回発火した分より後)。null なら以後の発火なし
    const next = nextReminderAt(event, overrides, new Date(now.getTime() + 60_000))
    await repo.updateNextReminderAt(event.id, next)
    dispatched++
  }
  return { dispatched }
}
