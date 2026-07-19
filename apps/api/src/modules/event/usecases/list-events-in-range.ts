import { EventRepository, type QueryRange } from '@iegoto/db'
import { expandEvents, utcToWall } from '@iegoto/domain'
import type { FamilyContext } from '../../../trpc.js'
import { type OccurrenceOutput, toOccurrenceOutput } from '../serialize.js'

export const FAMILY_TIMEZONE = 'Asia/Tokyo' // S-4: MVP は固定

/** UTC instant 範囲から QueryRange (終日予定用の日付文字列込み) を作る */
export function buildQueryRange(start: Date, end: Date): QueryRange {
  return {
    start,
    end,
    startDate: utcToWall(start, FAMILY_TIMEZONE).toISOString().slice(0, 10),
    endDate: utcToWall(end, FAMILY_TIMEZONE).toISOString().slice(0, 10),
  }
}

/** F-02 カレンダー表示の中核: 単発検索 + マスタ絞り込み → domain で展開・マージ (03 §3) */
export async function listEventsInRange(
  ctx: FamilyContext,
  input: { start: Date; end: Date },
): Promise<OccurrenceOutput[]> {
  const repo = new EventRepository(ctx.db)
  const range = buildQueryRange(input.start, input.end)
  const [singles, masters] = await Promise.all([
    repo.listSinglesInRange(ctx.familyId, range),
    repo.listMastersInRange(ctx.familyId, range),
  ])
  const occurrences = expandEvents([...singles, ...masters], {
    start: input.start,
    end: input.end,
  })
  return occurrences.map(toOccurrenceOutput)
}
