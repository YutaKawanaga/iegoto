# iegoto 技術選定書（§10.2 T-1〜T-8）

作成日: 2026-07-17
ステータス: 決定案。**T-3/T-4/T-5 はplainerリポジトリ確認待ちの暫定決定**（下記§0参照）
関連: `docs/requirements.md` §8・§10.1 / `docs/design/03-domain-model.md`

---

## 0. plainerリポジトリ参照タスク（R-1〜R-4）の状況

R-1〜R-4は **本セッションからはplainerリポジトリ（`learningsales` org）にアクセスできず未着手**。
Claude Codeのリモートセッションはリポジトリのオーナー横断（yutakawanaga ↔ learningsales）の追加が
できないため、以下いずれかで別途実施する:

1. `learningsales/plainer-backend` を初期ソースにした新しいセッションを開始し、構成を抽出して本ドキュメントに反映する
2. ローカルのClaude Code（両リポジトリにアクセスできる環境）で実施する

補足: learningsales orgに `plainer-featureflag` という単独リポジトリは存在しない
（2026-07-17時点のアクセス可能リポジトリ一覧より）。featureflag実装は
`plainer-backend` / `plainer-microservices` 内のパッケージの可能性が高いため、R-3では
その前提で探索する。

**本書の暫定決定は「plainer側の構成が判明したら合わせ直す」前提で、単体で合理的な選択をしている。**

---

## T-1 DB: **Cloud SQL (PostgreSQL)** — 確定

- 採用理由:
  - 繰り返し予定（RRULE）+ 例外 + 期間クエリ、担当者未定一覧、過去予定サジェスト（正規化タイトルの集約・頻度ソート）はすべてリレーショナル/集計クエリであり、Firestoreでは非正規化の維持コストが跳ね上がる
  - 家族単位で完結するデータなので `family_id` によるテナント分離が単純で、スケール要件（§6: 個人〜小規模）にPostgresの縦スケールで十分
- 構成: 最小インスタンス（db-f1-micro〜db-g1-small相当）から開始。接続はCloud Run→Cloud SQL コネクタ（Auth Proxy内蔵）
- ORM/マイグレーション: **Prisma** を第一候補（TSモノレポでスキーマ→型生成が効く。plainer-backendがDrizzle/TypeORM等を使っていればR-2で再検討）
- Firestoreを併用しない（T-2参照。ストアを2つ持つ運用コストを避ける）

## T-2 リアルタイム反映: **SSE（Server-Sent Events）+ Postgres LISTEN/NOTIFY、フォールバックでポーリング** — 確定

- 方式:
  - クライアントは家族単位のSSEストリーム `GET /families/:id/events-stream` を購読
  - 書き込みはすべて通常のHTTP API。コミット後に `NOTIFY family_{id}` を発行し、SSEハンドラが「変更あり」イベント（種別+対象ID のみの軽量ペイロード）を配信、クライアントが再取得
  - SSE切断時・非対応時は5秒ポーリングにフォールバック（画面がフォアグラウンドの間のみ）
- 採用理由:
  - 要件は「数秒以内の反映」（§6）かつ通信は**サーバ→クライアントの単方向で足りる**（書き込みはHTTPでよい）ので、WebSocketは過剰。SSEはHTTP/1.1の範囲で動きCloud Runのストリーミングレスポンスでそのまま使える
  - Firestoreリスナー案はT-1でPostgresを選んだ時点で消える（リアルタイムのためだけに2ストア同期を持つのは本末転倒)
  - LISTEN/NOTIFYはCloud Runの複数インスタンス間のイベント伝播をDB経由で解決する最小構成。Pub/Sub等は家族規模のトラフィックでは不要
- 留意点: Cloud RunでSSEを張る間はインスタンスが保持される（課金影響は小規模なら軽微）。リクエストタイムアウト（最大60分）ごとにクライアント側で自動再接続する

## T-3 API形式: **tRPC** — 暫定（R-2でplainerの方式確認後に確定）

- 採用理由: 前後段TS・モノレポ・クライアントは自前フロントのみ（外部公開APIなし）という条件はtRPCの最適ケース。スキーマ二重管理なしで型が通る
- バリデーションは Zod をtRPC入力に使い、ドメイン層のバリデーションと役割分担（入力形式 vs 業務ルール）
- plainerがREST(OpenAPI)であれば、開発体験の一貫性を優先してRESTに倒す選択肢を残す（その場合はスキーマからの型生成: openapi-typescript / orval を併用）
- GraphQLは不採用で確定: クライアント1種・クエリパターン固定のアプリに柔軟なクエリ言語は運用コストだけが残る

## T-4 フロントフレームワーク: **Next.js（App Router）** — 暫定（R-1で確定）

- 採用理由:
  - PWA（F-09）・Web Push（F-08）の実装事例・エコシステムが最も厚い（`@serwist/next` 等）
  - 認証（Googleログイン）は Auth.js (NextAuth v5) が最短
  - SSRは要件上必須ではないが、初回表示の速さ（スマホ回線）と今日のまとめビューの体験に効く
