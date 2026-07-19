import { describe, expect, test } from 'vitest'
import { toId } from '../shared/id.js'
import { createEvent, type Event } from './event.js'
import { expandEvent, startInstantOf } from './expand.js'
import type { EventOverride } from './override.js'

const familyId = toId<'Family'>('f-1')
const memberA = toId<'Member'>('m-a')

function timedEvent(overrides: Partial<Parameters<typeof createEvent>[0]> = {}): Event {
  return createEvent({
    familyId,
    title: '水泳教室',
    // JST 2026-01-05(月) 16:00-17:00 = UTC 07:00-08:00
    time: {
      kind: 'timed',
      startAt: new Date('2026-01-05T07:00:00Z'),
      endAt: new Date('2026-01-05T08:00:00Z'),
      timezone: 'Asia/Tokyo',
    },
    targetMemberIds: [memberA],
    createdByMemberId: memberA,
    ...overrides,
  })
}

const january = { start: new Date('2026-01-01T00:00:00Z'), end: new Date('2026-02-01T00:00:00Z') }

describe('expandEvent: 単発予定', () => {
  test('期間内なら1件返す', () => {
    const occs = expandEvent(timedEvent(), [], january)
    expect(occs).toHaveLength(1)
    expect(occs[0]?.title).toBe('水泳教室')
    expect(occs[0]?.isRecurring).toBe(false)
  })

  test('期間外なら0件', () => {
    const occs = expandEvent(timedEvent(), [], {
      start: new Date('2026-03-01T00:00:00Z'),
      end: new Date('2026-04-01T00:00:00Z'),
    })
    expect(occs).toHaveLength(0)
  })

  test('期間開始前に始まり期間に食い込む予定も返す', () => {
    const event = timedEvent({
      time: {
        kind: 'timed',
        startAt: new Date('2025-12-31T23:00:00Z'),
        endAt: new Date('2026-01-01T01:00:00Z'),
        timezone: 'Asia/Tokyo',
      },
    })
    expect(expandEvent(event, [], january)).toHaveLength(1)
  })
})

describe('expandEvent: 毎週の繰り返し (JST壁時計で展開)', () => {
  const weekly = timedEvent({ rrule: 'FREQ=WEEKLY;BYDAY=MO' })

  test('1月の月曜 (1/5,12,19,26) に展開され、UTC時刻が保たれる', () => {
    const occs = expandEvent(weekly, [], january)
    expect(occs.map((o) => startInstantOf(o).toISOString())).toEqual([
      '2026-01-05T07:00:00.000Z',
      '2026-01-12T07:00:00.000Z',
      '2026-01-19T07:00:00.000Z',
      '2026-01-26T07:00:00.000Z',
    ])
    for (const o of occs) {
      expect(o.time.kind).toBe('timed')
      if (o.time.kind === 'timed') {
        expect(o.time.endAt.getTime() - o.time.startAt.getTime()).toBe(60 * 60 * 1000)
      }
    }
  })

  test('JST 深夜0:30 の予定は UTC では前日だが日付ズレせず月曜に展開される', () => {
    // JST 月曜 0:30 = UTC 日曜 15:30。壁時計展開でなければ日曜扱いになり壊れるケース
    const midnight = timedEvent({
      time: {
        kind: 'timed',
        startAt: new Date('2026-01-04T15:30:00Z'), // JST 1/5(月) 00:30
        endAt: new Date('2026-01-04T16:30:00Z'),
        timezone: 'Asia/Tokyo',
      },
      rrule: 'FREQ=WEEKLY;BYDAY=MO',
    })
    const occs = expandEvent(midnight, [], january)
    expect(occs.map((o) => startInstantOf(o).toISOString())).toEqual([
      '2026-01-04T15:30:00.000Z',
      '2026-01-11T15:30:00.000Z',
      '2026-01-18T15:30:00.000Z',
      '2026-01-25T15:30:00.000Z',
    ])
  })
})

