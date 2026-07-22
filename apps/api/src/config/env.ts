import { z } from 'zod'

/** 環境変数の型付きロード。起動時に parse して fail-fast する (07 §1) */
const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  GOOGLE_CLIENT_ID: z.string().default(''),
  GOOGLE_CLIENT_SECRET: z.string().default(''),
  /** SPA のオリジン。本番は API と同一オリジン (O-1 配信構成) */
  APP_ORIGIN: z.string().default('http://localhost:7475'),
  /** OAuth callback を受ける API 自身のオリジン */
  API_ORIGIN: z.string().default('http://localhost:8000'),
  /** '1' で開発用ログインバイパス有効 (本番では設定しない) */
  AUTH_DEV_BYPASS: z.string().optional(),
  CRON_SECRET: z.string().optional(),
  /** Web Push (F-08)。未設定なら通知機能は無効のまま起動する */
  VAPID_PUBLIC_KEY: z.string().default(''),
  VAPID_PRIVATE_KEY: z.string().default(''),
  VAPID_SUBJECT: z.string().default('mailto:admin@example.com'),
  NODE_ENV: z.string().default('development'),
})

export type Env = z.infer<typeof envSchema>

let cached: Env | undefined

export function loadEnv(): Env {
  if (cached === undefined) {
    cached = envSchema.parse(process.env)
  }
  return cached
}

export function isProduction(): boolean {
  return loadEnv().NODE_ENV === 'production'
}
