import { useParams } from 'react-router-dom'
import { InviteJoinContainer } from '@/components/invite-join-container/invite-join-container'
import { useDocumentTitle } from '@/hooks/use-document-title'

export function InviteJoinPage() {
  useDocumentTitle('家族に参加')
  const { token } = useParams<{ token: string }>()
  if (token === undefined) {
    return null
  }
  return <InviteJoinContainer token={token} />
}
