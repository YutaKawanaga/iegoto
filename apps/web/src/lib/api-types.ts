import type { AppRouter } from '@iegoto/api'
import type { inferRouterOutputs } from '@trpc/server'

/** API 出力型は AppRouter から推論する (手書き API 型の禁止。06 §4) */
export type RouterOutputs = inferRouterOutputs<AppRouter>

export type Occurrence = RouterOutputs['event']['listInRange'][number]
export type ShoppingListWithItems = RouterOutputs['shopping']['lists'][number]
export type SuggestItem = RouterOutputs['event']['suggest'][number]
