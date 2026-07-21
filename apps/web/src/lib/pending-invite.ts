/**
 * 招待リンク → Google ログイン → 復帰の橋渡し。
 * OAuth のリダイレクト先は APP_ORIGIN 固定 (open redirect 禁止。07 §8) のため、
 * 招待トークンは sessionStorage に退避してログイン後に合流画面へ戻す
 */
const KEY = 'iegoto:pending-invite-token'

export function storePendingInviteToken(token: string): void {
  sessionStorage.setItem(KEY, token)
}

export function consumePendingInviteToken(): string | null {
  const token = sessionStorage.getItem(KEY)
  sessionStorage.removeItem(KEY)
  return token
}
