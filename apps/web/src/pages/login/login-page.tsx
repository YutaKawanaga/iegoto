import { useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useDocumentTitle } from '@/hooks/use-document-title'

export function LoginPage() {
  useDocumentTitle('ログイン')
  const [params] = useSearchParams()
  const hasError = params.get('error') !== null

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-primary">iegoto</h1>
        <p className="mt-2 text-sm text-muted-foreground">家族の予定・買い物・分担を1か所に</p>
      </div>
      {hasError && (
        <p className="text-sm text-destructive">ログインに失敗しました。もう一度お試しください</p>
      )}
      <Button
        size="lg"
        className="w-full max-w-xs"
        onClick={() => window.location.assign('/auth/google')}
      >
        Googleでログイン
      </Button>
      {import.meta.env.DEV && (
        <Button
          variant="outline"
          className="w-full max-w-xs"
          onClick={() => window.location.assign('/auth/dev?email=dev@example.com')}
        >
          開発用ログイン
        </Button>
      )}
    </div>
  )
}
