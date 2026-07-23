import { describe, expect, it } from 'vitest'
import { dateStringToUtcMidnight, utcMidnightToDateString, utcToWall, wallToUtc } from './tz.js'

describe('tz (S-4 壁時計変換)', () => {
  it('utcToWall: UTC 01:00 は JST の壁時計 10:00 になる', () => {
    const wall = utcToWall(new Date('2026-01-10T01:00:00Z'), 'Asia/Tokyo')
    expect(wall.toISOString()).toBe('2026-01-10T10:00:00.000Z')
  })

  it('wallToUtc: JST 壁時計 10:00 は UTC 01:00 に戻る', () => {
    const utc = wallToUtc(new Date('2026-01-10T10:00:00Z'), 'Asia/Tokyo')
    expect(utc.toISOString()).toBe('2026-01-10T01:00:00.000Z')
  })

  it('utcToWall → wallToUtc はラウンドトリップする', () => {
    const original = new Date('2026-07-23T15:30:00Z')
    for (const tz of ['Asia/Tokyo', 'America/New_York', 'UTC']) {
      expect(wallToUtc(utcToWall(original, tz), tz).getTime()).toBe(original.getTime())
    }
  })

  it('日付境界: UTC 23:00 は JST では翌日になる', () => {
    const wall = utcToWall(new Date('2026-01-10T23:00:00Z'), 'Asia/Tokyo')
    expect(wall.toISOString().slice(0, 10)).toBe('2026-01-11')
  })

  it('dateStringToUtcMidnight / utcMidnightToDateString がラウンドトリップする', () => {
    const date = dateStringToUtcMidnight('2026-02-28')
    expect(date.toISOString()).toBe('2026-02-28T00:00:00.000Z')
    expect(utcMidnightToDateString(date)).toBe('2026-02-28')
  })
})
