import { PrismaClient } from './generated/client/index.js'

export type Db = PrismaClient
/** $transaction のコールバックに渡るトランザクションスコープのクライアント */
export type Tx = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>

let singleton: PrismaClient | undefined

/**
 * PrismaClient を生成する。サーバレス (Vercel) では モジュールスコープの
 * シングルトンを再利用してコネクション枯渇を防ぐ。
 * 本番 (Neon) は pooler 経由の DATABASE_URL を渡すこと (10-vercel-hosting.md)
 */
export function getDb(): Db {
  if (singleton === undefined) {
    singleton = new PrismaClient()
  }
  return singleton
}

export { PrismaClient }
