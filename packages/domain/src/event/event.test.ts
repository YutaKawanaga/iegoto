import { describe, expect, it } from 'vitest'
import { InvalidEventTimeError, InvalidRecurrenceRuleError } from '../shared/errors.js'
import { newId } from '../shared/id.js'
import { createEvent, eventDurationMs, eventStartInstant } from './event.js'

const familyId = newId<'Family'>()
const memberId = newId<'Member'>()

const base = {
  familyId,
  title: '水泳教室',
  time: {
    kind: 'timed' as const,
    startAt: new Date('2026-01-10T01:00:00Z'),
    endAt: new Date('2026-01-10T02:00:00Z'),
    timezone: 'Asia/Tokyo',
  },
  targetMemberIds: [memberId],
  createdByMemberId: memberId,
}

describe('createEvent', () => {
  it('タイトルを trim し、対象メンバーを重複排除する', () => {
    const event = createEvent({
      ...base,
      title: '  水泳教室  ',
      targetMemberIds: [memberId, memberId],
    })
    expect(event.title).toBe('水泳教室')
    expect(event.targetMemberIds).toEqual([memberId])
  })

  it('空タイトルは拒否する', () => {
    expect(() => createEvent({ ...base, title: '   ' })).toThrow(InvalidEventTimeError)
  })

  it('終了 <= 開始の時刻は拒否する', () => {
    expect(() =>
      createEvent({
        ...base,
        time: { ...base.time, endAt: base.time.startAt },
      }),
    ).toThrow(InvalidEventTimeError)
  })

  it('終日予定: 終了日 < 開始日は拒否する', () => {
    expect(() =>
      createEvent({
        ...base,
        time: { kind: 'allDay', startDate: '2026-01-10', endDate: '2026-01-09' },
      }),
    ).toThrow(InvalidEventTimeError)
  })

  it('不正な RRULE は拒否し、正常な RRULE は recurrenceEndAt を事前計算する', () => {
    expect(() => createEvent({ ...base, rrule: 'ざつおん' })).toThrow(InvalidRecurrenceRuleError)
    const infinite = createEvent({ ...base, rrule: 'FREQ=WEEKLY;BYDAY=SA' })
    expect(infinite.recurrenceEndAt).toBeNull()
    const counted = createEvent({ ...base, rrule: 'FREQ=WEEKLY;BYDAY=SA;COUNT=2' })
    expect(counted.recurrenceEndAt).not.toBeNull()
  })
})

describe('eventStartInstant / eventDurationMs', () => {
  it('timed は startAt / 実時間差', () => {
    const event = createEvent(base)
    expect(eventStartInstant(event).toISOString()).toBe('2026-01-10T01:00:00.000Z')
    expect(eventDurationMs(event)).toBe(60 * 60 * 1000)
  })

  it('終日は UTC 深夜0時起点 / 日数 × 24h', () => {
    const event = createEvent({
      ...base,
      time: { kind: 'allDay', startDate: '2026-01-10', endDate: '2026-01-11' },
    })
    expect(eventStartInstant(event).toISOString()).toBe('2026-01-10T00:00:00.000Z')
    expect(eventDurationMs(event)).toBe(2 * 24 * 60 * 60 * 1000)
  })
})
