import { describe, expect, it } from 'vitest'
import { holidayName } from './holidays'

describe('holidayName', () => {
  it('祝日は名前を返す', () => {
    expect(holidayName('2026-01-01')).toBe('元日')
    expect(holidayName('2026-07-20')).toBe('海の日')
  })

  it('振替休日も返す', () => {
    // 2026-09-22 は敬老の日と秋分の日に挟まれた国民の休日
    expect(holidayName('2026-09-22')).toBe('休日')
  })

  it('平日は null', () => {
    expect(holidayName('2026-07-23')).toBeNull()
    expect(holidayName('not-a-date')).toBeNull()
  })
})
