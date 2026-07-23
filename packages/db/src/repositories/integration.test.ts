import {
  createEvent,
  createFamily,
  createMember,
  createShoppingItem,
  createShoppingList,
  type EventOverride,
  type FamilyId,
  invitationExpiry,
  type MemberId,
  newId,
} from '@iegoto/domain'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PrismaClient } from '../generated/client/index.js'
import { EventRepository, type QueryRange } from './event-repository.js'
import { FamilyRepository } from './family-repository.js'
import { InvitationRepository } from './invitation-repository.js'
import { MemberRepository } from './member-repository.js'
import { ShoppingRepository } from './shopping-repository.js'
import { UserAccountRepository } from './user-account-repository.js'

/**
 * リポジトリ層の実Postgres統合テスト。
 * - 接続先は DATABASE_URL (CI: .github/workflows/ci.yml が iegoto_test を用意しマイグレーション済み)
 * - テストごとに新しい family を作って分離する (truncate 不要・並列安全)
 * - 誤って開発/本番DBへ向けないよう、DB名に test を含まない場合は実行を拒否する
 */
const url = process.env.DATABASE_URL ?? ''
const isTestDb = /test/.test(new URL(url.replace(/^postgres(ql)?:\/\//, 'http://')).pathname)

const db = new PrismaClient()

beforeAll(() => {
  if (!isTestDb) {
    throw new Error(
      `DATABASE_URL のDB名に "test" が含まれていません (${url})。統合テストは専用DBで実行してください`,
    )
  }
})

afterAll(async () => {
  await db.$disconnect()
})

/** テスト用の家族 + メンバー2人 (パパ=ログイン可想定, 長男=プロフィールのみ) を作る */
async function seedFamily() {
  const family = createFamily(`テスト家 ${newId<'Family'>().slice(0, 8)}`)
  await new FamilyRepository(db).create(family)
  const members = new MemberRepository(db)
  const papa = createMember({
    familyId: family.id,
    displayName: 'パパ',
    color: 'coral',
    sortOrder: 1,
  })
  const kid = createMember({ familyId: family.id, displayName: '長男', color: 'sky', sortOrder: 2 })
  await members.create(papa)
  await members.create(kid)
  return { family, papa, kid }
}

function rangeOf(start: Date, end: Date): QueryRange {
  return {
    start,
    end,
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  }
}

describe('FamilyRepository', () => {
  it('作成した家族を find で取得できる', async () => {
    const { family } = await seedFamily()
    const found = await new FamilyRepository(db).find(family.id)
    expect(found).toEqual(family)
  })

  it('updateName で家族名を変更できる', async () => {
    const { family } = await seedFamily()
    await new FamilyRepository(db).updateName(family.id, '新しい家')
    const found = await new FamilyRepository(db).find(family.id)
    expect(found?.name).toBe('新しい家')
  })
})

describe('MemberRepository', () => {
  it('list は表示順で返し、ソフトデリート済みは既定で除外する', async () => {
    const { family, papa, kid } = await seedFamily()
    const repo = new MemberRepository(db)
    await repo.softDelete(family.id, kid.id)

    const active = await repo.list(family.id)
    expect(active.map((m) => m.id)).toEqual([papa.id])

    const all = await repo.list(family.id, { includeDeleted: true })
    expect(all).toHaveLength(2)
  })

  it('update で名前・アイコン・カラーを変更でき、icon は null で未設定に戻せる', async () => {
    const { family, kid } = await seedFamily()
    const repo = new MemberRepository(db)
    await repo.update(family.id, kid.id, { displayName: 'たろう', icon: '👦', color: 'leaf' })
    const updated = await repo.find(family.id, kid.id)
    expect(updated?.displayName).toBe('たろう')
    expect(updated?.icon).toBe('👦')
    expect(updated?.color).toBe('leaf')

    await repo.update(family.id, kid.id, { icon: null })
    const cleared = await repo.find(family.id, kid.id)
    expect(cleared?.icon).toBeNull()
  })

  it('update でアイコン画像 (data URL) を保存・削除できる', async () => {
    const { family, kid } = await seedFamily()
    const repo = new MemberRepository(db)
    const avatar = 'data:image/jpeg;base64,/9j/4AAQSkZJRg=='
    await repo.update(family.id, kid.id, { avatar })
    expect((await repo.find(family.id, kid.id))?.avatar).toBe(avatar)

    await repo.update(family.id, kid.id, { avatar: null })
    expect((await repo.find(family.id, kid.id))?.avatar).toBeNull()
  })

  it('テナント境界: 他家族の familyId では softDelete できない', async () => {
    const a = await seedFamily()
    const b = await seedFamily()
    await new MemberRepository(db).softDelete(b.family.id, a.papa.id)
    const found = await new MemberRepository(db).find(a.family.id, a.papa.id)
    expect(found?.deletedAt).toBeNull()
  })

  it('同一アカウントを同じ家族の2人のアクティブメンバーに紐づけできない (部分ユニーク制約)', async () => {
    const { family, papa, kid } = await seedFamily()
    const account = await new UserAccountRepository(db).upsertByGoogleSub({
      googleSub: `sub-${newId<'UserAccount'>()}`,
      email: 'dup@example.com',
      displayName: 'dup',
      avatarUrl: null,
    })
    const repo = new MemberRepository(db)
    await repo.linkUserAccount(family.id, papa.id, account.id)
    await expect(repo.linkUserAccount(family.id, kid.id, account.id)).rejects.toThrow()
  })

  it('softDelete はアカウント紐づけも解除し、findActiveByUserAccount から消える', async () => {
    const { family, papa } = await seedFamily()
    const account = await new UserAccountRepository(db).upsertByGoogleSub({
      googleSub: `sub-${newId<'UserAccount'>()}`,
      email: 'papa@example.com',
      displayName: 'papa',
      avatarUrl: null,
    })
    const repo = new MemberRepository(db)
    await repo.linkUserAccount(family.id, papa.id, account.id)
    expect((await repo.findActiveByUserAccount(account.id))?.id).toBe(papa.id)

    await repo.softDelete(family.id, papa.id)
    expect(await repo.findActiveByUserAccount(account.id)).toBeNull()
  })
})

describe('EventRepository', () => {
  const JAN10_10 = new Date('2026-01-10T01:00:00Z') // JST 10:00
  const JAN10_11 = new Date('2026-01-10T02:00:00Z')

  async function seedTimedEvent(familyId: FamilyId, targets: MemberId[], createdBy: MemberId) {
    const event = createEvent({
      familyId,
      title: '水泳教室',
      time: { kind: 'timed', startAt: JAN10_10, endAt: JAN10_11, timezone: 'Asia/Tokyo' },
      targetMemberIds: targets,
      createdByMemberId: createdBy,
    })
    await new EventRepository(db).save(familyId, event, null)
    return event
  }

  it('save → find のラウンドトリップで対象メンバーも復元される', async () => {
    const { family, papa, kid } = await seedFamily()
    const event = await seedTimedEvent(family.id, [kid.id, papa.id], papa.id)
    const found = await new EventRepository(db).find(family.id, event.id)
    expect(found?.event.title).toBe('水泳教室')
    expect(new Set(found?.event.targetMemberIds)).toEqual(new Set([kid.id, papa.id]))
  })

  it('テナント境界: 他家族の familyId では find できず、save は例外', async () => {
    const a = await seedFamily()
    const b = await seedFamily()
    const event = await seedTimedEvent(a.family.id, [a.kid.id], a.papa.id)
    expect(await new EventRepository(db).find(b.family.id, event.id)).toBeNull()
    await expect(new EventRepository(db).save(b.family.id, event, null)).rejects.toThrow()
  })

  it('listSinglesInRange は期間に重なる単発のみ返し、softDelete 済みは返さない', async () => {
    const { family, papa, kid } = await seedFamily()
    const repo = new EventRepository(db)
    const inRange = await seedTimedEvent(family.id, [kid.id], papa.id)
    const outEvent = createEvent({
      familyId: family.id,
      title: '範囲外',
      time: {
        kind: 'timed',
        startAt: new Date('2026-03-01T01:00:00Z'),
        endAt: new Date('2026-03-01T02:00:00Z'),
        timezone: 'Asia/Tokyo',
      },
      targetMemberIds: [papa.id],
      createdByMemberId: papa.id,
    })
    await repo.save(family.id, outEvent, null)

    const range = rangeOf(new Date('2026-01-01T00:00:00Z'), new Date('2026-02-01T00:00:00Z'))
    let ids = (await repo.listSinglesInRange(family.id, range)).map((e) => e.event.id)
    expect(ids).toEqual([inRange.id])

    await repo.softDelete(family.id, inRange.id)
    ids = (await repo.listSinglesInRange(family.id, range)).map((e) => e.event.id)
    expect(ids).toEqual([])
  })

  it('繰り返しマスタは listMastersInRange に出て、override も一緒に取得できる', async () => {
    const { family, papa, kid } = await seedFamily()
    const repo = new EventRepository(db)
    const master = createEvent({
      familyId: family.id,
      title: '毎週ピアノ',
      time: { kind: 'timed', startAt: JAN10_10, endAt: JAN10_11, timezone: 'Asia/Tokyo' },
      rrule: 'FREQ=WEEKLY;BYDAY=SA',
      targetMemberIds: [kid.id],
      createdByMemberId: papa.id,
    })
    await repo.save(family.id, master, null)

    const override: EventOverride = {
      id: newId<'EventOverride'>(),
      eventId: master.id,
      originalStartAt: new Date('2026-01-17T01:00:00Z'),
      isCancelled: true,
      patch: {},
    }
    await repo.upsertOverride(family.id, override)

    const range = rangeOf(new Date('2026-01-01T00:00:00Z'), new Date('2026-02-01T00:00:00Z'))
    const masters = await repo.listMastersInRange(family.id, range)
    expect(masters).toHaveLength(1)
    expect(masters[0]?.overrides).toHaveLength(1)
    expect(masters[0]?.overrides[0]?.isCancelled).toBe(true)
  })

  it('テナント境界: 他家族の event には upsertOverride できない', async () => {
    const a = await seedFamily()
    const b = await seedFamily()
    const event = await seedTimedEvent(a.family.id, [a.kid.id], a.papa.id)
    const override: EventOverride = {
      id: newId<'EventOverride'>(),
      eventId: event.id,
      originalStartAt: JAN10_10,
      isCancelled: true,
      patch: {},
    }
    await expect(new EventRepository(db).upsertOverride(b.family.id, override)).rejects.toThrow()
  })
})

describe('ShoppingRepository', () => {
  async function seedList(familyId: FamilyId) {
    const list = createShoppingList({ familyId, name: '食料品', sortOrder: 1 })
    await new ShoppingRepository(db).createList(list)
    return list
  }

  it('アイテムの追加・チェック・ソフトデリートが listItems に反映される', async () => {
    const { family, papa } = await seedFamily()
    const repo = new ShoppingRepository(db)
    const list = await seedList(family.id)

    const milk = createShoppingItem({
      shoppingListId: list.id,
      name: '牛乳',
      addedByMemberId: papa.id,
    })
    const egg = createShoppingItem({
      shoppingListId: list.id,
      name: '卵',
      addedByMemberId: papa.id,
    })
    await repo.addItem(family.id, milk)
    await repo.addItem(family.id, egg)

    await repo.setChecked(family.id, milk.id, papa.id)
    let items = await repo.listItems(family.id, list.id)
    expect(items).toHaveLength(2)
    // 未チェックが先頭に来る並び
    expect(items[0]?.id).toBe(egg.id)
    expect(items[1]?.checkedByMemberId).toBe(papa.id)

    await repo.softDeleteItem(family.id, egg.id)
    items = await repo.listItems(family.id, list.id)
    expect(items.map((i) => i.id)).toEqual([milk.id])
  })

  it('frequentItemNames はソフトデリート済みも含む全履歴を頻度順で返す', async () => {
    const { family, papa } = await seedFamily()
    const repo = new ShoppingRepository(db)
    const list = await seedList(family.id)

    for (let i = 0; i < 3; i++) {
      const item = createShoppingItem({
        shoppingListId: list.id,
        name: '牛乳',
        addedByMemberId: papa.id,
      })
      await repo.addItem(family.id, item)
      await repo.softDeleteItem(family.id, item.id)
    }
    await repo.addItem(
      family.id,
      createShoppingItem({ shoppingListId: list.id, name: 'パン', addedByMemberId: papa.id }),
    )

    const names = await repo.frequentItemNames(family.id, 10)
    expect(names).toEqual(['牛乳', 'パン'])
  })

  it('deleteList はアイテムごと消し、テナント境界: 他家族からは消せない', async () => {
    const a = await seedFamily()
    const b = await seedFamily()
    const repo = new ShoppingRepository(db)
    const list = await seedList(a.family.id)
    await repo.addItem(
      a.family.id,
      createShoppingItem({ shoppingListId: list.id, name: '牛乳', addedByMemberId: a.papa.id }),
    )

    await repo.deleteList(b.family.id, list.id)
    expect(await repo.findList(a.family.id, list.id)).not.toBeNull()

    await repo.deleteList(a.family.id, list.id)
    expect(await repo.findList(a.family.id, list.id)).toBeNull()
    expect(await repo.countUncheckedItems(a.family.id)).toBe(0)
  })

  it('テナント境界: 他家族の familyId では setChecked が no-op', async () => {
    const a = await seedFamily()
    const b = await seedFamily()
    const repo = new ShoppingRepository(db)
    const list = await seedList(a.family.id)
    const item = createShoppingItem({
      shoppingListId: list.id,
      name: '牛乳',
      addedByMemberId: a.papa.id,
    })
    await repo.addItem(a.family.id, item)

    await repo.setChecked(b.family.id, item.id, b.papa.id)
    const items = await repo.listItems(a.family.id, list.id)
    expect(items[0]?.checkedAt).toBeNull()
  })
})

describe('InvitationRepository', () => {
  function buildInvitation(familyId: FamilyId, createdBy: MemberId, now: Date) {
    return {
      id: newId<'Invitation'>(),
      familyId,
      tokenHash: `hash-${newId<'Invitation'>()}`,
      expiresAt: invitationExpiry(now),
      revokedAt: null,
      createdByMemberId: createdBy,
    }
  }

  it('作成した招待を findActive / findByTokenHash で引ける', async () => {
    const { family, papa } = await seedFamily()
    const repo = new InvitationRepository(db)
    const now = new Date()
    const invitation = buildInvitation(family.id, papa.id, now)
    await repo.create(invitation)

    expect((await repo.findActive(family.id, now))?.id).toBe(invitation.id)
    expect((await repo.findByTokenHash(invitation.tokenHash))?.id).toBe(invitation.id)
  })

  it('revokeAllActive 後は findActive で引けない', async () => {
    const { family, papa } = await seedFamily()
    const repo = new InvitationRepository(db)
    const now = new Date()
    await repo.create(buildInvitation(family.id, papa.id, now))
    await repo.revokeAllActive(family.id, now)
    expect(await repo.findActive(family.id, now)).toBeNull()
  })

  it('期限切れの招待は findActive で引けない', async () => {
    const { family, papa } = await seedFamily()
    const repo = new InvitationRepository(db)
    const now = new Date()
    const invitation = buildInvitation(family.id, papa.id, now)
    await repo.create(invitation)
    const afterExpiry = new Date(invitation.expiresAt.getTime() + 1000)
    expect(await repo.findActive(family.id, afterExpiry)).toBeNull()
  })
})
