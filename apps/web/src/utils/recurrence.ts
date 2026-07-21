/**
 * 繰り返し設定フォーム ⇔ RRULE 本文の変換 (F-03)。
 * UI が生成する RRULE のサブセットのみ扱う。手入力等の未対応パターンは parse で null を返し、
 * フォームは「カスタム (変更不可)」表示にフォールバックする
 */

export const WEEKDAY_CODES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'] as const
export const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'] as const

export type RecurrenceEnd =
  | { type: 'never' }
  | { type: 'until'; date: string } // 'YYYY-MM-DD' (JST)
  | { type: 'count'; count: number }

export type RecurrenceForm =
  | { freq: 'none' }
  | { freq: 'daily'; interval: number; end: RecurrenceEnd }
  | { freq: 'weekly'; interval: number; weekdays: number[]; end: RecurrenceEnd }
  | { freq: 'monthlyDate'; end: RecurrenceEnd }
  | { freq: 'monthlyNth'; end: RecurrenceEnd }
  | { freq: 'yearly'; end: RecurrenceEnd }

/** 開始日の情報 (BYDAY の第n曜日はここから計算) */
export type BaseDate = { weekday: number; day: number }

export function buildRRuleBody(form: RecurrenceForm, base: BaseDate): string | null {
  if (form.freq === 'none') {
    return null
  }
  const parts: string[] = []
  if (form.freq === 'daily') {
    parts.push('FREQ=DAILY')
    if (form.interval > 1) parts.push(`INTERVAL=${form.interval}`)
  } else if (form.freq === 'weekly') {
    parts.push('FREQ=WEEKLY')
    if (form.interval > 1) parts.push(`INTERVAL=${form.interval}`)
    const days = form.weekdays.length > 0 ? form.weekdays : [base.weekday]
    parts.push(
      `BYDAY=${[...days]
        .sort((a, b) => a - b)
        .map((d) => WEEKDAY_CODES[d])
        .join(',')}`,
    )
  } else if (form.freq === 'monthlyDate') {
    parts.push('FREQ=MONTHLY')
  } else if (form.freq === 'monthlyNth') {
    const nth = Math.ceil(base.day / 7)
    parts.push('FREQ=MONTHLY', `BYDAY=+${nth}${WEEKDAY_CODES[base.weekday]}`)
  } else {
    parts.push('FREQ=YEARLY')
  }
  const end = form.end
  if (end.type === 'until') {
    parts.push(`UNTIL=${end.date.replaceAll('-', '')}T235959Z`)
  } else if (end.type === 'count') {
    parts.push(`COUNT=${end.count}`)
  }
  return parts.join(';')
}

export function parseRRuleBodyToForm(body: string | null): RecurrenceForm | null {
  if (body === null || body === '') {
    return { freq: 'none' }
  }
  const map = new Map<string, string>()
  for (const part of body.split(';')) {
    const [k, v] = part.split('=')
    if (k !== undefined && v !== undefined) {
      map.set(k.toUpperCase(), v)
    }
  }
  const freq = map.get('FREQ')
  const interval = Number(map.get('INTERVAL') ?? '1')
  const end = parseEnd(map)
  if (end === null || Number.isNaN(interval)) {
    return null
  }
  if (freq === 'DAILY') {
    return { freq: 'daily', interval, end }
  }
  if (freq === 'WEEKLY') {
    const byday = map.get('BYDAY')
    const weekdays =
      byday === undefined
        ? []
        : byday.split(',').map((c) => WEEKDAY_CODES.indexOf(c as (typeof WEEKDAY_CODES)[number]))
    if (weekdays.includes(-1)) {
      return null // +2SA のような nth 付き weekly は未対応
    }
    return { freq: 'weekly', interval, weekdays, end }
  }
  if (freq === 'MONTHLY') {
    if (interval !== 1) return null
    const byday = map.get('BYDAY')
    if (byday === undefined) {
      return { freq: 'monthlyDate', end }
    }
    return /^[+-]?\d[A-Z]{2}$/.test(byday) ? { freq: 'monthlyNth', end } : null
  }
  if (freq === 'YEARLY') {
    return interval === 1 ? { freq: 'yearly', end } : null
  }
  return null
}

function parseEnd(map: Map<string, string>): RecurrenceEnd | null {
  const until = map.get('UNTIL')
  const count = map.get('COUNT')
  if (until !== undefined && count !== undefined) {
    return null
  }
  if (until !== undefined) {
    const m = until.match(/^(\d{4})(\d{2})(\d{2})/)
    if (m === null) return null
    return { type: 'until', date: `${m[1]}-${m[2]}-${m[3]}` }
  }
  if (count !== undefined) {
    const n = Number(count)
    return Number.isInteger(n) && n > 0 ? { type: 'count', count: n } : null
  }
  return { type: 'never' }
}

export function recurrenceSummary(form: RecurrenceForm, base: BaseDate): string {
  if (form.freq === 'none') return '繰り返さない'
  const endLabel =
    form.end.type === 'until'
      ? ` (${form.end.date}まで)`
      : form.end.type === 'count'
        ? ` (${form.end.count}回)`
        : ''
  if (form.freq === 'daily') {
    return `${form.interval > 1 ? `${form.interval}日ごと` : '毎日'}${endLabel}`
  }
  if (form.freq === 'weekly') {
    const days = (form.weekdays.length > 0 ? form.weekdays : [base.weekday])
      .map((d) => WEEKDAY_LABELS[d])
      .join('・')
    return `${form.interval > 1 ? `${form.interval}週ごと` : '毎週'} ${days}${endLabel}`
  }
  if (form.freq === 'monthlyDate') return `毎月${base.day}日${endLabel}`
  if (form.freq === 'monthlyNth') {
    return `毎月第${Math.ceil(base.day / 7)}${WEEKDAY_LABELS[base.weekday]}曜日${endLabel}`
  }
  return `毎年${endLabel}`
}
