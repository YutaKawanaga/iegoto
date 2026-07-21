/**
 * フラグ検証 (08 §3。CI と手元の pnpm validate-flags から実行):
 * 1. zod スキーマ検証  2. フラグ名重複  3. 削除済みフラグ名の再利用
 * 4. feature-flags.json から消えたのに deleted-flags.json 未登録 (git diff ベースの検出は
 *    行わず、削除履歴との突き合わせのみ。運用ルールは 08 参照)
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  deletedFlagsFileSchema,
  featureFlagsFileSchema,
} from '../packages/feature-flags/src/index.js'

const root = resolve(import.meta.dirname, '..')
const errors: string[] = []

const flagsJson = JSON.parse(readFileSync(resolve(root, 'flags/feature-flags.json'), 'utf8'))
const deletedJson = JSON.parse(readFileSync(resolve(root, 'flags/deleted-flags.json'), 'utf8'))

const flagsResult = featureFlagsFileSchema.safeParse(flagsJson)
if (!flagsResult.success) {
  errors.push(`feature-flags.json スキーマ違反: ${flagsResult.error.message}`)
}
const deletedResult = deletedFlagsFileSchema.safeParse(deletedJson)
if (!deletedResult.success) {
  errors.push(`deleted-flags.json スキーマ違反: ${deletedResult.error.message}`)
}

if (flagsResult.success && deletedResult.success) {
  const names = flagsResult.data.flags.map((f) => f.name)
  const dup = names.filter((n, i) => names.indexOf(n) !== i)
  if (dup.length > 0) {
    errors.push(`フラグ名が重複しています: ${[...new Set(dup)].join(', ')}`)
  }
  const deletedNames = new Set(deletedResult.data.flags.map((f) => f.name))
  const reused = names.filter((n) => deletedNames.has(n))
  if (reused.length > 0) {
    errors.push(`削除済みフラグ名の再利用は禁止です: ${reused.join(', ')}`)
  }
}

if (errors.length > 0) {
  for (const e of errors) {
    console.error(`❌ ${e}`)
  }
  process.exit(1)
}
console.log('✅ flags OK')
