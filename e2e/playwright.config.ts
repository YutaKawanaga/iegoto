import { defineConfig } from '@playwright/test'

/**
 * E2Eテスト設定。API(:8000) と Vite(:7475) を webServer で自動起動する。
 * 前提: DATABASE_URL がマイグレーション済みのテスト用DBを指していること
 * (CI: .github/workflows/ci.yml の e2e ジョブ。ローカル: iegoto_test を推奨)
 */
const DB_URL = process.env.DATABASE_URL ?? 'postgresql://iegoto:iegoto@localhost:5432/iegoto_test'

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:7475',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    // CHROMIUM_PATH が設定されていればそれを使う (プリインストール済みブラウザの再利用)。
    // 未設定なら Playwright 管理のブラウザ (CI では playwright install で取得)
    launchOptions:
      process.env.CHROMIUM_PATH === undefined ? {} : { executablePath: process.env.CHROMIUM_PATH },
  },
  webServer: [
    {
      command: 'pnpm --filter @iegoto/api exec tsx src/server.ts',
      url: 'http://localhost:8000/health',
      reuseExistingServer: !process.env.CI,
      cwd: '..',
      env: {
        DATABASE_URL: DB_URL,
        DIRECT_URL: DB_URL,
        AUTH_DEV_BYPASS: '1',
        SESSION_SECRET: 'e2e-test-secret-0123456789abcdef',
        PORT: '8000',
      },
    },
    {
      command: 'pnpm --filter @iegoto/web exec vite --port 7475',
      url: 'http://localhost:7475',
      reuseExistingServer: !process.env.CI,
      cwd: '..',
    },
  ],
})
