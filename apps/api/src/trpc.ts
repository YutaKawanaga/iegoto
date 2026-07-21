import { type Db, getDb, MemberRepository } from '@iegoto/db'
import { DomainError, type FamilyId, type MemberId, type UserAccountId } from '@iegoto/domain'
import { FeatureFlags } from '@iegoto/feature-flags'
import { initTRPC, TRPCError } from '@trpc/server'
import type { Context as HonoContext } from 'hono'
import superjson from 'superjson'
import flagsJson from '../../../flags/feature-flags.json' with { type: 'json' }
import { resolveSession } from './auth/session.js'

/** フラグはビルド時バンドル + 起動時 parse で fail-fast (08 §2) */
export const featureFlags = FeatureFlags.parse(flagsJson)

export type TrpcContext = {
  db: Db
  userAccountId: UserAccountId | null
}

/** familyProcedure を通過した後の Context (07 §4 FamilyContext) */
export type FamilyContext = TrpcContext & {
  userAccountId: UserAccountId
  familyId: FamilyId
  memberId: MemberId
}

export async function createContext(c: HonoContext): Promise<TrpcContext> {
  const db = getDb()
  const session = await resolveSession(c, db)
  return { db, userAccountId: session?.userAccountId ?? null }
}

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson, // Date を境界でそのまま扱う (client 側 httpBatchLink と対)
  errorFormatter({ shape, error }) {
    // DomainError はコードだけをフロントへ渡す (詳細スタックは漏らさない)
    const cause = error.cause
    if (cause instanceof DomainError) {
      return {
        ...shape,
        message: cause.message,
        data: { ...shape.data, domainCode: cause.code },
      }
    }
    return shape
  },
})

export const router = t.router
export const publicProcedure = t.procedure

/** ログイン必須 */
export const authedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (ctx.userAccountId === null) {
    throw new TRPCError({ code: 'UNAUTHORIZED' })
  }
  return next({ ctx: { ...ctx, userAccountId: ctx.userAccountId } })
})

/**
 * テナント解決 middleware (二層防御の1層目。07 §2):
 * セッション → 所属 Member → familyId を解決して ctx に載せる。
 * 未所属 (家族未作成/未参加) は FORBIDDEN + 専用コードで、フロントがオンボーディングへ誘導する
 */
export const familyProcedure = authedProcedure.use(async ({ ctx, next }) => {
  const member = await new MemberRepository(ctx.db).findActiveByUserAccount(ctx.userAccountId)
  if (member === null) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'NO_FAMILY' })
  }
  const familyCtx: FamilyContext = {
    ...ctx,
    familyId: member.familyId,
    memberId: member.id,
  }
  return next({ ctx: familyCtx })
})
