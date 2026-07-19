import type { EventTime, Occurrence } from '@iegoto/domain'
import { startInstantOf } from '@iegoto/domain'

/** Occurrence の出力 DTO。境界の型を明示する (07 §5。Prisma/domain の内部型をそのまま返さない) */
export type OccurrenceOutput = {
  eventId: string
  originalStartAt: Date
  title: string
  memo: string | null
  location: string | null
  time: EventTime
  targetMemberIds: string[]
  assigneeMemberId: string | null
  reminderMinutesBefore: number | null
  isRecurring: boolean
  isModified: boolean
  /** 並べ替え・表示用の開始 instant (終日は UTC 深夜0時) */
  sortInstant: Date
}

export function toOccurrenceOutput(occ: Occurrence): OccurrenceOutput {
  return {
    eventId: occ.eventId,
    originalStartAt: occ.originalStartAt,
    title: occ.title,
    memo: occ.memo,
    location: occ.location,
    time: occ.time,
    targetMemberIds: occ.targetMemberIds,
    assigneeMemberId: occ.assigneeMemberId,
    reminderMinutesBefore: occ.reminderMinutesBefore,
    isRecurring: occ.isRecurring,
    isModified: occ.isModified,
    sortInstant: startInstantOf(occ),
  }
}
