import { describe, expect, it } from 'vitest'
import { DomainError } from '../shared/errors.js'
import { newId } from '../shared/id.js'
import { createFamily } from './family.js'
import { invitationExpiry, isInvitationUsable } from './invitation.js'
import { createMember, MEMBER_COLORS, validateDisplayName } from './member.js'

describe('createFamily', () => {
  it('名前を trim して家族を作る', () => {
    expect(createFamily('  山田家  ').name).toBe('山田家')
  })

  it('空・50文字超は拒否する', () => {
    expect(() => createFamily('   ')).toThrow(DomainError)
    expect(() => createFamily('あ'.repeat(51))).toThrow(DomainError)
  })
})

describe('createMember / validateDisplayName', () => {
  it('userAccountId 省略時は null (子どもプロフィール = S-1)', () => {
    const member = createMember({
      familyId: newId<'Family'>(),
      displayName: '長男',
      color: MEMBER_COLORS[0],
      sortOrder: 1,
    })
    expect(member.userAccountId).toBeNull()
    expect(member.deletedAt).toBeNull()
  })

  it('表示名は 1〜30 文字 (trim 後)', () => {
    expect(validateDisplayName(' パパ ')).toBe('パパ')
    expect(() => validateDisplayName('  ')).toThrow(DomainError)
    expect(() => validateDisplayName('あ'.repeat(31))).toThrow(DomainError)
  })
})

describe('invitation (S-2)', () => {
  const now = new Date('2026-01-10T00:00:00Z')
  const base = {
    id: newId<'Invitation'>(),
    familyId: newId<'Family'>(),
    tokenHash: 'hash',
    expiresAt: invitationExpiry(now),
    revokedAt: null,
    createdByMemberId: newId<'Member'>(),
  }

  it('有効期限は発行から7日', () => {
    expect(invitationExpiry(now).toISOString()).toBe('2026-01-17T00:00:00.000Z')
  })

  it('期限内かつ未失効のみ使用可能', () => {
    expect(isInvitationUsable(base, now)).toBe(true)
    expect(isInvitationUsable(base, new Date('2026-01-17T00:00:01Z'))).toBe(false)
    expect(isInvitationUsable({ ...base, revokedAt: now }, now)).toBe(false)
  })
})
