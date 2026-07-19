import { describe, expect, test } from 'vitest'
import { toId } from '../shared/id.js'
import { createEvent } from './event.js'
import type { EventOverride } from './override.js'
import { nextReminderAt } from './reminder.js'

const familyId = toId<'Family'>('f-1')
const memberA = toId<'Member'>('m-a')

describe('nextReminderAt', () => {
  test('単発予定: 開始30分前を返す', () => {
    const event = createEvent({
      familyId,
      title: '面談',
      time: {
        kind: 'timed',
        startAt: new Date('2026-01-05T07:00:00Z'),
        endAt: new Date('2026-01-05T08:00:00Z'),
        timezone: 'Asia/Tokyo',
      },
      targetMemberIds: [],
      reminderMinutesBefore: 30,
      createdByMemberId: memberA,
    })
    expect(nextReminderAt(event, [], new Date('2026-01-01T00:00:00Z'))?.toISOString()).toBe(
      '2026-01-05T06:30:00.000Z',
    )
  })

  test('過ぎた回はスキップして次回を返す (繰り返し)', () => {
    const event = createEvent({
      familyId,
      title: '水泳教室',
      time: {
        kind: 'timed',
        startAt: new Date('2026-01-05T07:00:00Z'),
        endAt: new Date('2026-01-05T08:00:00Z'),
        timezone: 'Asia/Tokyo',
      },
      rrule: 'FREQ=WEEKLY;BYDAY=MO',
      targetMemberIds: [],
      reminderMinutesBefore: 60,
      createdByMemberId: memberA,
    })
    // 1/5 の発火 (06:00) 直後 → 次は 1/12 06:00
    expect(nextReminderAt(event, [], new Date('2026-01-05T06:00:00Z'))?.toISOString()).toBe(
      '2026-01-12T06:00:00.000Z',
    )
  })

  test('キャンセルされた回は飛ばす', () => {
    const event = createEvent({
      familyId,
      title: '水泳教室',
      time: {
        kind: 'timed',
        startAt: new Date('2026-01-05T07:00:00Z'),
        endAt: new Date('2026-01-05T08:00:00Z'),
        timezone: 'Asia/Tokyo',
      },
      rrule: 'FREQ=WEEKLY;BYDAY=MO',
      targetMemberIds: [],
      reminderMinutesBefore: 60,
      createdByMemberId: memberA,
    })
    const cancel: EventOverride = {
      id: toId<'EventOverride'>('o-1'),
      eventId: event.id,
      originalStartAt: new Date('2026-01-12T07:00:00Z'),
      isCancelled: true,
      patch: {},
    }
    expect(nextReminderAt(event, [cancel], new Date('2026-01-05T06:00:00Z'))?.toISOString()).toBe(
      '2026-01-19T06:00:00.000Z',
    )
  })

  test('リマインダー未設定・終了済みは null', () => {
    const noReminder = createEvent({
      familyId,
      title: 'x',
      time: {
        kind: 'timed',
        startAt: new Date('2026-01-05T07:00:00Z'),
        endAt: new Date('2026-01-05T08:00:00Z'),
        timezone: 'Asia/Tokyo',
      },
      targetMemberIds: [],
      createdByMemberId: memberA,
    })
    expect(nextReminderAt(noReminder, [], new Date('2026-01-01T00:00:00Z'))).toBeNull()

    const ended = createEvent({
      familyId,
      title: 'x',
      time: {
        kind: 'timed',
        startAt: new Date('2026-01-05T07:00:00Z'),
        endAt: new Date('2026-01-05T08:00:00Z'),
        timezone: 'Asia/Tokyo',
      },
      rrule: 'FREQ=WEEKLY;COUNT=2',
      targetMemberIds: [],
      reminderMinutesBefore: 10,
      createdByMemberId: memberA,
    })
    expect(nextReminderAt(ended, [], new Date('2026-06-01T00:00:00Z'))).toBeNull()
  })
})
