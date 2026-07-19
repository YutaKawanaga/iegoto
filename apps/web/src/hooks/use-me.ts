import { useQuery } from '@tanstack/react-query'
import { useTRPC } from '@/lib/trpc'

/**
 * SPA bootstrap: ログイン状態と所属家族。
 * 401 → 未ログイン (login へ) / family null → 未所属 (onboarding へ)
 */
export function useMe() {
  const trpc = useTRPC()
  const query = useQuery({
    ...trpc.account.me.queryOptions(),
    retry: false,
    staleTime: 5 * 60 * 1000,
  })
  const unauthorized =
    query.error !== null && 'data' in query.error && query.error.data?.code === 'UNAUTHORIZED'
  return {
    me: query.data ?? null,
    isLoading: query.isLoading,
    isUnauthorized: unauthorized,
    refetch: query.refetch,
  }
}

export type Me = NonNullable<ReturnType<typeof useMe>['me']>
export type FamilyInfo = NonNullable<Me['family']>
export type MemberInfo = FamilyInfo['members'][number]
