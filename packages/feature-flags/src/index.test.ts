import { describe, expect, test } from 'vitest'
import { FeatureFlags, featureFlagsFileSchema } from './index.js'

const file = {
  version: '1.0.0',
  flags: [
    { name: 'always-on', description: 'x', defaultValue: true, cleanupBy: '2099-12-31' },
    {
      name: 'dogfooding',
      description: 'x',
      defaultValue: false,
      cleanupBy: '2026-12-31',
      enabledFamilyIds: ['family-1'],
    },
  ],
}

describe('FeatureFlags', () => {
  const flags = FeatureFlags.parse(file)

  test('defaultValue=true は誰でも有効', () => {
    expect(flags.isEnabled('always-on')).toBe(true)
    expect(flags.isEnabled('always-on', 'family-2')).toBe(true)
  })

  test('enabledFamilyIds による家族限定の先行有効化', () => {
    expect(flags.isEnabled('dogfooding', 'family-1')).toBe(true)
    expect(flags.isEnabled('dogfooding', 'family-2')).toBe(false)
    expect(flags.isEnabled('dogfooding')).toBe(false)
  })

  test('未知のフラグ: isEnabled は fail-closed、isEnabledOrDefaultTrue は fail-open', () => {
    expect(flags.isEnabled('unknown-flag')).toBe(false)
    expect(flags.isEnabledOrDefaultTrue('unknown-flag')).toBe(true)
  })

  test('evaluateAll は家族向けの評価結果を返す', () => {
    expect(flags.evaluateAll('family-1')).toEqual({ 'always-on': true, dogfooding: true })
    expect(flags.evaluateAll('family-2')).toEqual({ 'always-on': true, dogfooding: false })
  })
})

describe('スキーマ検証', () => {
  test('cleanupBy 欠落・不正なフラグ名・未知フィールドを拒否する', () => {
    expect(() =>
      featureFlagsFileSchema.parse({
        version: '1',
        flags: [{ name: 'ok-flag', description: 'x', defaultValue: true }],
      }),
    ).toThrow()
    expect(() =>
      featureFlagsFileSchema.parse({
        version: '1',
        flags: [{ name: 'NG_Flag', description: 'x', defaultValue: true, cleanupBy: '2099-12-31' }],
      }),
    ).toThrow()
    expect(() =>
      featureFlagsFileSchema.parse({
        version: '1',
        flags: [
          {
            name: 'ok-flag',
            description: 'x',
            defaultValue: true,
            cleanupBy: '2099-12-31',
            unknown: 1,
          },
        ],
      }),
    ).toThrow()
  })
})
