import { describe, expect, it } from 'vitest'
import { DomainError } from '../shared/errors.js'
import { newId } from '../shared/id.js'
import { createShoppingItem, createShoppingList } from './shopping.js'

describe('createShoppingList', () => {
  it('名前を trim してリストを作る', () => {
    const list = createShoppingList({ familyId: newId<'Family'>(), name: ' 食料品 ', sortOrder: 1 })
    expect(list.name).toBe('食料品')
  })

  it('空・50文字超は拒否する', () => {
    const input = { familyId: newId<'Family'>(), sortOrder: 1 }
    expect(() => createShoppingList({ ...input, name: '  ' })).toThrow(DomainError)
    expect(() => createShoppingList({ ...input, name: 'あ'.repeat(51) })).toThrow(DomainError)
  })
})

describe('createShoppingItem', () => {
  const listId = newId<'ShoppingList'>()
  const memberId = newId<'Member'>()

  it('未チェック状態で作られる', () => {
    const item = createShoppingItem({
      shoppingListId: listId,
      name: '牛乳',
      addedByMemberId: memberId,
    })
    expect(item.checkedAt).toBeNull()
    expect(item.checkedByMemberId).toBeNull()
  })

  it('空・100文字超のアイテム名は拒否する', () => {
    const input = { shoppingListId: listId, addedByMemberId: memberId }
    expect(() => createShoppingItem({ ...input, name: ' ' })).toThrow(DomainError)
    expect(() => createShoppingItem({ ...input, name: 'あ'.repeat(101) })).toThrow(DomainError)
  })
})
