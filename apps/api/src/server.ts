import { serve } from '@hono/node-server'
import { app } from './app.js'
import { loadEnv } from './config/env.js'

/** ローカル開発用エントリ (pnpm --filter @iegoto/api dev)。ポート8000 (06: Vite が /trpc をプロキシ) */
loadEnv()
const port = Number(process.env.PORT ?? 8000)
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`iegoto api: http://localhost:${info.port}`)
})
