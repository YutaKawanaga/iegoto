import { DomainError } from '../shared/errors.js'
import {
  type FamilyId,
  type MemberId,
  newId,
  type ShoppingItemId,
  type ShoppingListId,
} from '../shared/id.js'

export type ShoppingList = {
  id: ShoppingListId
  familyId: FamilyId
  name: string
  sortOrder: number
}

export type ShoppingItem = {
  id: ShoppingItemId
  shoppingListId: ShoppingListId
  name: string
  addedByMemberId: MemberId
  checkedAt: Date | null
  checkedByMemberId: MemberId | null
}

export function createShoppingList(input: {
  familyId: FamilyId
  name: string
  sortOrder: number
}): ShoppingList {
  return {
    id: newId<'ShoppingList'>(),
    familyId: input.familyId,
    name: validateListName(input.name),
    sortOrder: input.sortOrder,
  }
}

export function createShoppingItem(input: {
  shoppingListId: ShoppingListId
  name: string
  addedByMemberId: MemberId
}): ShoppingItem {
  const name = input.name.trim()
  if (name.length === 0 || name.length > 100) {
    throw new DomainError('INVALID_ITEM_NAME', 'アイテム名は1〜100文字で入力してください')
  }
  return {
    id: newId<'ShoppingItem'>(),
    shoppingListId: input.shoppingListId,
    name,
    addedByMemberId: input.addedByMemberId,
    checkedAt: null,
    checkedByMemberId: null,
  }
}

function validateListName(name: string): string {
  const trimmed = name.trim()
  if (trimmed.length === 0 || trimmed.length > 50) {
    throw new DomainError('INVALID_LIST_NAME', 'リスト名は1〜50文字で入力してください')
  }
  return trimmed
}
