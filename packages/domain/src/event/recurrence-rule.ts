// rrule は CJS のため Node ESM では named import できない (default 経由で取り出す)

import type { RRule as RRuleClass } from 'rrule'
import rrulePkg from 'rrule'
import { InvalidRecurrenceRuleError } from '../shared/errors.js'

const { RRule } = rrulePkg

import { utcToWall, wallToUtc } from '../shared/tz.js'
import { type EventTime, eventDurationMs } from './event.js'

/** 安全弁: 1マスタあたりの最大展開数 (03-domain-model.md §3) */
export const MAX_OCCURRENCES = 1000

export function parseRRuleBody(body: string): ReturnType<typeof RRule.parseString> {
  try {
    const options = RRule.parseString(body)
    if (options.freq === undefined) {
      throw new Error('FREQ がありません')
    }
    return options
  } catch (e) {
    throw new InvalidRecurrenceRuleError(
      `繰り返しルールが不正です: ${e instanceof Error ? e.message : String(e)}`,
    )
  }
}

/**
 * マスタの開始を dtstart とした RRule を構築する。
 * dtstart は「イベント TZ の壁時計時刻を UTC フィールドに持つ Date」(wall fake UTC)。
 * S-4: 展開はローカル時刻で行い UTC に戻す方式の中核
 */
export function buildRule(rruleBody: string, time: EventTime): RRuleClass {
  const options = parseRRuleBody(rruleBody)
  const dtstart =
    time.kind === 'timed'
      ? utcToWall(time.startAt, time.timezone)
      : new Date(`${time.startDate}T00:00:00Z`)
  return new RRule({ ...options, dtstart })
}

/**
 * RRULE の UNTIL / COUNT から実際の最終回の「終了時刻 (UTC)」を事前計算する。
 * 無期限は null。event テーブルの recurrence_end_at に保存し期間クエリの絞り込みに使う
 */
export function computeRecurrenceEndAt(rruleBody: string, time: EventTime): Date | null {
  const options = parseRRuleBody(rruleBody)
  if (options.until == null && options.count == null) {
    return null
  }
  const rule = buildRule(rruleBody, time)
  const all = rule.all((_, i) => i < MAX_OCCURRENCES)
  const last = all[all.length - 1]
  if (last === undefined) {
    return null
  }
  const lastStartUtc = time.kind === 'timed' ? wallToUtc(last, time.timezone) : last
  return new Date(lastStartUtc.getTime() + eventDurationMs({ time }))
}

/**
 * 「これ以降すべて」編集のマスタ分割用: 指定回の直前で終わるように UNTIL を設定した
 * RRULE 本文を返す (03 §3。UNTIL は wall fake UTC の1秒前)
 */
export function truncateRRuleBefore(rruleBody: string, splitWallStart: Date): string {
  const options = parseRRuleBody(rruleBody)
  const until = new Date(splitWallStart.getTime() - 1000)
  const truncated = new RRule({ ...options, count: null, until })
  // RRule.toString() は DTSTART 行を含みうるため、RRULE 本文部分のみ取り出す
  return optionsToBody(truncated)
}

function optionsToBody(rule: RRuleClass): string {
  const str = rule.toString()
  const line = str.split('\n').find((l) => l.startsWith('RRULE:'))
  return (line ?? str).replace(/^RRULE:/, '')
}