describe('expandEvent: 月次・第n曜日・終了条件', () => {
  test('毎月第2土曜', () => {
    const event = timedEvent({
      time: {
        kind: 'timed',
        startAt: new Date('2026-01-10T01:00:00Z'), // JST 1/10(第2土) 10:00
        endAt: new Date('2026-01-10T02:00:00Z'),
        timezone: 'Asia/Tokyo',
      },
      rrule: 'FREQ=MONTHLY;BYDAY=+2SA',
    })
    const occs = expandEvent(event, [], {
      start: new Date('2026-01-01T00:00:00Z'),
      end: new Date('2026-04-01T00:00:00Z'),
    })
    expect(occs.map((o) => startInstantOf(o).toISOString())).toEqual([
      '2026-01-10T01:00:00.000Z',
      '2026-02-14T01:00:00.000Z',
      '2026-03-14T01:00:00.000Z',
    ])
  })

  test('COUNT=3 で3回で止まる', () => {
    const event = timedEvent({ rrule: 'FREQ=WEEKLY;BYDAY=MO;COUNT=3' })
    const occs = expandEvent(event, [], january)
    expect(occs).toHaveLength(3)
    expect(event.recurrenceEndAt?.toISOString()).toBe('2026-01-19T08:00:00.000Z')
  })

  test('月末31日開始の毎月繰り返しは31日が無い月をスキップする (rrule準拠)', () => {
    const event = timedEvent({
      time: {
        kind: 'timed',
        startAt: new Date('2026-01-31T01:00:00Z'),
        endAt: new Date('2026-01-31T02:00:00Z'),
        timezone: 'Asia/Tokyo',
      },
      rrule: 'FREQ=MONTHLY',
    })
    const occs = expandEvent(event, [], {
      start: new Date('2026-01-01T00:00:00Z'),
      end: new Date('2026-05-01T00:00:00Z'),
    })
    // 2月・4月は31日が無い → 1/31, 3/31 のみ
    expect(occs.map((o) => startInstantOf(o).toISOString())).toEqual([
      '2026-01-31T01:00:00.000Z',
      '2026-03-31T01:00:00.000Z',
    ])
  })
})

describe('expandEvent: 終日予定 (date型・TZ非依存)', () => {
  test('毎年繰り返しの終日予定', () => {
    const event = createEvent({
      familyId,
      title: '誕生日',
      time: { kind: 'allDay', startDate: '2026-01-15', endDate: '2026-01-15' },
      rrule: 'FREQ=YEARLY',
      targetMemberIds: [memberA],
      createdByMemberId: memberA,
    })
    const occs = expandEvent(event, [], {
      start: new Date('2027-01-01T00:00:00Z'),
      end: new Date('2027-02-01T00:00:00Z'),
    })
    expect(occs).toHaveLength(1)
    expect(occs[0]?.time).toEqual({
      kind: 'allDay',
      startDate: '2027-01-15',
      endDate: '2027-01-15',
    })
  })

  test('複数日にまたがる終日予定の期間が保たれる', () => {
    const event = createEvent({
      familyId,
      title: '帰省',
      time: { kind: 'allDay', startDate: '2026-01-02', endDate: '2026-01-04' },
      rrule: 'FREQ=MONTHLY',
      targetMemberIds: [],
      createdByMemberId: memberA,
    })
    const occs = expandEvent(event, [], {
      start: new Date('2026-02-01T00:00:00Z'),
      end: new Date('2026-03-01T00:00:00Z'),
    })
    expect(occs[0]?.time).toEqual({
      kind: 'allDay',
      startDate: '2026-02-02',
      endDate: '2026-02-04',
    })
  })
})

describe('expandEvent: override 適用', () => {
  const weekly = timedEvent({ rrule: 'FREQ=WEEKLY;BYDAY=MO' })

  test('キャンセル override の回は除去される', () => {
    const cancel: EventOverride = {
      id: toId<'EventOverride'>('o-1'),
      eventId: weekly.id,
      originalStartAt: new Date('2026-01-12T07:00:00Z'),
      isCancelled: true,
      patch: {},
    }
    const occs = expandEvent(weekly, [cancel], january)
    expect(occs.map((o) => startInstantOf(o).toISOString())).not.toContain(
      '2026-01-12T07:00:00.000Z',
    )
    expect(occs).toHaveLength(3)
  })

  test('上書き override の回はタイトル・時刻が差し替わり isModified になる', () => {
    const modify: EventOverride = {
      id: toId<'EventOverride'>('o-2'),
      eventId: weekly.id,
      originalStartAt: new Date('2026-01-19T07:00:00Z'),
      isCancelled: false,
      patch: {
        title: '水泳教室(振替)',
        time: {
          kind: 'timed',
          startAt: new Date('2026-01-20T07:00:00Z'),
          endAt: new Date('2026-01-20T08:00:00Z'),
          timezone: 'Asia/Tokyo',
        },
      },
    }
    const occs = expandEvent(weekly, [modify], january)
    const modified = occs.find((o) => o.isModified)
    expect(modified?.title).toBe('水泳教室(振替)')
    expect(startInstantOf(modified as NonNullable<typeof modified>).toISOString()).toBe(
      '2026-01-20T07:00:00.000Z',
    )
    // originalStartAt は元の回のまま (override キーとして保持)
    expect(modified?.originalStartAt.toISOString()).toBe('2026-01-19T07:00:00.000Z')
  })
})
