import { expect, type Page, test } from '@playwright/test'

/**
 * 応用フローのE2E: 招待による家族参加(2ユーザー)、繰り返し予定のスコープ操作、
 * 予定の編集・削除、買い物のチェック操作。
 * core-flows と同様、実行ごとに一意メールで新規家族を作る
 */
const runId = Date.now()
const ownerEmail = `e2e-owner-${runId}@example.com`
const partnerEmail = `e2e-partner-${runId}@example.com`

async function login(page: Page, email: string) {
  await page.goto(`/auth/dev?email=${email}`)
  await page.waitForLoadState('networkidle')
}

test.describe
  .serial('招待 → 繰り返し予定 → 編集・削除 → 買い物', () => {
    test('オーナーが家族を作成する', async ({ page }) => {
      await login(page, ownerEmail)
      await page.fill('#family-name', 'E2E応用家')
      await page.fill('#my-name', 'パパ')
      await page.getByRole('button', { name: '家族をつくる' }).click()
      await page.waitForURL('/')
    })

    test('招待リンクで2人目が新しいプロフィールとして参加できる', async ({ page, browser }) => {
      // オーナーが招待リンクを発行
      await login(page, ownerEmail)
      await page.goto('/settings')
      await page.getByRole('button', { name: '招待リンクを発行' }).click()
      const inviteUrl = await page.locator('p.font-mono').textContent()
      expect(inviteUrl).toContain('/invite/')

      // 2人目: 別ブラウザコンテキスト (別セッション) で参加
      const partnerContext = await browser.newContext()
      const partnerPage = await partnerContext.newPage()
      await login(partnerPage, partnerEmail)
      await partnerPage.goto(inviteUrl as string)
      await expect(partnerPage.getByText('「E2E応用家」に参加')).toBeVisible()
      await partnerPage.getByPlaceholder('表示名 (例: ママ)').fill('ママ')
      await partnerPage.getByRole('button', { name: '参加する' }).click()
      await partnerPage.waitForURL('/')
      await partnerContext.close()

      // オーナー側の設定にママが現れる
      await page.reload()
      await expect(page.getByText('ママ', { exact: true })).toBeVisible()
    })

    test('毎週の繰り返し予定を作成すると月表示に複数回出る', async ({ page }) => {
      await login(page, ownerEmail)
      await page.goto('/calendar')
      await page.click('button[aria-label="予定を作成"]')
      const dialog = page.getByRole('dialog')
      await dialog.getByPlaceholder('タイトル').fill('毎週ピアノ')
      await dialog.locator('select:has(option[value="weekly"])').selectOption('weekly')
      await dialog.getByRole('button', { name: '保存' }).click()
      await expect(page.getByText('予定を作成しました')).toBeVisible()
      // 月グリッド内に週次で複数回展開される (月末開始でも当月グリッドに最低2回)
      const chips = page.locator('main').getByText('毎週ピアノ')
      await expect(async () => {
        expect(await chips.count()).toBeGreaterThanOrEqual(2)
      }).toPass()
    })

    test('「この予定のみ」削除でその回だけ消える', async ({ page }) => {
      await login(page, ownerEmail)
      await page.goto('/calendar')
      const chips = page.locator('main').getByText('毎週ピアノ')
      await expect(chips.first()).toBeVisible()
      const before = await chips.count()
      expect(before).toBeGreaterThanOrEqual(2)

      await chips.first().click()
      const dialog = page.getByRole('dialog')
      await dialog.getByRole('button', { name: '削除' }).click()
      // 繰り返し予定なのでスコープ3択が出る → この予定のみ
      await expect(dialog.getByText('繰り返し予定を削除する範囲')).toBeVisible()
      await dialog.getByText('この予定のみ').click()
      await dialog.getByRole('button', { name: 'OK' }).click()
      await expect(page.getByText('予定を削除しました')).toBeVisible()

      await expect(async () => {
        expect(await page.locator('main').getByText('毎週ピアノ').count()).toBe(before - 1)
      }).toPass()
    })

    test('単発予定のタイトルを編集できる', async ({ page }) => {
      await login(page, ownerEmail)
      await page.goto('/calendar')
      // 単発予定を作成
      await page.click('button[aria-label="予定を作成"]')
      let dialog = page.getByRole('dialog')
      await dialog.getByPlaceholder('タイトル').fill('歯医者')
      await dialog.getByRole('button', { name: '保存' }).click()
      await expect(page.getByText('予定を作成しました')).toBeVisible()

      // 編集
      await page.locator('main').getByText('歯医者').first().click()
      dialog = page.getByRole('dialog')
      await dialog.getByPlaceholder('タイトル').fill('歯医者(変更後)')
      await dialog.getByRole('button', { name: '保存' }).click()
      await expect(page.getByText('予定を更新しました')).toBeVisible()
      await expect(page.locator('main').getByText('歯医者(変更後)').first()).toBeVisible()
    })

    test('買い物アイテムのチェックと解除が反映される', async ({ page }) => {
      await login(page, ownerEmail)
      await page.goto('/shopping')
      await page.getByPlaceholder('例: 食料品').fill('食料品')
      await page.getByRole('button', { name: '作成' }).click()
      const input = page.getByPlaceholder(/アイテムを追加/)
      await input.fill('卵')
      await page.getByRole('button', { name: '追加', exact: true }).click()

      const row = page.locator('li', { hasText: '卵' })
      await expect(row).toBeVisible()
      await page.getByRole('checkbox', { name: '卵' }).click()
      await expect(row.locator('p.line-through')).toBeVisible()
      await expect(row.getByText('が購入')).toBeVisible()

      // チェック解除で取り消し線が消える
      await page.getByRole('checkbox', { name: '卵' }).click()
      await expect(row.locator('p.line-through')).toHaveCount(0)
    })
  })
