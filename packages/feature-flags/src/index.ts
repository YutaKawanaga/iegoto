import { z } from 'zod'

/**
 * フィーチャーフラグ (08-feature-flag.md)。
 * 定義は flags/feature-flags.json (Git 管理・ビルド時バンドル)。
 * cleanupBy は削除見積もり日付 (有効期限ではない。棚卸し用の内部フィールド)
 */

const FLAG_NAME_RE = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/

export const flagSchema = z
  .object({
    name: z.string().min(3).max(64).regex(FLAG_NAME_RE),
    description: z.string().min(1),
    defaultValue: z.boolean(),
    cleanupBy: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    /** defaultValue=false のフラグを特定の家族だけ先行有効化する (段階公開) */
    enabledFamilyIds: z.array(z.string()).optional(),
  })
  .strict()

export const featureFlagsFileSchema = z
  .object({
    version: z.string(),
    flags: z.array(flagSchema),
  })
  .strict()

export const deletedFlagsFileSchema = z
  .object({
    flags: z.array(z.object({ name: z.string(), reason: z.string().min(1) }).strict()),
  })
  .strict()

export type FeatureFlag = z.infer<typeof flagSchema>
export type FeatureFlagsFile = z.infer<typeof featureFlagsFileSchema>

export class FeatureFlags {
  private readonly byName: Map<string, FeatureFlag>

  constructor(file: FeatureFlagsFile) {
    this.byName = new Map(file.flags.map((f) => [f.name, f]))
  }

  /** JSON (バンドル済み flags/feature-flags.json) から構築。起動時に呼び fail-fast する */
  static parse(json: unknown): FeatureFlags {
    return new FeatureFlags(featureFlagsFileSchema.parse(json))
  }

  /** fail-closed: 未知のフラグ名は false (既定はこちらを使う) */
  isEnabled(name: string, familyId?: string): boolean {
    const flag = this.byName.get(name)
    if (flag === undefined) {
      return false
    }
    return this.evaluate(flag, familyId)
  }

  /** fail-open: 未知のフラグ名は true (既存動作をフラグ配下に入れるデプロイ順序問題にだけ使う) */
  isEnabledOrDefaultTrue(name: string, familyId?: string): boolean {
    const flag = this.byName.get(name)
    if (flag === undefined) {
      return true
    }
    return this.evaluate(flag, familyId)
  }

  /** 家族向けの評価済みフラグ一覧 (フロント配信用。tRPC featureFlags.list) */
  evaluateAll(familyId?: string): Record<string, boolean> {
    const result: Record<string, boolean> = {}
    for (const [name, flag] of this.byName) {
      result[name] = this.evaluate(flag, familyId)
    }
    return result
  }

  private evaluate(flag: FeatureFlag, familyId: string | undefined): boolean {
    if (flag.defaultValue) {
      return true
    }
    return familyId !== undefined && (flag.enabledFamilyIds ?? []).includes(familyId)
  }
}
