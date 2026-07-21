import { CalendarContainer } from '@/components/calendar-container/calendar-container'
import { Spinner } from '@/components/ui/spinner'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { useMe } from '@/hooks/use-me'

export function CalendarPage() {
  useDocumentTitle('カレンダー')
  const { me } = useMe()
  if (me?.family == null) {
    return <Spinner />
  }
  return <CalendarContainer family={me.family} />
}
