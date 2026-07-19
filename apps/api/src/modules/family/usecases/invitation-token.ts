import { createHash, randomBytes } from 'node:crypto'

/**
 * 招待トークン (S-2): 256bit 乱数を URL セーフ Base64 で表現。
 * DB にはハッシュのみ保存 (パスワードと同じ扱い)。
 * トークンはログに出力しないこと (07 §8 チェックリスト)
 */
export function generateInvitationToken(): string {
  return randomBytes(32).toString('base64url')
}

export function hashInvitationToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}
