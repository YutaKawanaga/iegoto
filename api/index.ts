import { handle } from 'hono/vercel'
import { app } from '../apps/api/src/app.js'

/**
 * Vercel Functions エントリ (10-vercel-hosting.md)。
 * vercel.json の rewrites が /trpc /auth /jobs /health をこの関数に向ける。
 * rewrite でも関数にはリクエスト元のパスがそのまま渡るため、Hono アプリはローカルと同一
 */
export default handle(app)
