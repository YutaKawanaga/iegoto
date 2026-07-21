/**
 * branded type による ID。エンティティ間の ID 取り違えをコンパイルエラーにする
 * (07-backend-design.md §2。plainer の Id<T> 相当)
 */
export type Id<T extends string> = string & { readonly __brand: T }

export type FamilyId = Id<'Family'>
export type UserAccountId = Id<'UserAccount'>
export type MemberId = Id<'Member'>
export type InvitationId = Id<'Invitation'>
export type EventId = Id<'Event'>
export type EventOverrideId = Id<'EventOverride'>
export type ShoppingListId = Id<'ShoppingList'>
export type ShoppingItemId = Id<'ShoppingItem'>
export type SessionId = Id<'Session'>

export function newId<T extends string>(): Id<T> {
  return crypto.randomUUID() as Id<T>
}

export function toId<T extends string>(value: string): Id<T> {
  return value as Id<T>
}
