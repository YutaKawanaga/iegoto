import { describe, expect, test } from 'vitest'
import { formatEventTimeLabel, formatTime, jstDateKey } from './date-format'

describe('date-format (Asia/Tokyo 固定表示。S-4)', () => {
  test('formatTime: UTC を JST で表示する', () => {
    expect(formatTime(new Date('2026-01-05T07:00:00Z'))).toBe('16:00')
  })

  test('jstDateKey: UTC 深夜は JST では翌日になる', () => {
    expect(jstDateKey(new Date('2026-01-05T16:00:00Z'))).toBe('2026-01-06')
    expect(jstDateKey(new Date('2026-01-05T07:00:00Z'))).toBe('2026-01-05')
  })

  test('formatEventTimeLabel: 終日と時間指定', () => {
    expect(
      formatEventTimeLabel({ kind: 'allDay', startDate: '2026-01-05', endDate: '2026-01-05' }),
    ).toBe('終日')
    expect(
      formatEventTimeLabel({
        kind: 'timed',
        startAt: new Date('2026-01-05T07:00:00Z'),
        endAt: new Date('2026-01-05T08:30:00Z'),
        timezone: 'Asia/Tokyo',
      }),
    ).toBe('16:00〜17:30')
  })
})
