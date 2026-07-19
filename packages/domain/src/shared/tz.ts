import { TZDate } from '@date-fns/tz'

/**
 * タイムゾーン処理 (01-spec-decisions.md S-4)
 *
 * RRULE 展開は「イベントのタイムゾーンの壁時計時刻」で行い、結果を UTC に戻す。
 * rrule ライブラリは TZ を持たない naive な Date を扱うため、
 * 「壁時計時刻のフィールドを UTC として持つ Date (= wall fake UTC)」に変換してから渡す。
 */

/** UTC 時刻 → その tz での壁時計時刻を UTC フィールドとして持つ Date */
export function utcToWall(date: Date, timezone: string): Date {
  const z = new TZDate(date, timezone)
  return new Date(
    Date.UTC(
      z.getFullYear(),
      z.getMonth(),
      z.getDate(),
      z.getHours(),
      z.getMinutes(),
      z.getSeconds(),
    ),
  )
}

/** wall fake UTC な Date → その tz の実際の UTC 時刻 */
export function wallToUtc(wall: Date, timezone: string): Date {
  const z = new TZDate(
    wall.getUTCFullYear(),
    wall.getUTCMonth(),
    wall.getUTCDate(),
    wall.getUTCHours(),
    wall.getUTCMinutes(),
    wall.getUTCSeconds(),
    timezone,
  )
  return new Date(z.getTime())
}

/** 'YYYY-MM-DD' → UTC 深夜0時の Date (終日予定の RRULE 展開・override キー用) */
export function dateStringToUtcMidnight(dateString: string): Date {
  return new Date(`${dateString}T00:00:00Z`)
}

/** UTC 深夜0時の Date → 'YYYY-MM-DD' */
export function utcMidnightToDateString(date: Date): string {
  return date.toISOString().slice(0, 10)
}
