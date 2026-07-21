import { describe, expect, test } from 'vitest'
import { toId } from '../shared/id.js'
import { applyAllEdit, splitEventAtOccurrence } from './edit.js'
import { createEvent, type Event } from './event.js'
import { expandEvent, startInstantOf } from './expand.js'
import type { EventOverride } from './override.js'

const familyId = toId<'Family'>('f-1')
const memberA = toId<'Member'>('m-a')
const memberB = toId<'Member'>('m-b')

function weeklyEvent(): Event {
  return createEvent({
    familyId,
    title: '水泳教室',
    time: {
      kind: 'timed',
      startAt: new Date('2026-01-05T07:00:00Z'), // JST 月 16:00
      endAt: new Date('2026-01-05T08:00:00Z'),
      timezone: 'Asia/Tokyo',
    },
    rrule: 'FREQ=WEEKLY;BYDAY=MO',
    targetMemberIds: [memberA],
    assigneeMemberId: memberA,
    createdByMemberId: memberA,
  })
}

const q1 = { start: new Date('2026-01-01T00:00:00Z'), end: new Date('2026-03-01T00:00:00Z') }

describe('splitEventAtOccurrence: これ以降すべて', () => {
  const splitAt = new Date('2026-01-19T07:00:00Z') // 3回目

  test('旧マスタは分割点の前で終わり、新マスタが以降を引き継ぐ', () => {
    const event = weeklyEvent()
    const result = splitEventAtOccurrence(
      event,
      [],
      splitAt,
      {
        kind: 'timed',
        startAt: splitAt,
        endAt: new Date('2026-01-19T08:00:00Z'),
        timezone: 'Asia/Tokyo',
      },
      { assigneeMemberId: memberB },
    )

    const oldOccs = expandEvent(result.updatedOldMaster, [], q1)
    expect(oldOccs.map((o) => startInstantOf(o).toISOString())).toEqual([
      '2026-01-05T07:00:00.000Z',
      '2026-01-12T07:00:00.000Z',
    ])
    expect(result.updatedOldMaster.recurrenceEndAt?.toISOString()).toBe('2026-01-12T08:00:00.000Z')

    const newOccs = expandEvent(result.newMaster, [], q1)
    expect(startInstantOf(newOccs[0] as NonNullable<(typeof newOccs)[0]>).toISOString()).toBe(
      '2026-01-19T07:00:00.000Z',
    )
    expect(result.newMaster.assigneeMemberId).toBe(memberB)
    expect(result.newMaster.id).not.toBe(event.id)
    // 旧マスタの担当者は変わらない
    expect(result.updatedOldMaster.assigneeMemberId).toBe(memberA)
  })

  test('時刻変更なしなら分割点以降の例外は新マスタへ付け替え、以前の例外は旧マスタに残る', () => {
    const event = weeklyEvent()
    const before: EventOverride = {
      id: toId<'EventOverride'>('o-before'),
      eventId: event.id,
      originalStartAt: new Date('2026-01-12T07:00:00Z'),
      isCancelled: true,
      patch: {},
    }
    const after: EventOverride = {
      id: toId<'EventOverride'>('o-after'),
      eventId: event.id,
      originalStartAt: new Date('2026-01-26T07:00:00Z'),
      isCancelled: false,
      patch: { title: '振替' },
    }
    const result = splitEventAtOccurrence(
      event,
      [before, after],
      splitAt,
      {
        kind: 'timed',
        startAt: splitAt,
        endAt: new Date('2026-01-19T08:00:00Z'),
        timezone: 'Asia/Tokyo',
      },
      { title: '水泳教室(新コーチ)' },
    )
    expect(result.movedOverrides.map((o) => o.id)).toEqual([after.id])
    expect(result.movedOverrides[0]?.eventId).toBe(result.newMaster.id)
    expect(result.droppedOverrideIds).toEqual([])
  })

  test('時刻を変える分割では新期間の例外は破棄される (格子が一致しなくなるため)', () => {
    const event = weeklyEvent()
    const after: EventOverride = {
      id: toId<'EventOverride'>('o-after'),
      eventId: event.id,
      originalStartAt: new Date('2026-01-26T07:00:00Z'),
      isCancelled: true,
      patch: {},
    }
    const result = splitEventAtOccurrence(
      event,
      [after],
      splitAt,
      {
        kind: 'timed',
        startAt: splitAt,
        endAt: new Date('2026-01-19T08:00:00Z'),
        timezone: 'Asia/Tokyo',
      },
      {
        time: {
          kind: 'timed',
          startAt: new Date('2026-01-19T08:00:00Z'), // 17:00 開始に変更
          endAt: new Date('2026-01-19T09:00:00Z'),
          timezone: 'Asia/Tokyo',
        },
      },
    )
    expect(result.movedOverrides).toEqual([])
    expect(result.droppedOverrideIds).toEqual([after.id])
  })
})

describe('applyAllEdit: すべて編集', () => {
  test('マスタが更新され recurrenceEndAt が再計算される', () => {
    const event = weeklyEvent()
    const updated = applyAllEdit(event, { rrule: 'FREQ=WEEKLY;BYDAY=MO;COUNT=2' })
    expect(updated.recurrenceEndAt?.toISOString()).toBe('2026-01-12T08:00:00.000Z')
    expect(updated.id).toBe(event.id)
  })
})
