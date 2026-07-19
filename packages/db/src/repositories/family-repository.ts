import type { Family, FamilyId } from '@iegoto/domain'
import { toId } from '@iegoto/domain'
import type { Tx } from '../client.js'

export class FamilyRepository {
  constructor(private readonly tx: Tx) {}

  async find(familyId: FamilyId): Promise<Family | null> {
    const row = await this.tx.family.findUnique({ where: { id: familyId } })
    return row === null ? null : { id: toId<'Family'>(row.id), name: row.name }
  }

  async create(family: Family): Promise<void> {
    await this.tx.family.create({ data: { id: family.id, name: family.name } })
  }

  async updateName(familyId: FamilyId, name: string): Promise<void> {
    await this.tx.family.update({ where: { id: familyId }, data: { name } })
  }
}
