import { FamilyRepository, MemberRepository, UserAccountRepository } from '@iegoto/db'
import { TRPCError } from '@trpc/server'
import type { TrpcContext } from '../../../trpc.js'

type AuthedContext = TrpcContext & { userAccountId: NonNullable<TrpcContext['userAccountId']> }

/** ログイン状態・所属家族・メンバー一覧をまとめて返す (SPA bootstrap 用) */
export async function getMe(ctx: AuthedContext) {
  const account = await new UserAccountRepository(ctx.db).find(ctx.userAccountId)
  if (account === null) {
    throw new TRPCError({ code: 'UNAUTHORIZED' })
  }
  const me = await new MemberRepository(ctx.db).findActiveByUserAccount(ctx.userAccountId)
  if (me === null) {
    return {
      account: { email: account.email, displayName: account.displayName },
      family: null,
    }
  }
  const family = await new FamilyRepository(ctx.db).find(me.familyId)
  const members = await new MemberRepository(ctx.db).list(me.familyId, { includeDeleted: true })
  return {
    account: { email: account.email, displayName: account.displayName },
    family:
      family === null
        ? null
        : {
            id: family.id as string,
            name: family.name,
            myMemberId: me.id as string,
            members: members.map((m) => ({
              id: m.id as string,
              displayName: m.displayName,
              color: m.color,
              canLogin: m.userAccountId !== null,
              isDeleted: m.deletedAt !== null,
            })),
          },
  }
}
