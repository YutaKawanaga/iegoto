import type {
  Event as DomainEvent,
  EventOverride as DomainOverride,
  EventId,
  EventOverrideId,
  FamilyId,
  MemberId,
} from '@iegoto/domain'
import { normalizeTitle } from '@iegoto/domain'
import type { Tx } from '../client.js'
import { eventFromRow, eventToRow, patchToJson } from '../mappers/event-mapper.js'

export type EventWithOverrides = { event: DomainEvent; overrides: DomainOverride[] }

/** 期間クエリの範囲。instant は UTC、date は家族 TZ で計算した日付文字列 (終日予定用) */
export type QueryRange = {
  start: Date
  end: Date
  startDate: string
  endDate: string
}

/**
 * 1集約(Event) = 1 Repository。familyId は必須第一引数 (07 §2 テナント境界の型強制)。
 * 例外: dueReminders はジョブ経路 (家族横断) 専用
 */
export class EventRepository {
  constructor(private readonly tx: Tx) {}

  async find(familyId: FamilyId, id: EventId): Promise<EventWithOverrides | null> {
    const row = await this.tx.event.findFirst({
      where: { id, familyId, deletedAt: null },
      include: { targets: true, overrides: true },
    })
    return row === null ? null : eventFromRow(row)
  }

  /** 単発予定を期間で検索 (03 §3 (a)) */
  async listSinglesInRange(familyId: FamilyId, range: QueryRange): Promise<EventWithOverrides[]> {
    const rows = await this.tx.event.findMany({
      where: {
        familyId,
        deletedAt: null,
        rrule: null,
        OR: [
          { isAllDay: false, startAt: { lt: range.end }, endAt: { gt: range.start } },
          { isAllDay: true, startDate: { lte: range.endDate }, endDate: { gte: range.startDate } },
        ],
      },
      include: { targets: true, overrides: true },
    })
    return rows.map(eventFromRow)
  }

  /** 繰り返しマスタを期間で絞り込み (03 §3 (b))。展開は domain 層で行う */
  async listMastersInRange(familyId: FamilyId, range: QueryRange): Promise<EventWithOverrides[]> {
    const rows = await this.tx.event.findMany({
      where: {
        familyId,
        deletedAt: null,
        rrule: { not: null },
        OR: [
          { isAllDay: false, startAt: { lt: range.end } },
          { isAllDay: true, startDate: { lte: range.endDate } },
        ],
        AND: [
          {
            OR: [{ recurrenceEndAt: null }, { recurrenceEndAt: { gte: range.start } }],
          },
        ],
      },
      include: { targets: true, overrides: true },
    })
    return rows.map(eventFromRow)
  }

