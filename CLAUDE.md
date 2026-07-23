# CLAUDE.md

このファイルは、コーディングエージェント (Claude Code 等) がこのリポジトリで作業する際のガイドです。
Codex 等の他エージェントは AGENTS.md 経由で本ファイルを参照します。

## プロジェクト概要

iegoto は家族専用のWebカレンダー。スマホを持たない子どもも「プロフィール」として予定の主体になれるのが差別化点。
本番: https://iegoto-drab.vercel.app (Vercel Hobby + Neon Free の0円構成)

設計の意思決定は `docs/design/01〜10` に記録されている。**設計変更をするときは必ず該当ドキュメントも更新すること。**

## モノレポ構成

```
apps/web            SPA (Vite + React 19 + React Router 7 + Tailwind v4 + tRPC client)
apps/api            API (Hono + tRPC v11 + zod)。Vercel Functions / Node 両対応
packages/domain     純粋なドメインロジック (RRULE展開エンジン等)。実行環境非依存・依存最小
packages/db         Prisma スキーマ + リポジトリ層 (Neon / ローカルPostgres)
packages/feature-flags  フラグ定義の型と検証 (flags/feature-flags.json をビルド時バンドル)
e2e                 Playwright E2E (webServer で API + SPA を自動起動)
terraform/gcp       GCP移行時の IaC スケルトン (docs/design/04 O-1。現在は未適用)
docs/design         設計ドキュメント (意思決定の記録。SSoT)
```

依存方向: `web / api → db → domain`。domain は何にも依存しない (クリーンアーキテクチャの中心円をパッケージ境界で強制)。

## コマンド

```bash
pnpm install                 # 依存導入 (pnpm@10 固定。corepack)
pnpm dev                     # 使わない場合は個別に:
pnpm --filter @iegoto/api exec tsx src/server.ts   # API :8000 (要 DATABASE_URL 等)
pnpm --filter @iegoto/web exec vite --port 7475    # SPA :7475 (→ /trpc は :8000 へプロキシ)

pnpm lint                    # biome check . (フォーマット違反もエラー)
pnpm exec biome check --write .   # 自動修正
pnpm typecheck               # 全パッケージ tsc --noEmit
pnpm test                    # 全パッケージのユニット + 統合テスト (turbo)
pnpm build                   # 全ビルド

# DBマイグレーション (packages/db)
pnpm --filter @iegoto/db run migrate:dev      # 開発 (マイグレーション生成)
pnpm --filter @iegoto/db run migrate:deploy   # 適用のみ
pnpm --filter @iegoto/db run generate         # Prisma クライアント再生成

# E2E (要: ローカルPostgres起動 + マイグレーション済みDB)
pnpm --filter @iegoto/e2e run e2e
```

### テスト実行の前提

- 統合テスト (`packages/db/src/repositories/integration.test.ts`) は実Postgresが必要。
  `DATABASE_URL` のDB名に `test` を含まないと実行を拒否するガードがある:
  `DATABASE_URL=postgresql://iegoto:iegoto@localhost:5432/iegoto_test pnpm test`
- E2E はローカルAPI/Viteを Playwright の webServer が自動起動する。既存サーバがあれば再利用する。
  サンドボックス環境では `CHROMIUM_PATH=/opt/pw-browsers/chromium` でプリインストールブラウザを使える

## 規約

- **テナント境界**: リポジトリ層の全メソッドは `familyId` を必須第一引数に取る (07 §2)。
  例外は認証主体系 (UserAccount/Session/Push) とジョブ経路のみで、コメントで明示する
- **レイヤー**: tRPC procedure は「入力検証 → usecase 呼び出し」だけの薄いアダプタ。
  ロジックは usecase、クエリは repository、計算は domain へ
- **ドメインロジックは packages/domain の純関数に**。Date.now() 等を関数内で呼ばず引数で受ける
- **テスト**: domain の全モジュール・web の hooks/utils にはユニットテストを書く。
  リポジトリを触ったら統合テスト、画面フローを足したら E2E も追加する
- **ソフトデリート優先** (S-3)。物理削除はリスト削除など明示的な場合のみ
- **フロント**: `any` 禁止 / `interface` より `type` / lint抑制コメントには理由を書く
- **設計変更は docs/design を更新**。新しい意思決定は該当ドキュメントに追記する
- **シークレットをコミットしない** (public リポジトリ)。環境変数は `.env.example` に形だけ追加する

## デプロイ・運用

- main へのマージで Vercel が自動デプロイ (public リポジトリ)。手順・復旧は `docs/deploy.md`
- 定期ジョブは GitHub Actions: リマインダー配信 (5分間隔) / 日次バックアップ (JST 3時)
- 必要シークレット: GitHub側 `CRON_SECRET` `NEON_DIRECT_URL` / Vercel側 `VAPID_*` `CRON_SECRET` ほか (docs/deploy.md 参照)

## PRの流れ

1. 意味のある単位でブランチ → 実装 → `pnpm lint && pnpm typecheck && pnpm test` を通す
2. 画面を触ったら E2E も実行する
3. PR本文に背景・変更内容・検証結果を書く。CI (check + e2e) が緑になってからマージ
