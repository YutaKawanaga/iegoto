import type { Event } from './event.js'
import { expandEvent, type Occurrence, startInstantOf } from './expand.js'
import type { EventOverride } from './override.js'

/** リマインダー探索の上限 (無期限の繰り返しでも2年先まで見れば十分) */
const SEARCH_HORIZON_MS = 2 * 365 * 24 * 60 * 60 * 1000

/**
 * `after` より後で次にリマインダーを発火すべき時刻 (UTC) を返す。なければ null。
 * event.next_reminder_at の事前計算に使う (03 §4 dispatchReminders。
 * 書き込み時と発火後に呼び、毎分の全件 RRULE 展開を避ける)
 */
export function nextReminderAt(event: Event, overrides: EventOverride[], after: Date): Date | null {
  const minutes = event.reminderMinutesBefore
  if (minutes === null) {
    return null
  }
  const offsetMs = minutes * 60 * 1000
  // 発火時刻 > after ⇔ 開始時刻 > after + offset
  const range = {
    start: new Date(after.getTime() + offsetMs),
    end: new Date(after.getTime() + offsetMs + SEARCH_HORIZON_MS),
  }
  const occurrences = expandEvent(event, overrides, range)
  for (const occ of occurrences) {
    const fireAt = reminderFireAt(occ, offsetMs)
    if (fireAt !== null && fireAt.getTime() > after.getTime()) {
      return fireAt
    }
  }
  return null
}

function reminderFireAt(occ: Occurrence, offsetMs: number): Date | null {
  // 終日予定のリマインダーは MVP 対象外 (開始時刻が定まらないため)。timed のみ
  if (occ.time.kind !== 'timed') {
    return null
  }
  return new Date(startInstantOf(occ).getTime() - offsetMs)
}
