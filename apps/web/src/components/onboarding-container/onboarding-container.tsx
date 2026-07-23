import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useOnboarding } from './use-onboarding'

export function OnboardingContainer() {
  const o = useOnboarding()
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-6">
      <div>
        <h1 className="text-2xl font-bold">家族をつくる</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          招待リンクをもらっている場合は、そのリンクを開いてください
        </p>
      </div>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="family-name">家族の名前</Label>
          <Input
            id="family-name"
            placeholder="例: 山田家"
            value={o.familyName}
            onChange={(e) => o.setFamilyName(e.target.value)}
            maxLength={50}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="my-name">あなたの表示名</Label>
          <Input
            id="my-name"
            placeholder="例: パパ"
            value={o.myDisplayName}
            onChange={(e) => o.setMyDisplayName(e.target.value)}
            maxLength={30}
          />
        </div>
        <Button
          className="w-full"
          size="lg"
          disabled={!o.canSubmit || o.isPending}
          onClick={o.submit}
        >
          家族をつくる
        </Button>
      </div>
    </div>
  )
}
