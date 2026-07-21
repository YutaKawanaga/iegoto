import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import { Hono } from 'hono'
import { authRouter } from './auth/google.js'
import { appRouter } from './modules/router.js'
import { createContext } from './trpc.js'

/**
 * Hono アプリ本体。エントリは2つ:
 * - ローカル/Cloud Run: server.ts (@hono/node-server)
 * - Vercel: リポジトリ直下 api/index.ts (hono/vercel アダプタ)
 * SPA の静的配信は本番では Vercel/コンテナ側が担う (O-1 単一オリジン構成)
 */
export const app = new Hono()

app.get('/health', (c) => c.json({ ok: true }))

app.route('/auth', authRouter)

app.all('/trpc/*', (c) =>
  fetchRequestHandler({
    endpoint: '/trpc',
    req: c.req.raw,
    router: appRouter,
    createContext: () => createContext(c),
  }),
)

export type { AppRouter } from './modules/router.js'
