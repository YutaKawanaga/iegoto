import { ShoppingRepository } from '@iegoto/db'
import { createShoppingItem, createShoppingList, toId } from '@iegoto/domain'
import { TRPCError } from '@trpc/server'
import type { FamilyContext } from '../../../trpc.js'

/**
 * F-05 買い物リスト。純 CRUD のため例外的に1ファイルに集約
 * (07 §3「原則1エントリポイント関数、正当な理由があれば複数 export」)
 */

export async function listShoppingLists(ctx: FamilyContext) {
  const repo = new ShoppingRepository(ctx.db)
  const lists = await repo.listLists(ctx.familyId)
  return Promise.all(
    lists.map(async (list) => ({
      id: list.id as string,
      name: list.name,
      items: (await repo.listItems(ctx.familyId, list.id)).map((item) => ({
        id: item.id as string,
        name: item.name,
        addedByMemberId: item.addedByMemberId as string,
        checkedAt: item.checkedAt,
        checkedByMemberId: item.checkedByMemberId as string | null,
      })),
    })),
  )
}

export async function createList(ctx: FamilyContext, input: { name: string }) {
  const repo = new ShoppingRepository(ctx.db)
  const lists = await repo.listLists(ctx.familyId)
  const list = createShoppingList({
    familyId: ctx.familyId,
    name: input.name,
    sortOrder: lists.length + 1,
  })
  await repo.createList(list)
  return { listId: list.id as string }
}

export async function renameList(ctx: FamilyContext, input: { listId: string; name: string }) {
  await new ShoppingRepository(ctx.db).renameList(
    ctx.familyId,
    toId<'ShoppingList'>(input.listId),
    input.name.trim(),
  )
}

export async function deleteList(ctx: FamilyContext, input: { listId: string }) {
  await new ShoppingRepository(ctx.db).deleteList(ctx.familyId, toId<'ShoppingList'>(input.listId))
}

export async function addItem(ctx: FamilyContext, input: { listId: string; name: string }) {
  const repo = new ShoppingRepository(ctx.db)
  const listId = toId<'ShoppingList'>(input.listId)
  const list = await repo.findList(ctx.familyId, listId)
  if (list === null) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'リストが見つかりません' })
  }
  const item = createShoppingItem({
    shoppingListId: listId,
    name: input.name,
    addedByMemberId: ctx.memberId,
  })
  await repo.addItem(ctx.familyId, item)
  return { itemId: item.id as string }
}

export async function setItemChecked(
  ctx: FamilyContext,
  input: { itemId: string; checked: boolean },
) {
  await new ShoppingRepository(ctx.db).setChecked(
    ctx.familyId,
    toId<'ShoppingItem'>(input.itemId),
    input.checked ? ctx.memberId : null,
  )
}

export async function deleteItem(ctx: FamilyContext, input: { itemId: string }) {
  await new ShoppingRepository(ctx.db).softDeleteItem(
    ctx.familyId,
    toId<'ShoppingItem'>(input.itemId),
  )
}

export async function countUnchecked(ctx: FamilyContext) {
  return { count: await new ShoppingRepository(ctx.db).countUncheckedItems(ctx.familyId) }
}
