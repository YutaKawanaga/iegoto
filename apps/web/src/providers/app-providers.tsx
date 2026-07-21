import type { AppRouter } from '@iegoto/api'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createTRPCClient, httpBatchLink } from '@trpc/client'
import { type ReactNode, useState } from 'react'
import { Toaster } from 'sonner'
import superjson from 'superjson'
import { TRPCProvider } from '@/lib/trpc'

/** QueryClient 既定 (plainer の query-provider 相当: staleTime 60s / retry 1) */
function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        gcTime: 5 * 60 * 1000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  })
}

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(makeQueryClient)
  const [trpcClient] = useState(() =>
    createTRPCClient<AppRouter>({
      links: [httpBatchLink({ url: '/trpc', transformer: superjson })],
    }),
  )
  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
        {children}
        <Toaster position="top-center" richColors />
      </TRPCProvider>
    </QueryClientProvider>
  )
}
