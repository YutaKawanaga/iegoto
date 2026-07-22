import { Copy, LogOut, Trash2, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { FamilyInfo } from '@/hooks/use-me'
import { MEMBER_BG } from '@/lib/member-colors'
import { cn } from '@/lib/utils'
import { useSettings } from './use-settings'

/** 設定画面 (F-01): 家族・メンバー・招待の管理 */
export function SettingsContainer({ family }: { family: FamilyInfo }) {
  const s = useSettings(family)
  const [confirmingLeave, setConfirmingLeave] = useState(false)

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">設定</h1>
      <section>
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">家族</h2>
        <p className="rounded-xl border border-border bg-card p-4 text-sm font-medium">
          {family.name}
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">メンバー</h2>
        <ul className="overflow-hidden rounded-xl border border-border bg-card">
          {s.members
            .filter((m) => !m.isDeleted)
            .map((m) => (
              <li
                key={m.id}
                className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0"
              >
                <span
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white',
                    MEMBER_BG[m.color],
                  )}
                >
                  {m.displayName.slice(0, 1)}
                </span>
                <div className="flex-1">
                  <p className="text-sm font-medium">
                    {m.displayName}
                    {m.id === family.myMemberId && (
                      <span className="ml-1.5 text-xs text-muted-foreground">(自分)</span>
                    )}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {m.canLogin ? 'ログイン可' : 'プロフィールのみ'}
                  </p>
                </div>
                {m.id !== family.myMemberId && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground"
                    aria-label={`${m.displayName}を削除`}
                    onClick={() => {
                      if (window.confirm(`${m.displayName} を削除しますか？過去の予定は残ります`)) {
                        s.removeMember(m.id)
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </li>
            ))}
        </ul>
        <form
          className="mt-2 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            s.submitNewMember()
          }}
        >
          <Input
            placeholder="メンバーを追加 (例: 長男)"
            value={s.newMemberName}
            onChange={(e) => s.setNewMemberName(e.target.value)}
            maxLength={30}
          />
          <Button type="submit" disabled={s.newMemberName.trim().length === 0}>
            <UserPlus className="h-4 w-4" />
            追加
          </Button>
        </form>
        <p className="mt-1 text-xs text-muted-foreground">
          スマホを持たない子どももプロフィールとして追加できます
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">招待</h2>
        <div className="space-y-2 rounded-xl border border-border bg-card p-4">
          {s.inviteUrl !== null ? (
            <>
              <p className="break-all rounded-lg bg-muted p-2 font-mono text-xs">{s.inviteUrl}</p>
              <div className="flex gap-2">
                <Button size="sm" onClick={s.copyInviteUrl}>
                  <Copy className="h-4 w-4" />
                  コピー
                </Button>
                <Button size="sm" variant="outline" onClick={s.revokeInvitation}>
                  無効にする
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                有効期限7日・家族なら何人でも使えます。新しく発行すると古いリンクは無効になります
              </p>
            </>
          ) : (
            <>
              {s.hasActiveInvitation && (
                <p className="text-xs text-muted-foreground">
                  有効な招待リンクがあります
                  (リンクは発行時のみ表示。再発行すると古いものは無効になります)
                </p>
              )}
              <Button size="sm" onClick={s.issueInvitation} disabled={s.isIssuing}>
                招待リンクを発行
              </Button>
              {s.hasActiveInvitation && (
                <Button size="sm" variant="outline" className="ml-2" onClick={s.revokeInvitation}>
                  今のリンクを無効にする
                </Button>
              )}
            </>
          )}
        </div>
      </section>

      <section className="space-y-2">
        <Button variant="outline" className="w-full" onClick={s.logout}>
          <LogOut className="h-4 w-4" />
          ログアウト
        </Button>
        {confirmingLeave ? (
          <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm">
            <p className="mb-2">
              家族から退出しますか？プロフィールと予定は残り、ログインだけできなくなります
            </p>
            <div className="flex gap-2">
              <Button size="sm" variant="destructive" onClick={s.leaveFamily}>
                退出する
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmingLeave(false)}>
                キャンセル
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="ghost"
            className="w-full text-destructive"
            onClick={() => setConfirmingLeave(true)}
          >
            家族から退出する
          </Button>
        )}
      </section>
    </div>
  )
}