  /** サジェスト候補 (S-5)。絞り込みだけ行い、ランキングは domain の rankSuggestions */
  async listSuggestCandidates(
    familyId: FamilyId,
    query: string,
    since: Date,
  ): Promise<{ event: DomainEvent; lastUsedAt: Date; normalizedTitle: string }[]> {
    const q = normalizeTitle(query)
    if (q.length === 0) {
      return []
    }
    const rows = await this.tx.event.findMany({
      where: {
        familyId,
        deletedAt: null,
        normalizedTitle: { contains: q },
        createdAt: { gte: since },
      },
      include: { targets: true, overrides: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    return rows.map((row) => ({
      event: eventFromRow(row).event,
      lastUsedAt: row.createdAt,
      normalizedTitle: row.normalizedTitle,
    }))
  }

  async listByAssignee(
    familyId: FamilyId,
    memberId: MemberId,
    range: QueryRange,
  ): Promise<EventWithOverrides[]> {
    const rows = await this.tx.event.findMany({
      where: {
        familyId,
        deletedAt: null,
        assigneeMemberId: memberId,
        OR: rangeCondition(range),
      },
      include: { targets: true, overrides: true },
    })
    return rows.map(eventFromRow)
  }

  async listUnassigned(familyId: FamilyId, range: QueryRange): Promise<EventWithOverrides[]> {
    const rows = await this.tx.event.findMany({
      where: {
        familyId,
        deletedAt: null,
        assigneeMemberId: null,
        OR: rangeCondition(range),
      },
      include: { targets: true, overrides: true },
    })
    return rows.map(eventFromRow)
  }

  /** マスタの作成/更新 (対象メンバーは全置換)。nextReminderAt は usecase が別途計算して渡す */
  async save(familyId: FamilyId, event: DomainEvent, nextReminderAt: Date | null): Promise<void> {
    if (event.familyId !== familyId) {
      throw new Error('familyId が一致しません')
    }
    const row = eventToRow(event, normalizeTitle(event.title))
    await this.tx.event.upsert({
      where: { id: event.id },
      create: { id: event.id, familyId, ...row, nextReminderAt },
      update: { ...row, nextReminderAt },
    })
    await this.tx.eventTarget.deleteMany({ where: { eventId: event.id } })
    if (event.targetMemberIds.length > 0) {
      await this.tx.eventTarget.createMany({
        data: event.targetMemberIds.map((memberId) => ({ eventId: event.id, memberId })),
      })
    }
  }

  async softDelete(familyId: FamilyId, id: EventId): Promise<void> {
    await this.tx.event.updateMany({
      where: { id, familyId },
      data: { deletedAt: new Date(), nextReminderAt: null },
    })
  }

  async upsertOverride(familyId: FamilyId, override: DomainOverride): Promise<void> {
    // override は event 経由でしか触らせない: 対象 event が family に属することを確認
    const owned = await this.tx.event.findFirst({
      where: { id: override.eventId, familyId },
      select: { id: true },
    })
    if (owned === null) {
      throw new Error('event が見つかりません')
    }
    const patch = patchToJson(override.patch)
    await this.tx.eventOverride.upsert({
      where: {
        eventId_originalStartAt: {
          eventId: override.eventId,
          originalStartAt: override.originalStartAt,
        },
      },
      create: {
        id: override.id,
        eventId: override.eventId,
        originalStartAt: override.originalStartAt,
        isCancelled: override.isCancelled,
        patch,
      },
      update: { isCancelled: override.isCancelled, patch },
    })
  }

  async moveOverrides(familyId: FamilyId, overrides: DomainOverride[]): Promise<void> {
    for (const o of overrides) {
      await this.tx.eventOverride.update({
        where: { id: o.id },
        data: { eventId: o.eventId },
      })
    }
  }

  async deleteOverrides(familyId: FamilyId, ids: EventOverrideId[]): Promise<void> {
    if (ids.length === 0) {
      return
    }
    await this.tx.eventOverride.deleteMany({ where: { id: { in: ids } } })
  }

  /** 担当者削除時の担当者未定化 (S-3): 未来の予定の担当を外す */
  async unassignFutureEvents(familyId: FamilyId, memberId: MemberId, now: Date): Promise<void> {
    await this.tx.event.updateMany({
      where: {
        familyId,
        deletedAt: null,
        assigneeMemberId: memberId,
        OR: [
          { isAllDay: false, startAt: { gte: now } },
          { isAllDay: true, startDate: { gte: now.toISOString().slice(0, 10) } },
          { rrule: { not: null }, recurrenceEndAt: null },
          { rrule: { not: null }, recurrenceEndAt: { gte: now } },
        ],
      },
      data: { assigneeMemberId: null },
    })
  }

  /** 対象メンバーから外す (S-3。未来分のみの厳密制御は繰り返しでは困難なため、紐づけ自体を残しUI表示で吸収) */
  async removeMemberFromTargets(familyId: FamilyId, memberId: MemberId): Promise<void> {
    await this.tx.eventTarget.deleteMany({
      where: { memberId, event: { familyId, deletedAt: null } },
    })
  }

  /**
   * ⚠️ ジョブ経路専用 (dispatchReminders)。家族横断で発火時刻が来た予定を拾う。
   * familyId スコープ必須ルールの明示的な例外 (07 §2)
   */
  async listDueRemindersForJob(now: Date, limit: number): Promise<EventWithOverrides[]> {
    const rows = await this.tx.event.findMany({
      where: { deletedAt: null, nextReminderAt: { lte: now } },
      include: { targets: true, overrides: true },
      take: limit,
    })
    return rows.map(eventFromRow)
  }

  async updateNextReminderAt(eventId: EventId, nextReminderAt: Date | null): Promise<void> {
    await this.tx.event.update({ where: { id: eventId }, data: { nextReminderAt } })
  }
}

function rangeCondition(range: QueryRange) {
  return [
    { isAllDay: false, startAt: { lt: range.end }, endAt: { gt: range.start } },
    { isAllDay: true, startDate: { lte: range.endDate }, endDate: { gte: range.startDate } },
    // 繰り返しマスタは期間開始前でも未終了なら対象
    {
      rrule: { not: null },
      OR: [{ recurrenceEndAt: null }, { recurrenceEndAt: { gte: range.start } }],
    },
  ]
}
