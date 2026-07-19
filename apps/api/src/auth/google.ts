import { Google, decodeIdToken, generateCodeVerifier, generateState } from 'arctic'
import { UserAccountRepository } from '@iegoto/db'
import { Hono } from 'hono'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import { getDb } from '@iegoto/db'
import { isProduction, loadEnv } from '../config/env.js'
import { destroySession, issueSession } from './session.js'

/**
 * Google OAuth (ログイン用。scope は openid/email/profile のみ — 07 §8)。
 * プロトコル部分は Arctic に任せ、state + PKCE を必須にする。
 * カレンダー連携 (T-7) は別の認可フローで、ここには足さない
 */

const STATE_COOKIE = 'iegoto_oauth_state'
const VERIFIER_COOKIE = 'iegoto_oauth_verifier'

function googleClient(): Google {
  const env = loadEnv()
  return new Google(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    `${env.API_ORIGIN}/auth/google/callback`,
  )
}

export const authRouter = new Hono()

authRouter.get('/google', (c) => {
  const state = generateState()
  const codeVerifier = generateCodeVerifier()
  const url = googleClient().createAuthorizationURL(state, codeVerifier, [
    'openid',
    'email',
    'profile',
  ])
  const cookieOpts = {
    httpOnly: true,
    secure: isProduction(),
    sameSite: 'Lax',
    path: '/',
    maxAge: 600,
  } as const
  setCookie(c, STATE_COOKIE, state, cookieOpts)
  setCookie(c, VERIFIER_COOKIE, codeVerifier, cookieOpts)
  return c.redirect(url.toString())
})

authRouter.get('/google/callback', async (c) => {
  const env = loadEnv()
  const code = c.req.query('code')
  const state = c.req.query('state')
  const storedState = getCookie(c, STATE_COOKIE)
  const codeVerifier = getCookie(c, VERIFIER_COOKIE)
  deleteCookie(c, STATE_COOKIE, { path: '/' })
  deleteCookie(c, VERIFIER_COOKIE, { path: '/' })

  // state 検証 (CSRF) — 省略禁止 (07 §8 チェックリスト)
  if (
    code === undefined ||
    state === undefined ||
    storedState === undefined ||
    codeVerifier === undefined ||
    state !== storedState
  ) {
    return c.redirect(`${env.APP_ORIGIN}/login?error=auth`)
  }

  try {
    const tokens = await googleClient().validateAuthorizationCode(code, codeVerifier)
    // aud/iss/署名/exp の検証は Arctic (validateAuthorizationCode) がトークンエンドポイント経由で
    // 取得した ID トークンに対して行われている前提。claims の取り出しのみ行う
    const claims = decodeIdToken(tokens.idToken()) as {
      sub: string
      email?: string
      name?: string
      picture?: string
    }
    const db = getDb()
    const account = await new UserAccountRepository(db).upsertByGoogleSub({
      googleSub: claims.sub,
      email: claims.email ?? '',
      displayName: claims.name ?? claims.email ?? 'ユーザー',
      avatarUrl: claims.picture ?? null,
    })
    await issueSession(c, db, account.id)
    // リダイレクト先は APP_ORIGIN 固定 (open redirect 禁止 — 07 §8)
    return c.redirect(`${env.APP_ORIGIN}/`)
  } catch {
    return c.redirect(`${env.APP_ORIGIN}/login?error=auth`)
  }
})

authRouter.post('/logout', async (c) => {
  await destroySession(c, getDb())
  return c.json({ ok: true })
})

/**
 * 開発用ログインバイパス (AUTH_DEV_BYPASS=1 のときのみ)。
 * Google 認証なしでローカル開発・E2E を回すための入口。本番では絶対に有効化しない
 * (plainer の E2eTestAuthConfig 相当)
 */
authRouter.get('/dev', async (c) => {
  const env = loadEnv()
  if (env.AUTH_DEV_BYPASS !== '1' || isProduction()) {
    return c.notFound()
  }
  const email = c.req.query('email') ?? 'dev@example.com'
  const db = getDb()
  const account = await new UserAccountRepository(db).upsertByGoogleSub({
    googleSub: `dev:${email}`,
    email,
    displayName: email.split('@')[0] ?? 'dev',
    avatarUrl: null,
  })
  await issueSession(c, db, account.id)
  return c.redirect(`${env.APP_ORIGIN}/`)
})
