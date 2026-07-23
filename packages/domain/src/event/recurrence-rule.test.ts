import { describe, expect, it } from 'vitest'
import { InvalidRecurrenceRuleError } from '../shared/errors.js'
import { utcToWall } from '../shared/tz.js'
import type { EventTime } from './event.js'
import {
  buildRule,
  computeRecurrenceEndAt,
  parseRRuleBody,
  truncateRRuleBefore,
} from './recurrence-rule.js'

const TIMED: EventTime = {
  kind: 'timed',
  startAt: new Date('2026-01-03T01:00:00Z'), // JST 土曜 10:00
  endAt: new Date('2026-01-03T02:00:00Z'),
  timezone: 'Asia/Tokyo',
}

describe('parseRRuleBody', () => {
  it('正常な RRULE をパースできる', () => {
    expect(parseRRuleBody('FREQ=WEEKLY;BYDAY=SA').freq).toBeDefined()
  })

  it('FREQ がない・壊れた文字列は InvalidRecurrenceRuleError', () => {
    expect(() => parseRRuleBody('BYDAY=SA')).toThrow(InvalidRecurrenceRuleError)
    expect(() => parseRRuleBody('こわれてる')).toThrow(InvalidRecurrenceRuleError)
  })
})

describe('computeRecurrenceEndAt', () => {
  it('無期限 (UNTIL/COUNT なし) は null', () => {
    expect(computeRecurrenceEndAt('FREQ=WEEKLY;BYDAY=SA', TIMED)).toBeNull()
  })

  it('COUNT=3 の最終回の終了時刻 (UTC) を返す', () => {
    // 1/3, 1/10, 1/17 (JST 土曜10:00-11:00) → 最終回終了 = 1/17 JST 11:00 = UTC 02:00
    const end = computeRecurrenceEndAt('FREQ=WEEKLY;BYDAY=SA;COUNT=3', TIMED)
    expect(end?.toISOString()).toBe('2026-01-17T02:00:00.000Z')
  })
})

describe('truncateRRuleBefore (これ以降すべて編集の分割)', () => {
  it('指定回の直前で終わる UNTIL 付き RRULE になる', () => {
    // 1/17 の回で分割 → 元マスタは 1/3, 1/10 のみ
    const splitWall = utcToWall(new Date('2026-01-17T01:00:00Z'), 'Asia/Tokyo')
    const truncated = truncateRRuleBefore('FREQ=WEEKLY;BYDAY=SA', splitWall)
    const rule = buildRule(truncated, TIMED)
    const all = rule.all()
    expect(all).toHaveLength(2)
    expect(all[1]?.toISOString().slice(0, 10)).toBe('2026-01-10')
  })
})
