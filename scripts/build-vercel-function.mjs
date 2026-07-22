/**
 * Vercel Functions 用に API を単一ファイルへバンドルする (vercel.json の buildCommand から実行)。
 *
 * - 出力: api/index.js (CJS 単一ファイル)。内部パッケージはソース直接 export のため
 *   素の Node 解決では動かず、ランタイムのモジュール解決をバンドルで丸ごと排除する
 * - Prisma のネイティブエンジン (*.node) はバンドルに base64 埋め込みし、
 *   起動時に /tmp へ書き出して PRISMA_QUERY_ENGINE_LIBRARY で指す
 *   (Vercel の includeFiles が関数へ同梱してくれないため、成果物を完全自己完結にする)
 */
import { readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { build } from 'esbuild'

const root = resolve(import.meta.dirname, '..')

const clientDir = resolve(root, 'packages/db/src/generated/client')
const engines = readdirSync(clientDir).filter((f) => f.endsWith('.node'))
// Vercel ランタイムは rhel。無ければローカル検証用に手元プラットフォームのものを使う
const engine = engines.find((f) => f.includes('rhel-openssl-3.0.x')) ?? engines[0]
if (engine === undefined) {
  throw new Error(`Prisma エンジンが見つかりません: ${clientDir} (先に prisma generate を実行)`)
}
const enginePath = resolve(clientDir, engine).replaceAll('\\', '/')

const entry = `
import { existsSync, writeFileSync } from 'node:fs'
// esbuild の binary loader で .node をバンドルへ埋め込む
import engineBytes from ${JSON.stringify(enginePath)}
const engineFile = '/tmp/${engine}'
if (!existsSync(engineFile)) {
  writeFileSync(engineFile, engineBytes)
}
process.env.PRISMA_QUERY_ENGINE_LIBRARY = engineFile
export { default } from ${JSON.stringify(resolve(root, 'apps/api/src/vercel.ts').replaceAll('\\', '/'))}
`

await build({
  stdin: {
    contents: entry,
    resolveDir: root,
    sourcefile: 'vercel-function-entry.mjs',
    loader: 'js',
  },
  outfile: resolve(root, 'api/_bundle.cjs'),
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  sourcemap: true,
  logLevel: 'info',
  loader: { '.node': 'binary' },
})
console.log(`embedded prisma engine: ${engine}`)
