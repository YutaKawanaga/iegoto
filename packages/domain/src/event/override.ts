import type { EventId, EventOverrideId, MemberId } from '../shared/id.js'
import type { EventTime } from './event.js'

/**
 * 繰り返しの例外 (F-03「この予定のみ」編集)。
 * patch の undefined はマスタ値を継承、値ありは上書き (03-domain-model.md event_override)
 */
export type EventOverride = {
  id: EventOverrideId
  eventId: EventId
  /** どの回の例外か。timed はその回の開始 UTC、終日はその回の開始日の UTC 深夜0時 */
  originalStartAt: Date
  isCancelled: boolean
  patch: OverridePatch
}

export type OverridePatch = {
  title?: string
  memo?: string | null
  location?: string | null
  time?: EventTime
  targetMemberIds?: MemberId[]
  assigneeMemberId?: MemberId | null
}
