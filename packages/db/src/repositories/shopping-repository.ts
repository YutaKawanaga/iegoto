import type {
  FamilyId,
  MemberId,
  ShoppingItem,
  ShoppingItemId,
  ShoppingList,
  ShoppingListId,
} from '@iegoto/domain'
import { toId } from '@iegoto/domain'
import type { Tx } from '../client.js'
import type {
  ShoppingItem as ItemRow,
  ShoppingList as ListRow,
} from '../generated/client/index.js'

function listFromRow(row: ListRow): ShoppingList {
  return {
    id: toId<'ShoppingList'>(row.id),
    familyId: toId<'Family'>(row.familyId),
    name: row.name,
    sortOrder: row.sortOrder,
  }
}

function itemFromRow(row: ItemRow): ShoppingItem {
  return {
    id: toId<'ShoppingItem'>(row.id),
    shoppingListId: toId<'ShoppingList'>(row.shoppingListId),
    name: row.name,
    addedByMemberId: toId<'Member'>(row.addedByMemberId),
    checkedAt: row.checkedAt,
    checkedByMemberId: row.checkedByMemberId === null ? null : toId<'Member'>(row.checkedByMemberId),
  }
}

export class ShoppingRepository {
  constructor(private readonly tx: Tx) {}

  async listLists(familyId: FamilyId): Promise<ShoppingList[]> {
    const rows = await this.tx.shoppingList.findMany({
      where: { familyId },
      orderBy: { sortOrder: 'asc' },
    })
    return rows.map(listFromRow)
  }

  async findList(familyId: FamilyId, listId: ShoppingListId): Promise<ShoppingList | null> {
    const row = await this.tx.shoppingList.findFirst({ where: { id: listId, familyId } })
    return row === null ? null : listFromRow(row)
  }

  async createList(list: ShoppingList): Promise<void> {
    await this.tx.shoppingList.create({
      data: { id: list.id, familyId: list.familyId, name: list.name, sortOrder: list.sortOrder },
    })
  }

  async renameList(familyId: FamilyId, listId: ShoppingListId, name: string): Promise<void> {
    await this.tx.shoppingList.updateMany({ where: { id: listId, familyId }, data: { name } })
  }

  async deleteList(familyId: FamilyId, listId: ShoppingListId): Promise<void> {
    await this.tx.shoppingItem.deleteMany({
      where: { shoppingListId: listId, list: { familyId } },
    })
    await this.tx.shoppingList.deleteMany({ where: { id: listId, familyId } })
  }

  async listItems(familyId: FamilyId, listId: ShoppingListId): Promise<ShoppingItem[]> {
    const rows = await this.tx.shoppingItem.findMany({
      where: { shoppingListId: listId, deletedAt: null, list: { familyId } },
      orderBy: [{ checkedAt: { sort: 'asc', nulls: 'first' } }, { createdAt: 'desc' }],
    })
    return rows.map(itemFromRow)
  }

  /** 今日のまとめビュー用: 家族の未購入アイテム数 (F-06) */
  async countUncheckedItems(familyId: FamilyId): Promise<number> {
    return this.tx.shoppingItem.count({
      where: { deletedAt: null, checkedAt: null, list: { familyId } },
    })
  }

  async addItem(familyId: FamilyId, item: ShoppingItem): Promise<void> {
    const list = await this.findList(familyId, item.shoppingListId)
    if (list === null) {
      throw new Error('リストが見つかりません')
    }
    await this.tx.shoppingItem.create({
      data: {
        id: item.id,
        shoppingListId: item.shoppingListId,
        name: item.name,
        addedByMemberId: item.addedByMemberId,
      },
    })
  }

  async setChecked(
    familyId: FamilyId,
    itemId: ShoppingItemId,
    checkedBy: MemberId | null,
  ): Promise<void> {
    await this.tx.shoppingItem.updateMany({
      where: { id: itemId, deletedAt: null, list: { familyId } },
      data:
        checkedBy === null
          ? { checkedAt: null, checkedByMemberId: null }
          : { checkedAt: new Date(), checkedByMemberId: checkedBy },
    })
  }

  async softDeleteItem(familyId: FamilyId, itemId: ShoppingItemId): Promise<void> {
    await this.tx.shoppingItem.updateMany({
      where: { id: itemId, list: { familyId } },
      data: { deletedAt: new Date() },
    })
  }
}
