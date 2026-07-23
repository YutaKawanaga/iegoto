import { describe, expect, it } from 'vitest'
import { laneCount, layoutWeekSegments, type MultiDayItem } from './multi-day-layout'

// 2026-01-04(日) 始まりの週
const WEEK = [
  '2026-01-04',
  '2026-01-05',
  '2026-01-06',
  '2026-01-07',
  '2026-01-08',
  '2026-01-09',
  '2026-01-10',
]

function item(key: string, startKey: string, endKey: string): MultiDayItem {
  return { key, startKey, endKey }
}

describe('layoutWeekSegments', () => {
  it('週内に収まる予定は開始・終了列がそのまま入り、両端が角丸になる', () => {
    const segs = layoutWeekSegments(WEEK, [item('a', '2026-01-05', '2026-01-07')])
    expect(segs).toEqual([
      { key: 'a', startIdx: 1, endIdx: 3, continuesLeft: false, continuesRight: false, lane: 0 },
    ])
  })

  it('前週から続く予定は列0開始 + continuesLeft、次週へ続く予定は列6終了 + continuesRight', () => {
    const segs = layoutWeekSegments(WEEK, [
      item('cross-in', '2026-01-01', '2026-01-06'),
      item('cross-out', '2026-01-09', '2026-01-15'),
    ])
    expect(segs.find((s) => s.key === 'cross-in')).toMatchObject({
      startIdx: 0,
      endIdx: 2,
      continuesLeft: true,
      continuesRight: false,
    })
    expect(segs.find((s) => s.key === 'cross-out')).toMatchObject({
      startIdx: 5,
      endIdx: 6,
      continuesLeft: false,
      continuesRight: true,
    })
  })

  it('週と重ならない予定は含めない', () => {
    const segs = layoutWeekSegments(WEEK, [
      item('before', '2025-12-28', '2026-01-03'),
      item('after', '2026-01-11', '2026-01-13'),
    ])
    expect(segs).toEqual([])
  })

  it('重なる予定は別レーンに積み、重ならなければ同じレーンを再利用する', () => {
    const segs = layoutWeekSegments(WEEK, [
      item('a', '2026-01-04', '2026-01-06'),
      item('b', '2026-01-05', '2026-01-07'), // a と重なる → lane 1
      item('c', '2026-01-08', '2026-01-09'), // a の後 → lane 0 再利用
    ])
    const byKey = new Map(segs.map((s) => [s.key, s.lane]))
    expect(byKey.get('a')).toBe(0)
    expect(byKey.get('b')).toBe(1)
    expect(byKey.get('c')).toBe(0)
  })

  it('週全体を覆う予定は列0〜6で両側 continues', () => {
    const segs = layoutWeekSegments(WEEK, [item('long', '2025-12-25', '2026-02-01')])
    expect(segs[0]).toMatchObject({
      startIdx: 0,
      endIdx: 6,
      continuesLeft: true,
      continuesRight: true,
    })
  })
})

describe('laneCount', () => {
  it('使用レーン数を返し、cap で頭打ちにする', () => {
    const segs = layoutWeekSegments(WEEK, [
      item('a', '2026-01-04', '2026-01-10'),
      item('b', '2026-01-04', '2026-01-10'),
      item('c', '2026-01-04', '2026-01-10'),
      item('d', '2026-01-04', '2026-01-10'),
    ])
    expect(laneCount(segs, 3)).toBe(3)
    expect(laneCount([], 3)).toBe(0)
  })
})
