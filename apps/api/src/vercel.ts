import { handle } from 'hono/vercel'
import { app } from './app.js'

/**
 * Vercel Functions のバンドル元エントリ。
 * scripts/build-vercel-function.mjs が esbuild でこれを api/index.js に単一バンドルする
 * (ソース直接 export の内部パッケージは素の Node 解決では .ts を読めないため、
 * ランタイムのモジュール解決を丸ごと排除する。10-vercel-hosting.md)
 */
export default handle(app)
