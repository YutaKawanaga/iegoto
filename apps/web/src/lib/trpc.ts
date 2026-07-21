import type { AppRouter } from '@iegoto/api'
import { createTRPCContext } from '@trpc/tanstack-react-query'

/** tRPC × TanStack Query (T-3)。使用側: const trpc = useTRPC(); useQuery(trpc.xxx.queryOptions()) */
export const { TRPCProvider, useTRPC } = createTRPCContext<AppRouter>()
