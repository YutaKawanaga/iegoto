import { rankSuggestions } from '@iegoto/domain'
import { EventRepository } from '@iegoto/db'
import type { FamilyContext } from '../../../trpc.js'
import { FAMILY_TIMEZONE } from './list-events-in-range.js'
import { utcToWall } from '@iegoto/domain'

/**
 * 過去予定サジェスト (S-5): 家族全員・直近1年・前方一致優先・同一タイトル集約・最大5件。
 * 引き継ぐのは時刻・対象・担当・場所。メモと繰り返し設定は引き継がない
 */
export type SuggestOutput = {
  title: string
  location: string | null
  isAllDay: boolean
  /** timed の場合の開始時刻 'HH:mm' (家族TZ) と所要分 */
  startTimeLocal: string | null
  durationMinutes: number | null
  targetMemberIds: string[]
  assigneeMemberId: string | null
}

export async function suggestPastEvents(
  ctx: FamilyContext,
  input: { query: string },
): Promise<SuggestOutput[]> {
  const since = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
  const candidates = await new EventRepository(ctx.db).listSuggestCandidates(
    ctx.familyId,
    input.query,
    since,
  )
  return rankSuggestions(
    input.query,
    candidates.map(({ event, lastUsedAt, normalizedTitle }) => ({
      normalizedTitle,
      lastUsedAt,
      payload: toSuggestOutput(event),
    })),
  )
}

function toSuggestOutput(event: {
  title: string
  location: string | null
  time: { kind: 'timed'; startAt: Date; endAt: Date; timezone: string } | { kind: 'allDay'; startDate: string; endDate: string }
  targetMemberIds: string[]
  assigneeMemberId: string | null
}): SuggestOutput {
  if (event.time.kind === 'timed') {
    const wall = utcToWall(event.time.startAt, FAMILY_TIMEZONE)
    const hh = String(wall.getUTCHours()).padStart(2, '0')
    const mm = String(wall.getUTCMinutes()).padStart(2, '0')
    return {
      title: event.title,
      location: event.location,
      isAllDay: false,
      startTimeLocal: `${hh}:${mm}`,
      durationMinutes: Math.round(
        (event.time.endAt.getTime() - event.time.startAt.getTime()) / 60000,
      ),
      targetMemberIds: event.targetMemberIds,
      assigneeMemberId: event.assigneeMemberId,
    }
  }
  return {
    title: event.title,
    location: event.location,
    isAllDay: true,
    startTimeLocal: null,
    durationMinutes: null,
    targetMemberIds: event.targetMemberIds,
    assigneeMemberId: event.assigneeMemberId,
  }
}
