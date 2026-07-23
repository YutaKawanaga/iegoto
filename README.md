# iegoto（家ごと）

家族の予定・買い物・分担など「家の共有事」をまるごと集める、家族専用のWebカレンダー。

スマホを持たない子どもも**ログイン不要の「プロフィール」として予定の主体**になれるのが差別化点。
メンバーカラーの色分けで「誰の予定か」が一目で分かり、買い物リストは家族でリアルタイム共有、
予定の追加・変更やリマインダーは Web Push でホーム画面PWAに通知される（iOS 16.4+対応）。

| カレンダー (PC) | 今日ビュー (モバイル) | 買い物リスト (モバイル) |
|---|---|---|
| ![カレンダー月表示](docs/assets/screenshot-calendar.png) | ![今日のまとめ](docs/assets/screenshot-today-mobile.png) | ![買い物リスト](docs/assets/screenshot-shopping-mobile.png) |

## 主な機能

- **カレンダー**: 月/週表示、繰り返し予定（RRULE互換・「この予定のみ/これ以降すべて/すべて」の3スコープ編集）、メンバーフィルタ、過去予定からのサジェスト入力
- **家族とメンバー**: Googleログイン、招待リンク（7日有効・ハッシュ保存）、子どもプロフィールと後からのアカウント紐づけ（昇格）
- **買い物リスト**: 複数リスト、誰が追加/購入したかの表示、追加履歴からのオートコンプリート
- **通知**: 予定の追加・変更・削除の家族通知（本人除外）、リマインダー配信、種類別ON/OFF
- **PWA**: ホーム画面追加でアプリとして動作。巣箱と鳥の家族のオリジナルアイコン

## 技術スタック

フルスタックTypeScript（pnpm workspace + Turborepo モノレポ）:

| 層 | 技術 |
|---|---|
| フロント | Vite / React 19 / React Router 7 / Tailwind CSS v4 / tRPC client |
| API | Hono / tRPC v11 / zod（Vercel Functions・Node両対応） |
| ドメイン | 依存ゼロの純TypeScript（RRULE展開エンジン・タイムゾーン処理） |
| DB | Prisma 6 / PostgreSQL（本番: Neon、ローカル: Docker） |
| テスト | Vitest ユニット / 実Postgres統合テスト / Playwright E2E |
| 運用 | Vercel + GitHub Actions（CI・リマインダー配信・日次バックアップ）**すべて無料枠** |

依存方向は `web / api → db → domain`。ドメイン層はパッケージ境界で独立させ、
テナント境界（family単位のデータ分離）はリポジトリ層の必須引数として型で強制している。

## ドキュメント

設計の意思決定はすべて `docs/design/` に記録している。

| ドキュメント | 内容 |
|---|---|
| [要件定義書](docs/requirements.md) | プロダクト要件（機能・非機能・スコープ・決定事項ログ） |
| [仕様決定書](docs/design/01-spec-decisions.md) | S-1〜S-7（プロフィール昇格・招待リンク・TZ・通知粒度 等） |
| [技術選定書](docs/design/02-tech-selection.md) | T-1〜T-8（DB・リアルタイム・API・FW・モノレポ 等） |
| [ドメインモデル設計書](docs/design/03-domain-model.md) | 集約・テーブル定義・繰り返し予定の設計 |
| [運用・品質方針](docs/design/04-operations.md) | O-1〜O-5（環境・監視・バックアップ・テスト） |
| [フロントエンド設計書](docs/design/06-frontend-design.md) | SPA・ディレクトリ規約・PWA/Web Push設計 |
| [バックエンド設計書](docs/design/07-backend-design.md) | レイヤ構成・Repository/UseCase規約・テナント分離 |
| [フィーチャーフラグ方針](docs/design/08-feature-flag.md) | フラグ定義・配信・評価・ライフサイクル運用 |
| [実装順序と実装状況](docs/design/09-implementation-order.md) | フェーズ分けと現在の実装状況 |
| [ホスティング構成](docs/design/10-vercel-hosting.md) | Vercel+Neon無料構成と運用実績、GCP移行トリガー |
| [デプロイ・運用手順](docs/deploy.md) | 環境構築・シークレット・バックアップ復元手順 |

GCP移行時のIaCスケルトンは [terraform/gcp](terraform/gcp/) に用意している（未適用）。

## 開発

```bash
cp .env.example .env
docker compose up -d              # Postgres
pnpm install && pnpm db:migrate
pnpm --filter @iegoto/api dev     # API  http://localhost:8000
pnpm --filter @iegoto/web dev     # Web  http://localhost:7475 (開発用ログインあり)
```

テスト:

```bash
pnpm lint && pnpm typecheck
DATABASE_URL=postgresql://iegoto:iegoto@localhost:5432/iegoto_test pnpm test  # ユニット+統合
pnpm --filter @iegoto/e2e run e2e                                            # E2E (Playwright)
```

デプロイ手順は [docs/deploy.md](docs/deploy.md)。
コーディングエージェント向けのガイドは [CLAUDE.md](CLAUDE.md)（Codex等は [AGENTS.md](AGENTS.md) から参照）。
