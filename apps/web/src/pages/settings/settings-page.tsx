import { SettingsContainer } from '@/components/settings-container/settings-container'
import { Spinner } from '@/components/ui/spinner'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { useMe } from '@/hooks/use-me'

export function SettingsPage() {
  useDocumentTitle('設定')
  const { me } = useMe()
  if (me?.family == null) {
    return <Spinner />
  }
  return <SettingsContainer family={me.family} />
}
