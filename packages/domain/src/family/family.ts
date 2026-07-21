import { DomainError } from '../shared/errors.js'
import { type FamilyId, newId } from '../shared/id.js'

export type Family = {
  id: FamilyId
  name: string
}

export function createFamily(name: string): Family {
  const trimmed = name.trim()
  if (trimmed.length === 0 || trimmed.length > 50) {
    throw new DomainError('INVALID_FAMILY_NAME', '家族名は1〜50文字で入力してください')
  }
  return { id: newId<'Family'>(), name: trimmed }
}
