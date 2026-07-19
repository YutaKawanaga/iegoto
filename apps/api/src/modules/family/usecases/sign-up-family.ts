import { MEMBER_COLORS, createFamily, createMember } from '@iegoto/domain'
import { FamilyRepository, MemberRepository, UserAccountRepository } from '@iegoto/db'
import { TRPCError } from '@trpc/server'
import type { TrpcContext } from '../../../trpc.js'

export type SignUpFamilyInput = {
  familyName: string
  myDisplayName: string
}

/** F-01 家族アカウント作成。作成者自身の Member も同時に作る */
export async function signUpFamily(
  ctx: TrpcContext & { userAccountId: NonNullable<TrpcContext['userAccountId']> },
  input: SignUpFamilyInput,
): Promise<{ familyId: string }> {
  const existing = await new MemberRepository(ctx.db).findActiveByUserAccount(ctx.userAccountId)
  if (existing !== null) {
    throw new TRPCError({ code: 'CONFLICT', message: 'すでに家族に所属しています' })
  }
  const account = await new UserAccountRepository(ctx.db).find(ctx.userAccountId)
  if (account === null) {
    throw new TRPCError({ code: 'UNAUTHORIZED' })
  }

  const family = createFamily(input.familyName)
  const me = createMember({
    familyId: family.id,
    userAccountId: ctx.userAccountId,
    displayName: input.myDisplayName,
    color: MEMBER_COLORS[0],
    sortOrder: 1,
  })
  await ctx.db.$transaction(async (tx) => {
    await new FamilyRepository(tx).create(family)
    await new MemberRepository(tx).create(me)
  })
  return { familyId: family.id }
}
