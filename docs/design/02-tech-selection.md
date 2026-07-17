# iegoto 技術選定書（§10.2 T-1〜T-8）

作成日: 2026-07-17（同日更新: R-1〜R-4完了によりT-3/T-4/T-5を確定）
ステータス: **全項目確定**
関連: `docs/requirements.md` §8・§10.1 / `docs/design/03-domain-model.md` / `docs/design/05-plainer-extraction-report.md`

---

## 0. plainerリポジトリ参照タスク（R-1〜R-4）の状況

**完了**。plainer 3リポジトリ（`plainer-backend` / `plainer-feature-flag` / `plainer-infrastructure`）を
参照できるセッションで抽出を実施し、結果は `05-plainer-extraction-report.md` に記録した。
本書のT-3/T-4/T-5は抽出結果を反映して**確定済み**。

判明した重要な前提の変化:

- plainer-backendのバックエンドは **Kotlin/Ktor**（TypeScriptではない）。「plainerがNestJSなら合わせる」
  というT-5の分岐は前提ごと消滅した
- plainerのfrontは **Vite + React SPA**（Next.jsではない）→ T-4はplainerに合わせる方向で変更
- featureflagは独立リポジトリ `plainer-feature-flag` として存在した（GCS + Cloud Functions構成。
  iegotoへの組み込み方針は `08-feature-flag.md`）

判断基準（HANDOFF時に設定したもの）: 開発者が同一人物なので開発体験の一貫性に価値がある。
ただしplainer側がiegotoの要件（SSE・PWA・RRULE・tRPC適性）に合わない構成なら無理に合わせない。

---

## T-1 DB: **Cloud SQL (PostgreSQL)** — 確定

- 採用理由:
  - 繰り返し予定（RRULE）+ 例外 + 期間クエリ、担当者未定一覧、過去予定サジェスト（正規化タイトルの集約・頻度ソート）はすべてリレーショナル/集計クエリであり、Firestoreでは非正規化の維持コストが跳ね上がる
  - 家族単位で完結するデータなので `family_id` によるテナント分離が単純で、スケール要件（§6: 個人〜小規模）にPostgresの縦スケールで十分
- 構成: 最小インスタンス（db-f1-micro〜db-g1-small相当）から開始。接続はCloud Run→Cloud SQL コネクタ（Auth Proxy内蔵）
- ORM/マイグレーション: **Prisma で確定**（R-2の結果、plainerのORMはJOOQ=Kotlin専用であり「合わせる」対象が存在しない。TSモノレポでスキーマ→型生成が効くPrismaを採用。マイグレーションもPrisma Migrateに統一）
  - plainerから移植する規約: 「SELECT * 禁止・具体カラム明示」の思想はPrismaでは`select`指定の徹底として運用（デフォルトの全カラム取得を大きなテーブルで多用しない）
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

## T-3 API形式: **tRPC** — 確定（R-2の結果を反映）

- 採用理由: 前後段TS・モノレポ・クライアントは自前フロントのみ（外部公開APIなし）という条件はtRPCの最適ケース。スキーマ二重管理なしで型が通る
- **plainerのREST（TypeSpec→OpenAPI→orval）に「合わせない」と判断した理由**:
  - plainerの3段生成パイプラインは **Kotlinバックエンド↔TSフロントの言語境界を型安全に越えるための装置**。TSモノレポのiegotoにはこの根本課題が存在せず、パイプライン（生成コマンド・drift検知CI・生成物パッケージ管理）の保守コストだけが残る
  - 一貫性の実利は「データフェッチの書き味」にあり、そこは揃う: plainerのorvalは`client: 'react-query'`でhookを生成しており、iegotoの`@trpc/react-query`と**フロントから見た使用感（hooks + invalidateQueries）はほぼ同型**
  - SSE（T-2）はtRPC v11の`httpSubscriptionLink`（SSEベースのsubscription）と整合する
- plainerから移植する規約: 「原則hook使用・mutation副作用は`onSuccess`に集約」の運用規約（R-1）、`ApiError`相当のエラー型統一
- バリデーションは Zod をtRPC入力に使い、ドメイン層のバリデーションと役割分担（入力形式 vs 業務ルール）
- GraphQLは不採用で確定: クライアント1種・クエリパターン固定のアプリに柔軟なクエリ言語は運用コストだけが残る

## T-4 フロントフレームワーク: **Vite + React SPA（React Router）** — 確定（R-1の結果、Next.jsから変更）

- R-1の結果、plainerのfrontは Vite 7 + React 19 + React Router 7 のSPA。当初の判断基準どおり
  「page単位ディレクトリ構成ルールごとそちらに合わせる」を適用し、**Next.js App Router案を破棄**して確定
