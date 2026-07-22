import { ListChecks, UserCheck, Users } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { AppLogo } from '@/components/ui/app-logo'
import { Button } from '@/components/ui/button'
import { useDocumentTitle } from '@/hooks/use-document-title'

const FEATURES = [
  { icon: Users, text: 'スマホを持たない子どもも予定の主体に' },
  { icon: UserCheck, text: '「誰の予定か」と「誰が対応するか」を分けて管理' },
  { icon: ListChecks, text: '買い物リストも家族でリアルタイム共有' },
] as const

export function LoginPage() {
  useDocumentTitle('ログイン')
  const [params] = useSearchParams()
  const hasError = params.get('error') !== null

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-gradient-to-b from-primary/10 via-background to-background px-6">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-lg">
        <div className="mb-6 text-center">
          <AppLogo className="mx-auto mb-3 h-20 w-20" />
          <h1 className="text-3xl font-bold tracking-tight text-primary">iegoto</h1>
          <p className="mt-2 text-sm text-muted-foreground">家族の予定・買い物・分担を1か所に</p>
        </div>

        <ul className="mb-6 space-y-2.5">
          {FEATURES.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-start gap-2.5 text-xs text-muted-foreground">
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              {text}
            </li>
          ))}
        </ul>

        {hasError && (
          <p className="mb-3 rounded-lg bg-destructive/10 p-2 text-center text-xs text-destructive">
            ログインに失敗しました。もう一度お試しください
          </p>
        )}
        <Button size="lg" className="w-full" onClick={() => window.location.assign('/auth/google')}>
          Googleでログイン
        </Button>
        {import.meta.env.DEV && (
          <Button
            variant="outline"
            className="mt-2 w-full"
            onClick={() => window.location.assign('/auth/dev?email=dev@example.com')}
          >
            開発用ログイン
          </Button>
        )}
      </div>
      <p className="mt-6 text-xs text-muted-foreground">家族専用のWebカレンダー</p>
    </div>
  )
}
