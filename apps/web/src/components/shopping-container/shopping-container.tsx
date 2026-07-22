import { Plus, ShoppingBasket, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import type { FamilyInfo } from '@/hooks/use-me'
import { cn } from '@/lib/utils'
import { useShopping } from './use-shopping'

/** 買い物リスト画面 (F-05): 複数リスト・誰が追加したか表示・リアルタイム反映 */
export function ShoppingContainer({ family }: { family: FamilyInfo }) {
  const s = useShopping()
  const memberName = (id: string | null) =>
    id === null ? '' : (family.members.find((m) => m.id === id)?.displayName ?? '')

  if (s.isLoading) {
    return <Spinner />
  }

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-bold">買い物リスト</h1>
      <div className="flex flex-wrap items-center gap-1.5">
        {s.lists.map((list) => (
          <button
            key={list.id}
            type="button"
            onClick={() => s.setActiveListId(list.id)}
            className={cn(
              'rounded-full border border-border px-3 py-1.5 text-sm',
              s.activeList?.id === list.id && 'border-primary bg-primary/10 font-medium',
            )}
          >
            {list.name}
            <span className="ml-1 text-xs text-muted-foreground">
              {list.items.filter((i) => i.checkedAt === null).length}
            </span>
          </button>
        ))}
        {s.lists.length > 0 &&
          (s.isAddingList ? (
            <form
              className="flex items-center gap-1"
              onSubmit={(e) => {
                e.preventDefault()
                s.submitNewList()
              }}
            >
              <Input
                className="h-8 w-36"
                placeholder="リスト名"
                value={s.newListName}
                onChange={(e) => s.setNewListName(e.target.value)}
                maxLength={50}
                autoFocus
              />
              <Button type="submit" size="sm">
                作成
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => s.setIsAddingList(false)}
              >
                取消
              </Button>
            </form>
          ) : (
            <Button variant="outline" size="sm" onClick={() => s.setIsAddingList(true)}>
              <Plus className="h-4 w-4" />
              リストを追加
            </Button>
          ))}
      </div>

      {s.activeList === null ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 px-6 py-12 text-center">
          <ShoppingBasket className="mx-auto mb-3 h-10 w-10 text-primary/60" />
          <p className="mb-1 text-sm font-medium">最初の買い物リストを作りましょう</p>
          <p className="mb-4 text-xs text-muted-foreground">
            食料品・日用品など、用途ごとに複数のリストを作れます
          </p>
          <form
            className="mx-auto flex max-w-xs items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              s.submitNewList()
            }}
          >
            <Input
              placeholder="例: 食料品"
              value={s.newListName}
              onChange={(e) => s.setNewListName(e.target.value)}
              maxLength={50}
            />
            <Button type="submit" disabled={s.newListName.trim().length === 0}>
              作成
            </Button>
          </form>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card">
          <form
            className="flex items-center gap-2 border-b border-border p-3"
            onSubmit={(e) => {
              e.preventDefault()
              s.submitNewItem()
            }}
          >
            <Input
              placeholder="アイテムを追加 (例: 牛乳)"
              value={s.newItemName}
              onChange={(e) => s.setNewItemName(e.target.value)}
              maxLength={100}
            />
            <Button type="submit" disabled={s.newItemName.trim().length === 0}>
              追加
            </Button>
          </form>
          <ul>
            {s.activeList.items.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-3 border-b border-border px-3 py-2.5 last:border-b-0"
              >
                <Checkbox
                  checked={item.checkedAt !== null}
                  onCheckedChange={(v) => s.toggleItem(item.id, v === true)}
                  aria-label={item.name}
                />
                <div className="flex-1">
                  <p
                    className={cn(
                      'text-sm',
                      item.checkedAt !== null && 'text-muted-foreground line-through',
                    )}
                  >
                    {item.name}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {memberName(item.addedByMemberId)}が追加
                    {item.checkedAt !== null &&
                      item.checkedByMemberId !== null &&
                      ` ・ ${memberName(item.checkedByMemberId)}が購入`}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground"
                  aria-label="削除"
                  onClick={() => s.removeItem(item.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
            {s.activeList.items.length === 0 && (
              <li className="px-3 py-8 text-center text-sm text-muted-foreground">
                アイテムがありません
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
