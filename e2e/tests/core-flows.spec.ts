import { expect, type Page, test } from '@playwright/test'

/**
 * 主要フローのE2E (dev バイパス認証)。
 * 実行ごとに一意のメールアドレスで新規ユーザー → 新規家族を作り、状態を持ち込まない
 */
const email = `e2e-${Date.now()}@example.com`

async function login(page: Page) {
  await page.goto(`/auth/dev?email=${email}`)
  await page.waitForLoadState('networkidle')
}

/** 今日の日セル → 日別ビュー → ヘッダのプラスで作成モーダルを開く (FAB廃止後の導線) */
async function openCreateModal(page: Page) {
  const jstNow = new Date(Date.now() + 9 * 3600_000)
  const label = `${jstNow.getUTCFullYear()}年${jstNow.getUTCMonth() + 1}月${jstNow.getUTCDate()}日`
  await page.click(`button[aria-label="${label}"]`)
  await page.getByRole('button', { name: '予定を作成' }).click()
}

test.describe
  .serial('オンボーディング → 予定 → 買い物', () => {
    test('新規ユーザーは家族を作成してホームに入れる', async ({ page }) => {
      await login(page)
      await expect(page).toHaveURL(/\/onboarding/)
      await page.fill('#family-name', 'E2E家')
      await page.fill('#my-name', 'パパ')
      await page.getByRole('button', { name: '家族をつくる' }).click()
      await page.waitForURL('/')
      // 初期表示はカレンダー。今日ページはナビから開ける
      await expect(page.getByRole('button', { name: '今日', exact: true })).toBeVisible()
      await page.getByRole('link', { name: '今日' }).click()
      await expect(page.getByRole('heading', { name: '今日の予定' })).toBeVisible()
    })

    test('メンバーを追加できる', async ({ page }) => {
      await login(page)
      await page.goto('/settings')
      await page.fill('input[placeholder*="メンバーを追加"]', '長男')
      await page.getByRole('button', { name: '追加' }).click()
      await expect(page.getByText('長男', { exact: true })).toBeVisible()
    })

    test('カレンダーで予定を作成し、フィルタ選択中はデフォルト対象になる', async ({ page }) => {
      await login(page)
      await page.goto('/')
      // 長男フィルタを選択してから作成 → モーダルで長男が初期選択
      await page.getByRole('button', { name: '長男' }).click()
      await openCreateModal(page)
      const dialog = page.getByRole('dialog')
      await expect(dialog.locator('button', { hasText: '長男' }).first()).toHaveClass(
        /border-primary/,
      )

      await dialog.getByPlaceholder('タイトル').fill('水泳教室')
      await dialog.getByRole('button', { name: '保存' }).click()
      await expect(page.getByText('予定を作成しました')).toBeVisible()
      // フィルタ解除して後続テストに影響を残さない
      await page.getByRole('button', { name: '全員' }).click()
      await expect(page.getByText('水泳教室').first()).toBeVisible()
    })

    test('予定編集モーダルはスクロールしても保存ボタンが見える', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 700 })
      await login(page)
      await page.goto('/')
      await openCreateModal(page)
      const save = page.getByRole('button', { name: '保存' })
      await page.evaluate(() => {
        const body = document.querySelector('[role="dialog"] .overflow-y-auto')
        if (body) body.scrollTop = body.scrollHeight
      })
      await expect(save).toBeInViewport()
      await expect(page.getByRole('button', { name: '閉じる' })).toBeInViewport()
    })

    test('買い物リストを作成し、アイテム追加・チェック・履歴からのクイック追加ができる', async ({
      page,
    }) => {
      await login(page)
      await page.goto('/shopping')
      // 空状態からリスト作成
      await page.getByPlaceholder('例: 食料品').fill('食料品')
      await page.getByRole('button', { name: '作成' }).click()
      await expect(page.getByRole('button', { name: 'リストを削除' })).toBeVisible()

      // アイテム追加 → チェック
      const input = page.getByPlaceholder(/アイテムを追加/)
      await input.fill('牛乳')
      await page.getByRole('button', { name: '追加', exact: true }).click()
      await expect(page.locator('li', { hasText: '牛乳' })).toBeVisible()
      await page.getByRole('checkbox', { name: '牛乳' }).click()
      await expect(page.locator('li', { hasText: '牛乳' }).locator('p.line-through')).toBeVisible()

      // 履歴からのクイック追加: 一度消した「牛乳」が候補に出て、タップで復活する
      await page.locator('li', { hasText: '牛乳' }).getByRole('button', { name: '削除' }).click()
      await input.click()
      const suggestion = page.locator('button', { hasText: '牛乳' }).first()
      await expect(suggestion).toBeVisible()
      await suggestion.dispatchEvent('mousedown')
      await expect(page.locator('li', { hasText: '牛乳' })).toBeVisible()
    })

    test('選択状態はタブを切り替えても維持される', async ({ page }) => {
      await login(page)
      await page.goto('/')
      await page.getByRole('button', { name: 'パパ' }).click()
      await page.goto('/shopping')
      await page.goto('/')
      await expect(page.getByRole('button', { name: 'パパ' })).toHaveClass(/border-primary/)
      await page.getByRole('button', { name: '全員' }).click()
    })
  })
