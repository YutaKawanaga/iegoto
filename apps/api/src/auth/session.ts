import { randomBytes } from 'node:crypto'
import type { SessionId, UserAccountId } from '@iegoto/domain'
import { toId } from '@iegoto/domain'
import { type Db, SessionRepository } from '@iegoto/db'
import type { Context } from 'hono'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import { isProduction } from '../config/env.js'

export const SESSION_COOKIE = 'iegoto_session'
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30日 (スライディング更新。07 §8)

export function newSessionId(): SessionId {
  return toId<'Session'>(randomBytes(32).toString('base64url'))
}

/** ログイン成功時に必ず新しいセッション ID を発行する (セッション固定攻撃対策。07 §8) */
export async function issueSession(c: Context, db: Db, userAccountId: UserAccountId): Promise<void> {
  const id = newSessionId()
  await new SessionRepository(db).create({
    id,
    userAccountId,
    expiresAt: new Date(Date.now() + SESSION_TTL_MS),
  })
  setCookie(c, SESSION_COOKIE, id, {
    httpOnly: true,
    secure: isProduction(),
    sameSite: 'Lax',
    path: '/',
    maxAge: SESSION_TTL_MS / 1000,
  })
}

export async function resolveSession(
  c: Context,
  db: Db,
): Promise<{ sessionId: SessionId; userAccountId: UserAccountId } | null> {
  const raw = getCookie(c, SESSION_COOKIE)
  if (raw === undefined || raw.length === 0) {
    return null
  }
  const sessionId = toId<'Session'>(raw)
  const repo = new SessionRepository(db)
  const session = await repo.findValid(sessionId, new Date())
  if (session === null) {
    return null
  }
  // スライディング更新 (残り15日を切ったら延長。毎リクエスト UPDATE を避ける)
  if (session.expiresAt.getTime() - Date.now() < SESSION_TTL_MS / 2) {
    await repo.extend(sessionId, new Date(Date.now() + SESSION_TTL_MS))
  }
  return { sessionId, userAccountId: session.userAccountId }
}

export async function destroySession(c: Context, db: Db): Promise<void> {
  const raw = getCookie(c, SESSION_COOKIE)
  if (raw !== undefined && raw.length > 0) {
    await new SessionRepository(db).delete(toId<'Session'>(raw))
  }
  deleteCookie(c, SESSION_COOKIE, { path: '/' })
}
