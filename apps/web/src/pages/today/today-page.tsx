import { TodayContainer } from '@/components/today-container/today-container'
import { Spinner } from '@/components/ui/spinner'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { useMe } from '@/hooks/use-me'

export function TodayPage() {
  useDocumentTitle('今日')
  const { me } = useMe()
  if (me?.family == null) {
    return <Spinner />
  }
  return <TodayContainer family={me.family} />
}
