/**
 * カレンダーの月/週グリッド計算 (F-02)。TZ 非依存の 'YYYY-MM-DD' 文字列で扱う
 * (表示は JST 固定なので、日付キーさえ合っていれば Date オブジェクトの TZ を気にしなくてよい)
 */

export type GridDay = {
  dateKey: string // 'YYYY-MM-DD'
  day: number
  inMonth: boolean
  weekday: number // 0=日
}

function toUtcDate(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00Z`)
}

export function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function addDaysKey(dateKey: string, days: number): string {
  const d = toUtcDate(dateKey)
  d.setUTCDate(d.getUTCDate() + days)
  return toDateKey(d)
}

/** 月グリッド: 日曜始まり・6週固定 (42マス)。カレンダー表示の骨格 */
export function monthGrid(year: number, month: number): GridDay[] {
  const first = new Date(Date.UTC(year, month - 1, 1))
  const startOffset = first.getUTCDay() // 日曜始まり
  const start = new Date(first)
  start.setUTCDate(1 - startOffset)
  const days: GridDay[] = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(start)
    d.setUTCDate(start.getUTCDate() + i)
    days.push({
      dateKey: toDateKey(d),
      day: d.getUTCDate(),
      inMonth: d.getUTCMonth() === month - 1,
      weekday: d.getUTCDay(),
    })
  }
  return days
}

/** 週グリッド: 指定日を含む日曜始まりの7日 */
export function weekGrid(dateKey: string): GridDay[] {
  const base = toUtcDate(dateKey)
  const start = new Date(base)
  start.setUTCDate(base.getUTCDate() - base.getUTCDay())
  const days: GridDay[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(start)
    d.setUTCDate(start.getUTCDate() + i)
    days.push({
      dateKey: toDateKey(d),
      day: d.getUTCDate(),
      inMonth: true,
      weekday: d.getUTCDay(),
    })
  }
  return days
}

/** グリッドの表示範囲 (UTC instant)。JST の日付キー範囲 → UTC 範囲に変換して API に渡す */
export function gridRangeUtc(days: GridDay[]): { start: Date; end: Date } {
  const first = days[0]
  const last = days[days.length - 1]
  if (first === undefined || last === undefined) {
    throw new Error('empty grid')
  }
  return {
    start: new Date(`${first.dateKey}T00:00:00+09:00`),
    end: new Date(`${addDaysKey(last.dateKey, 1)}T00:00:00+09:00`),
  }
}
