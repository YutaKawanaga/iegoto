import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Spinner } from '@/components/ui/spinner'
import { useMe } from '@/hooks/use-me'

/**
 * 認証ガード (06 §3): /login と /invite/:token 以外はすべて保護。
 * 未ログイン → /login、家族未所属 → /onboarding へ誘導
 */
export function ProtectedRoutes() {
  const { me, isLoading, isUnauthorized } = useMe()
  const location = useLocation()

  if (isLoading) {
    return <Spinner className="mt-24" />
  }
  if (isUnauthorized || me === null) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  if (me.family === null && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />
  }
  if (me.family !== null && location.pathname === '/onboarding') {
    return <Navigate to="/" replace />
  }
  return <Outlet />
}