- plainer-backendのfrontがVite+React等であれば、page単位ディレクトリ構成ルール（R-1）ごとそちらに合わせる
- カレンダーUI: 月/週の並列表示（F-02）は既製カレンダーライブラリのカスタマイズ限界に当たりやすいため、**表示部は自作、日付計算は `date-fns` + RRULEは `rrule` パッケージ**を前提とする

## T-5 バックエンドフレームワーク: **Hono（+ tRPCアダプタ）+ 自前DDDレイヤ** — 暫定（R-2で確定）

- 採用理由:
  - T-3でtRPCを採る場合、NestJSのDI/デコレータ層とtRPCは統合の相性が悪く、二重構造になる。HonoはtRPCアダプタが公式にあり、Cloud Runでの起動も軽量
  - DDDのレイヤ構成（domain / application / infrastructure / presentation）はフレームワークに依存させず `packages/` 側で自前に持つ（R-2でplainer-backendの分け方を移植する予定の箇所）
  - SSE(T-2)はHonoのストリーミングレスポンスで実装
- plainer-backendがNestJSなら: NestJS + REST(T-3もRESTに倒す)の組で一貫させる。「NestJS + tRPC」の混成だけは避ける

## T-6 モノレポツール: **pnpm workspace + Turborepo** — 確定

- 構成案:
  ```
  iegoto/
  ├── apps/
  │   ├── web/        # フロントエンド (Next.js想定)
  │   └── api/        # バックエンド (Hono想定)
  ├── packages/
  │   ├── domain/     # ドメイン層（エンティティ・値オブジェクト・ドメインサービス）
  │   ├── db/         # Prismaスキーマ・リポジトリ実装（infrastructure層）
  │   └── shared/     # 共有型・ユーティリティ（TZ処理・RRULEラッパ等）
  ├── infra/          # Terraform
  └── docs/
  ```
- Nxは不採用: 生成器・プラグインの学習コストがこの規模に見合わない。Turborepoはタスクパイプライン+キャッシュだけの薄さがちょうどよい

## T-7 Googleカレンダー同期: **Cloud Scheduler → 1時間ごとポーリング + syncTokenによる差分同期** — 確定

- 方式:
  - Cloud Scheduler（1時間ごと）→ Cloud Run（API側の同期エンドポイント or Cloud Run Jobs）→ 連携済みカレンダーを順次同期
  - Google Calendar API の **syncToken** を使った差分取得（初回のみフル、以降は変更分のみ。410 GONEでフル再同期にフォールバック）
  - 手動の「今すぐ同期」ボタンも設ける（1時間待てないケースの逃げ道）
- Watch API（push通知）はMVPでは不採用: チャネルの有効期限管理・renewal・Webhook検証の運用コストに対し、「1時間ごと目安」（F-07）の要件はポーリングで満たせる。双方向同期（Should）に進む際に再検討
- **refresh tokenの保管**: Cloud SQLに保存し、**アプリケーション層で暗号化**（AES-256-GCM）。暗号鍵はSecret Managerに置き、Cloud Runに環境変数ではなくSecret Managerリファレンスとしてマウント
  - OAuthスコープは `calendar.readonly` のみ要求（読み取り専用連携の要件に合わせ最小権限）
  - 連携解除時はtokenをrevoke（`oauth2.revoke`）してから削除

## T-8 CI/CD: **GitHub Actions + Workload Identity Federation** — 確定

- アプリ:
  - PR: lint（Biome or ESLint）/ typecheck / unit test / build を必須チェック化
  - `main` merge → stg へ自動デプロイ（Cloud Run）
  - prod へは GitHub Environments の手動承認付きで同一イメージをプロモート（stgで動いたイメージをそのまま出す）
- Terraform:
  - PR: `terraform plan` の結果をPRコメントに出力
  - merge → stg に `apply`、prod は手動承認後に `apply`
- 認証: サービスアカウントキーは発行せず **Workload Identity Federation** でキーレス化
- コンテナ: Artifact Registry。イメージタグはgit SHA

---

## 選定サマリ

| # | 論点 | 決定 | 状態 |
|---|---|---|---|
| T-1 | DB | Cloud SQL (PostgreSQL) + Prisma | 確定（ORMのみR-2で再確認） |
| T-2 | リアルタイム | SSE + LISTEN/NOTIFY、ポーリングfallback | 確定 |
| T-3 | API | tRPC | 暫定（plainerがRESTならREST） |
| T-4 | フロント | Next.js (App Router) | 暫定（R-1で確定） |
| T-5 | バック | Hono + tRPC + 自前DDDレイヤ | 暫定（R-2で確定。NestJSならRESTとセットで） |
| T-6 | モノレポ | pnpm workspace + Turborepo | 確定 |
| T-7 | Google同期 | Schedulerポーリング + syncToken差分、token暗号化保存 | 確定 |
| T-8 | CI/CD | GitHub Actions + WIF、stg自動/prod承認 | 確定 |
