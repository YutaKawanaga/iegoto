import { FamilyRepository } from '@iegoto/db'
import { validateFamilyName } from '@iegoto/domain'
import type { FamilyContext } from '../../../trpc.js'

/** F-01: 家族名の変更 */
export async function renameFamily(ctx: FamilyContext, input: { name: string }): Promise<void> {
  await new FamilyRepository(ctx.db).updateName(ctx.familyId, validateFamilyName(input.name))
}
