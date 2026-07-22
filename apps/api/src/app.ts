import { getDb } from '@iegoto/db'
import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import { Hono } from 'hono'
import { authRouter } from './auth/google.js'
import { loadEnv } from './config/env.js'
import { dispatchDueReminders } from './modules/push/dispatch-reminders.js'
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

// リマインダー配信ジョブ (F-08)。CRON_SECRET を持つ呼び出し元 (GitHub Actions) のみ実行可
app.post('/jobs/dispatch-reminders', async (c) => {
  const secret = loadEnv().CRON_SECRET
  if (secret === undefined || secret === '') {
    return c.json({ error: 'CRON_SECRET not configured' }, 503)
  }
  if (c.req.header('authorization') !== `Bearer ${secret}`) {
    return c.json({ error: 'unauthorized' }, 401)
  }
  const result = await dispatchDueReminders(getDb(), new Date())
  return c.json(result)
})

app.all('/trpc/*', (c) =>
  fetchRequestHandler({
    endpoint: '/trpc',
    req: c.req.raw,
    router: appRouter,
    createContext: () => createContext(c),
  }),
)

export type { AppRouter } from './modules/router.js'
