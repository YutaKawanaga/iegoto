import { describe, expect, test } from 'vitest'
import { gridRangeUtc, monthGrid, weekGrid } from './calendar-grid'

describe('monthGrid', () => {
  test('2026年1月: 6週42マス・日曜始まり・月内フラグ', () => {
    const grid = monthGrid(2026, 1)
    expect(grid).toHaveLength(42)
    // 2026-01-01 は木曜 → グリッドは 2025-12-28(日) から
    expect(grid[0]?.dateKey).toBe('2025-12-28')
    expect(grid[0]?.weekday).toBe(0)
    expect(grid[0]?.inMonth).toBe(false)
    expect(grid[4]?.dateKey).toBe('2026-01-01')
    expect(grid[4]?.inMonth).toBe(true)
    expect(grid[41]?.dateKey).toBe('2026-02-07')
  })

  test('うるう年2月 (2028)', () => {
    const grid = monthGrid(2028, 2)
    expect(grid.filter((d) => d.inMonth)).toHaveLength(29)
  })
})

describe('weekGrid', () => {
  test('水曜を渡すとその週の日曜からの7日を返す', () => {
    const grid = weekGrid('2026-01-07')
    expect(grid[0]?.dateKey).toBe('2026-01-04')
    expect(grid[6]?.dateKey).toBe('2026-01-10')
    expect(grid).toHaveLength(7)
  })
})

describe('gridRangeUtc', () => {
  test('JST 日付範囲を UTC instant に変換する (末日は翌日0時JSTまで)', () => {
    const grid = weekGrid('2026-01-04')
    const range = gridRangeUtc(grid)
    // JST 1/4 00:00 = UTC 1/3 15:00
    expect(range.start.toISOString()).toBe('2026-01-03T15:00:00.000Z')
    expect(range.end.toISOString()).toBe('2026-01-10T15:00:00.000Z')
  })
})
