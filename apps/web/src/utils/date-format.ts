import type { EventTime } from '@iegoto/domain'

/** 表示は Asia/Tokyo 固定 (S-4。ブラウザ TZ は参照しない) */
const TZ = 'Asia/Tokyo'

const timeFmt = new Intl.DateTimeFormat('ja-JP', {
  timeZone: TZ,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

const dateFmt = new Intl.DateTimeFormat('ja-JP', {
  timeZone: TZ,
  month: 'numeric',
  day: 'numeric',
  weekday: 'short',
})

export function formatTime(date: Date): string {
  return timeFmt.format(date)
}

export function formatDateLabel(date: Date): string {
  return dateFmt.format(date)
}

/** 'YYYY-MM-DD' (JST) を返す。カレンダーのグルーピングキー */
export function jstDateKey(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
  return parts
}

/** 予定の時間表示 (一覧・チップ用) */
export function formatEventTimeLabel(time: EventTime): string {
  if (time.kind === 'allDay') {
    return '終日'
  }
  return `${formatTime(time.startAt)}〜${formatTime(time.endAt)}`
}

/** 'YYYY-MM-DD' 文字列同士の日数差などに使う軽量ヘルパー */
export function dateStringToDate(dateString: string): Date {
  return new Date(`${dateString}T00:00:00+09:00`)
}
