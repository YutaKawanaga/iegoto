import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Spinner } from '@/components/ui/spinner'
import { useInviteJoin } from './use-invite-join'

export function InviteJoinContainer({ token }: { token: string }) {
  const j = useInviteJoin(token)

  if (j.meLoading) {
    return <Spinner className="mt-24" />
  }

  if (j.isUnauthorized) {
    return (
      <Shell>
        <p className="text-sm text-muted-foreground">
          家族に参加するには、まずGoogleでログインしてください
        </p>
        <Button size="lg" className="w-full" onClick={j.loginAndComeBack}>
          Googleでログインして参加する
        </Button>
      </Shell>
    )
  }

  if (j.alreadyInFamily) {
    return (
      <Shell>
        <p className="text-sm">すでに家族に所属しています (1アカウント1家族)</p>
        <Button className="w-full" onClick={() => window.location.assign('/')}>
          ホームへ
        </Button>
      </Shell>
    )
  }

  if (j.previewLoading) {
    return <Spinner className="mt-24" />
  }

  // 無効トークンには情報を一切出さない (S-2)
  if (j.preview === null || j.preview.status === 'invalid') {
    return (
      <Shell>
        <p className="text-sm">リンクが無効です</p>
        <Link to="/" className="text-sm text-primary underline">
          ホームへ
        </Link>
      </Shell>
    )
  }

  return (
    <Shell>
      <div>
        <h1 className="text-xl font-bold">「{j.preview.familyName}」に参加</h1>
        <p className="mt-1 text-sm text-muted-foreground">参加方法を選んでください</p>
      </div>
      <RadioGroup
        value={j.mode}
        onValueChange={(v) => j.setMode(v as 'new' | 'link')}
        className="space-y-3"
      >
        <label className="flex items-start gap-3 rounded-lg border border-border bg-card p-3">
          <RadioGroupItem value="new" className="mt-0.5" />
          <span>
            <span className="block text-sm font-medium">新しいプロフィールで参加</span>
            {j.mode === 'new' && (
              <Input
                className="mt-2"
                placeholder="表示名 (例: ママ)"
                value={j.displayName}
                onChange={(e) => j.setDisplayName(e.target.value)}
                maxLength={30}
              />
            )}
          </span>
        </label>
        {j.preview.linkableMembers.length > 0 && (
          <label className="flex items-start gap-3 rounded-lg border border-border bg-card p-3">
            <RadioGroupItem value="link" className="mt-0.5" />
            <span className="flex-1">
              <span className="block text-sm font-medium">
                既存のプロフィールに紐づける (子どもの昇格など)
              </span>
              {j.mode === 'link' && (
                <span className="mt-2 block space-y-2">
                  {j.preview.linkableMembers.map((m) => (
                    <label key={m.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name="link-member"
                        checked={j.memberId === m.id}
                        onChange={() => j.setMemberId(m.id)}
                      />
                      {m.displayName}
                    </label>
                  ))}
                </span>
              )}
            </span>
          </label>
        )}
      </RadioGroup>
      <Button
        size="lg"
        className="w-full"
        disabled={!j.canSubmit || j.isJoining}
        onClick={j.submit}
      >
        参加する
      </Button>
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-5 px-6">
      <p className="text-center text-2xl font-bold text-primary">iegoto</p>
      {children}
    </div>
  )
}
