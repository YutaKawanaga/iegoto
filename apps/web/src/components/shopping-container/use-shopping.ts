import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useAppToast } from '@/hooks/use-app-toast'
import { useRealtime } from '@/hooks/use-realtime'
import { useTRPC } from '@/lib/trpc'

/** 買い物リスト (F-05)。チェック操作のみ楽観更新 (06 §4) */
export function useShopping() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const toast = useAppToast()
  useRealtime('shopping')

  const listsQuery = useQuery(trpc.shopping.lists.queryOptions())
  const [activeListId, setActiveListId] = useState<string | null>(null)
  const [newItemName, setNewItemName] = useState('')
  const [newListName, setNewListName] = useState('')
  const [isAddingList, setIsAddingList] = useState(false)

  const lists = listsQuery.data ?? []
  const activeList = lists.find((l) => l.id === activeListId) ?? lists[0] ?? null

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
      if (activeList !== null && newItemName.trim().length > 0) {
        addItem.mutate({ listId: activeList.id, name: newItemName })
      }
    },
    toggleItem: (itemId: string, checked: boolean) => setChecked.mutate({ itemId, checked }),
    removeItem: (itemId: string) => deleteItem.mutate({ itemId }),
    isAddingList,
    setIsAddingList,
    newListName,
    setNewListName,
    submitNewList: () => {
      if (newListName.trim().length > 0) {
        createList.mutate({ name: newListName })
      }
    },
    removeActiveList: () => {
      if (activeList !== null) {
        deleteList.mutate({ listId: activeList.id })
      }
    },
  }
}
