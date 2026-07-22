import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useAppToast } from '@/hooks/use-app-toast'
import { usePersistentState } from '@/hooks/use-persistent-state'
import { useRealtime } from '@/hooks/use-realtime'
import { useTRPC } from '@/lib/trpc'

/** 履歴が少ないうちのクイック追加候補: 一般的な定番アイテム */
const PRESET_ITEMS = [
  '牛乳',
  '卵',
  'パン',
  '米',
  '納豆',
  '豆腐',
  'ヨーグルト',
  'バナナ',
  '鶏肉',
  '豚肉',
  '玉ねぎ',
  'にんじん',
  'じゃがいも',
  'トイレットペーパー',
  'ティッシュ',
  '洗剤',
] as const

const MAX_SUGGESTIONS = 12

/** 買い物リスト (F-05)。チェック操作のみ楽観更新 (06 §4) */
export function useShopping() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const toast = useAppToast()
  useRealtime('shopping')

  const listsQuery = useQuery(trpc.shopping.lists.queryOptions())
  // タブ切替 (unmount) 後も選択中リストを維持するため永続化 (localStorage)
  const [activeListId, setActiveListId] = usePersistentState<string | null>(
    'iegoto.shopping.activeListId',
    null,
  )
  const [newItemName, setNewItemName] = useState('')
  const [newListName, setNewListName] = useState('')
  const [isAddingList, setIsAddingList] = useState(false)

  const lists = listsQuery.data ?? []
  const activeList = lists.find((l) => l.id === activeListId) ?? lists[0] ?? null

  // クイック追加候補: 家族の履歴 (頻度順) を優先し、定番で補完。未購入で入っている物は除く
  const frequentQuery = useQuery(trpc.shopping.frequentItems.queryOptions())
  const unchecked = new Set(
    (activeList?.items ?? []).filter((i) => i.checkedAt === null).map((i) => i.name),
  )
  const suggestions =
    activeList === null
      ? []
      : [...new Set([...(frequentQuery.data ?? []), ...PRESET_ITEMS])]
          .filter((name) => !unchecked.has(name))
          .slice(0, MAX_SUGGESTIONS)

  const invalidate = () => queryClient.invalidateQueries(trpc.shopping.pathFilter())

  const addItem = useMutation(
    trpc.shopping.addItem.mutationOptions({
      onSuccess: () => {
        setNewItemName('')
        return invalidate()
      },
      onError: (e) => toast.error(e.message),
    }),
  )

  const listsQueryKey = trpc.shopping.lists.queryOptions().queryKey

  const setChecked = useMutation(
    trpc.shopping.setItemChecked.mutationOptions({
      // 楽観更新: チェックの体感を即時に (F-05)
      onMutate: async (input) => {
        await queryClient.cancelQueries({ queryKey: listsQueryKey })
        const previous = queryClient.getQueryData(listsQueryKey)
        queryClient.setQueryData(listsQueryKey, (old) =>
          old?.map((list) => ({
            ...list,
            items: list.items.map((item) =>
              item.id === input.itemId
                ? { ...item, checkedAt: input.checked ? new Date() : null }
                : item,
            ),
          })),
        )
        return { previous }
      },
      onError: (_e, _input, ctx) => {
        if (ctx?.previous !== undefined) {
          queryClient.setQueryData(listsQueryKey, ctx.previous)
        }
        toast.error('更新に失敗しました')
      },
      onSettled: () => invalidate(),
    }),
  )

  const deleteItem = useMutation(
    trpc.shopping.deleteItem.mutationOptions({
      onSuccess: invalidate,
      onError: (e) => toast.error(e.message),
    }),
  )

  const createList = useMutation(
    trpc.shopping.createList.mutationOptions({
      onSuccess: async (data) => {
        setNewListName('')
        setIsAddingList(false)
        setActiveListId(data.listId)
        await invalidate()
      },
      onError: (e) => toast.error(e.message),
    }),
  )

  const deleteList = useMutation(
    trpc.shopping.deleteList.mutationOptions({
      onSuccess: async () => {
        setActiveListId(null)
        await invalidate()
        toast.success('リストを削除しました')
      },
      onError: (e) => toast.error(e.message),
    }),
  )

  return {
    isLoading: listsQuery.isLoading,
    lists,
    activeList,
    setActiveListId,
    newItemName,
    setNewItemName,
    submitNewItem: () => {
      // isPending ガード: 連打による二重登録防止 (ボタン disable と二段構え)
      if (activeList !== null && newItemName.trim().length > 0 && !addItem.isPending) {
        addItem.mutate({ listId: activeList.id, name: newItemName })
      }
    },
    isAddingItem: addItem.isPending,
    suggestions,
    quickAddItem: (name: string) => {
      if (activeList !== null && !addItem.isPending) {
        addItem.mutate({ listId: activeList.id, name })
      }
    },
    toggleItem: (itemId: string, checked: boolean) => setChecked.mutate({ itemId, checked }),
    removeItem: (itemId: string) => deleteItem.mutate({ itemId }),
    isAddingList,
    setIsAddingList,
    newListName,
    setNewListName,
    submitNewList: () => {
      if (newListName.trim().length > 0 && !createList.isPending) {
        createList.mutate({ name: newListName })
      }
    },
    isCreatingList: createList.isPending,
    removeActiveList: () => {
      if (activeList !== null && !deleteList.isPending) {
        deleteList.mutate({ listId: activeList.id })
      }
    },
    isDeletingList: deleteList.isPending,
  }
}
