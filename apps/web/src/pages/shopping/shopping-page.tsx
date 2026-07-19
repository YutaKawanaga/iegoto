import { ShoppingContainer } from '@/components/shopping-container/shopping-container'
import { Spinner } from '@/components/ui/spinner'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { useMe } from '@/hooks/use-me'

export function ShoppingPage() {
  useDocumentTitle('買い物リスト')
  const { me } = useMe()
  if (me?.family == null) {
    return <Spinner />
  }
  return <ShoppingContainer family={me.family} />
}
