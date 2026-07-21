import { EventRepository } from '@iegoto/db'
import { expandEvents } from '@iegoto/domain'
import type { FamilyContext } from '../../../trpc.js'
import { type OccurrenceOutput, toOccurrenceOutput } from '../serialize.js'
import { buildQueryRange } from './list-events-in-range.js'

const HORIZON_DAYS = 60 // 担当一覧は直近60日分を表示

/** F-04: 自分が担当の予定一覧 */
export async function listMyAssignedEvents(ctx: FamilyContext): Promise<OccurrenceOutput[]> {
  const { start, end } = horizon()
  const events = await new EventRepository(ctx.db).listByAssignee(
    ctx.familyId,
    ctx.memberId,
    buildQueryRange(start, end),
  )
  return expandEvents(events, { start, end })
    .filter((o) => o.assigneeMemberId === ctx.memberId)
    .map(toOccurrenceOutput)
}

/** F-04: 担当者未定の予定一覧 (押し付け合い可視化) */
export async function listUnassignedEvents(ctx: FamilyContext): Promise<OccurrenceOutput[]> {
  const { start, end } = horizon()
  const events = await new EventRepository(ctx.db).listUnassigned(
    ctx.familyId,
    buildQueryRange(start, end),
  )
  return expandEvents(events, { start, end })
    .filter((o) => o.assigneeMemberId === null)
    .map(toOccurrenceOutput)
}

function horizon(): { start: Date; end: Date } {
  const start = new Date()
  return { start, end: new Date(start.getTime() + HORIZON_DAYS * 24 * 60 * 60 * 1000) }
}
