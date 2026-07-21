import { describe, expect, test } from 'vitest'
import { normalizeTitle, rankSuggestions } from './suggest.js'

describe('normalizeTitle', () => {
  test.each([
    ['水泳教室', '水泳教室'],
    ['  Swimming  Class ', 'swimming class'],
    ['ピアノ（発表会）', 'ピアノ(発表会)'], // NFKC で全角括弧→半角
    ['ＡＢＣ教室', 'abc教室'], // 全角英字→半角小文字
  ])('%s → %s', (input, expected) => {
    expect(normalizeTitle(input)).toBe(expected)
  })
})

describe('rankSuggestions', () => {
  const candidates = [
    { normalizedTitle: '水泳教室', lastUsedAt: new Date('2026-01-01'), payload: 'a' },
    { normalizedTitle: '水泳教室', lastUsedAt: new Date('2026-02-01'), payload: 'a-new' },
    { normalizedTitle: '水泳大会', lastUsedAt: new Date('2026-01-15'), payload: 'b' },
    { normalizedTitle: '市民水泳センター', lastUsedAt: new Date('2026-03-01'), payload: 'c' },
    { normalizedTitle: 'ピアノ', lastUsedAt: new Date('2026-01-20'), payload: 'd' },
  ]

  test('前方一致が部分一致より優先され、同一タイトルは最新に集約される', () => {
    expect(rankSuggestions('水泳', candidates)).toEqual(['a-new', 'b', 'c'])
  })

  test('部分一致のみでもヒットする', () => {
    expect(rankSuggestions('センター', candidates)).toEqual(['c'])
  })

  test('ヒットなし・空入力は空配列', () => {
    expect(rankSuggestions('サッカー', candidates)).toEqual([])
    expect(rankSuggestions('  ', candidates)).toEqual([])
  })

  test('最大件数で打ち切られる', () => {
    const many = Array.from({ length: 10 }, (_, i) => ({
      normalizedTitle: `習い事${i}`,
      lastUsedAt: new Date(2026, 0, i + 1),
      payload: i,
    }))
    expect(rankSuggestions('習い事', many)).toHaveLength(5)
  })
})