- plainerに合わせることの実利:
  - `front/CLAUDE.md`の実証済み規約一式（pages薄型ラッパー / co-locationコンテナ / rule of two / ドメイン間import禁止 / hooks・utilsテスト必須）を**そのまま移植できる**（→ `06-frontend-design.md`）
  - Chakra UI v3 + テーマ共有パッケージ、TanStack Queryの構成・運用ノウハウも共通化
- iegoto要件との適合確認:
  - SSR不要: 全画面ログイン必須（家族外アクセス遮断）でSEO対象ページが存在しない。初回表示はSPA + Cloud Run/CDNで十分
  - PWA（F-09）/ Web Push（F-08）: plainerに前例はないが、`vite-plugin-pwa` + 自前Service Workerで成立する（Next.js特有の優位性はない）。SWの設計は`06-frontend-design.md`に記載
  - 認証への影響: Auth.js（Next.js前提）は使わず、**Google OAuthのcode flowはバックエンド（Hono）側で実装し、暗号化セッションクッキーを発行**する方式に変更。これはplainer-backendの認証構成（Auth0 + セッションクッキー + `credentials: 'include'`）と同型
- カレンダーUI: 月/週の並列表示（F-02）は既製カレンダーライブラリのカスタマイズ限界に当たりやすいため、**表示部は自作、日付計算は `date-fns` + RRULEは `rrule` パッケージ**を前提とする（変更なし）

## T-5 バックエンドフレームワーク: **Hono（+ tRPCアダプタ）+ 自前DDDレイヤ** — 確定（R-2の結果を反映）

- R-2の結果、plainer-backendは**Kotlin/Ktor**であり、TSフレームワークの選定において「plainerに合わせる」
  選択肢は原理的に存在しない。よって単体最適の暫定決定をそのまま確定する
- 採用理由（変更なし）:
  - HonoはtRPCアダプタが公式にあり、Cloud Runでの起動も軽量
  - DDDのレイヤ構成はフレームワークに依存させず `packages/` 側で自前に持つ
  - SSE(T-2)はHonoのストリーミングレスポンスで実装
- **plainerから移植するのはFWではなく構造規約**（詳細は `07-backend-design.md`）:
  - Router（tRPC procedure）は「認証・テナント解決 → UseCase呼び出し」だけの薄いadapter（KtorのRouter/UseCase分離を踏襲）
  - 1ユースケース1ファイル・`<動詞句>`命名 / 1集約1Repository / interface分離なしの具象Repository
  - テナント分離の二層防御。ただしiegotoではスコープ引数（familyId）を**必須引数として型で強制**し、plainerの「規約+CI検知」より一段強くする

## T-6 モノレポツール: **pnpm workspace + Turborepo** — 確定

- 構成案:
  ```
  iegoto/
  ├── apps/
  │   ├── web/        # フロントエンド (Vite + React SPA。T-4)
  │   └── api/        # バックエンド (Hono + tRPC。T-5)
  ├── packages/
  │   ├── domain/     # ドメイン層（エンティティ・値オブジェクト・ドメインサービス）
  │   ├── db/         # Prismaスキーマ・リポジトリ実装（infrastructure層）
  │   ├── shared/     # 共有型・ユーティリティ（TZ処理・RRULEラッパ等）
  │   └── theme/      # Chakra UIテーマトークン（plainerの packages/theme 方式。R-1）
  ├── flags/          # フィーチャーフラグ定義（08-feature-flag.md）
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
| T-1 | DB | Cloud SQL (PostgreSQL) + Prisma | **確定**（JOOQはKotlin専用のため「合わせる」対象なし） |
| T-2 | リアルタイム | SSE + LISTEN/NOTIFY、ポーリングfallback | 確定 |
| T-3 | API | tRPC | **確定**（plainerのREST+生成パイプラインは言語境界用の装置であり不採用。hooksの書き味は同型） |
| T-4 | フロント | **Vite + React SPA（React Router）** | **確定**（plainerのfrontに合わせNext.js案を破棄。認証はバックエンドOAuth+セッションクッキーに変更） |
| T-5 | バック | Hono + tRPC + 自前DDDレイヤ | **確定**（plainerはKotlin/Ktorのため構造規約のみ移植） |
| T-6 | モノレポ | pnpm workspace + Turborepo | 確定 |
| T-7 | Google同期 | Schedulerポーリング + syncToken差分、token暗号化保存 | 確定 |
| T-8 | CI/CD | GitHub Actions + WIF、stg自動/prod承認 | 確定 |
