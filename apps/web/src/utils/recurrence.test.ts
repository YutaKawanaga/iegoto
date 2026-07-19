import { describe, expect, test } from 'vitest'
import { buildRRuleBody, parseRRuleBodyToForm, recurrenceSummary } from './recurrence'

const base = { weekday: 1, day: 12 } // 第2月曜

describe('buildRRuleBody', () => {
  const cases: Array<[import('./recurrence').RecurrenceForm, string | null]> = [
    [{ freq: 'none' }, null],
    [{ freq: 'daily', interval: 1, end: { type: 'never' } }, 'FREQ=DAILY'],
    [{ freq: 'daily', interval: 3, end: { type: 'never' } }, 'FREQ=DAILY;INTERVAL=3'],
    [
      { freq: 'weekly', interval: 1, weekdays: [1, 3], end: { type: 'never' } },
      'FREQ=WEEKLY;BYDAY=MO,WE',
    ],
    [
      { freq: 'weekly', interval: 2, weekdays: [], end: { type: 'count', count: 10 } },
      'FREQ=WEEKLY;INTERVAL=2;BYDAY=MO;COUNT=10',
    ],
    [{ freq: 'monthlyDate', end: { type: 'never' } }, 'FREQ=MONTHLY'],
    [{ freq: 'monthlyNth', end: { type: 'never' } }, 'FREQ=MONTHLY;BYDAY=+2MO'],
    [
      { freq: 'yearly', end: { type: 'until', date: '2027-03-31' } },
      'FREQ=YEARLY;UNTIL=20270331T235959Z',
    ],
  ]
  test.each(cases)('%j → %s', (form, expected) => {
    expect(buildRRuleBody(form, base)).toBe(expected)
  })
})

describe('parseRRuleBodyToForm (round-trip)', () => {
  test.each([
    'FREQ=DAILY',
    'FREQ=WEEKLY;BYDAY=MO,WE',
    'FREQ=WEEKLY;INTERVAL=2;BYDAY=SA;COUNT=5',
    'FREQ=MONTHLY',
    'FREQ=MONTHLY;BYDAY=+2MO',
    'FREQ=YEARLY;UNTIL=20270331T235959Z',
  ])('%s を parse → build で復元できる', (body) => {
    const form = parseRRuleBodyToForm(body)
    expect(form).not.toBeNull()
    expect(buildRRuleBody(form as NonNullable<typeof form>, base)).toBe(body)
  })

  test('null/空は「繰り返さない」', () => {
    expect(parseRRuleBodyToForm(null)).toEqual({ freq: 'none' })
  })

  test('UIサブセット外は null (カスタム扱い)', () => {
    expect(parseRRuleBodyToForm('FREQ=WEEKLY;BYDAY=+2SA')).toBeNull()
    expect(parseRRuleBodyToForm('FREQ=HOURLY')).toBeNull()
    expect(parseRRuleBodyToForm('FREQ=MONTHLY;INTERVAL=2')).toBeNull()
  })
})

describe('recurrenceSummary', () => {
  test('表示ラベル', () => {
    expect(recurrenceSummary({ freq: 'none' }, base)).toBe('繰り返さない')
    expect(
      recurrenceSummary(
        { freq: 'weekly', interval: 1, weekdays: [1, 3], end: { type: 'never' } },
        base,
      ),
    ).toBe('毎週 月・水')
    expect(recurrenceSummary({ freq: 'monthlyNth', end: { type: 'count', count: 3 } }, base)).toBe(
      '毎月第2月曜日 (3回)',
    )
  })
})
