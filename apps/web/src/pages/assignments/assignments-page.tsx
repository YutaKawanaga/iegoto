import { AssignmentsContainer } from '@/components/assignments-container/assignments-container'
import { Spinner } from '@/components/ui/spinner'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { useMe } from '@/hooks/use-me'

export function AssignmentsPage() {
  useDocumentTitle('担当')
  const { me } = useMe()
  if (me?.family == null) {
    return <Spinner />
  }
  return <AssignmentsContainer family={me.family} />
}
