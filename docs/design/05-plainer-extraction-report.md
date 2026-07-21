# plainer構成抽出レポート（R-1〜R-4）

作成日: 2026-07-17
ステータス: 完了（plainer 3リポジトリを直接参照して抽出。パス引用はすべて実ファイルを確認済み）
参照リポジトリ: `learningsales/plainer-backend` / `learningsales/plainer-feature-flag` / `learningsales/plainer-infrastructure`（すべて読み取りのみ）
反映先: `02-tech-selection.md`（T-1/T-3/T-4/T-5確定） / `06-frontend-design.md` / `07-backend-design.md` / `08-feature-flag.md` / `04-operations.md` O-1

> 注: 事前の想定と異なり、plainer-backend のバックエンドは **Kotlin/Ktor**（TypeScriptではない）。
> また featureflag は plainer-backend 内のパッケージではなく **独立リポジトリ `plainer-feature-flag`** として存在した。
> HANDOFF.md 記載の「plainer-featureflag という単独リポジトリは存在しない模様」は誤りだったことを確認。

---

## R-1 フロントエンド構成（plainer-backend/front）

### 事実

- **フレームワーク**: Vite 7.3.3 + React 19.2.4 + TypeScript 6.0.3 の **SPA**。Next.js等は不使用（`front/package.json`、`front/vite.config.mts`）
- **ルーティング**: `react-router-dom` 7.9.4。ファイルベースではなく **`RouteObject[]` のオブジェクト定義**（`front/src/routers/router.tsx`）。`loader` によるredirectも併用
- **page単位構成の実際のルール**（一次ソース: `front/CLAUDE.md`）:
  - `pages/` は**薄いラッパーのみ**。`useDocumentTitle` + 対応containerのマウント + モーダル用`<Outlet />`だけでロジックを持たない（例: `front/src/pages/tags/tags-page.tsx` 全16行）
  - ロジック・API呼び出し・状態・ハンドラは **`components/{domain}-container/use-*.ts`** に全集約（co-locationパターン）。UIコンポーネントはprops経由の純粋UI
  - 1つのcontainerディレクトリにUI(`*.tsx`)・ロジック(`use-*.ts`)・純粋関数・テスト(`*.test.ts(x)`)を同居させる（例: `front/src/components/content-edit-container/`）
  - 200行以上のモーダルは`*-modal/`ディレクトリにco-locate、未満はフラット`*-modal.tsx`。hookは1責務・300行超でsub-hook分割
- **共通/ドメインの使い分け**:
  - `components/{domain}/` は `pages/` のディレクトリ名と**1:1**（深さ上限2、ドメイン間import禁止をCIスクリプト`check:domain-imports`で機械チェック）
  - 共通昇格は **rule of two**（2ドメイン目から参照された時点で`components/`直下へ。先回り配置は禁止）
  - 「UIは共有・hookはドメイン別」（同型UIはprops注入で共有し、`use-xxx.ts`は各ドメインに残す）
  - グローバルhookは `hooks/`（`use-auth` / `use-plainer-toast` / `use-feature-flags` 等）、純粋関数は `utils/`（テスト必須）
- **状態管理・データフェッチ**: TanStack Query 5.90（`staleTime: 60s`等は`front/src/providers/query-provider.tsx`）+ jotai 2.15（**atom直接export禁止、hook経由のみ**）
- **APIクライアント生成**: TypeSpec → OpenAPI → orval の3段（`pnpm generate`）。orvalは`client: 'react-query'` + `tags-split` + fetchベース`customInstance`（`credentials: 'include'`、非OK時`ApiError` throw）。生成物は共有パッケージ`@plainer/api-client`に一本化し front / operator-portal 双方がimport。生成物driftはCI（`api-codegen-check.yml`）で検知。**原則hook使用・生関数の直接await禁止**、mutation副作用は`onSuccess`に`invalidateQueries`を寄せる
- **スタイリング**: Chakra UI v3 (3.28.0) + 共有パッケージ`@plainer/theme`（`createSystem` + カスタムトークン + recipes、`chakra:typegen`で型生成）。short-hand props・tokenのみ・固定色直書き禁止。ただしトークン実体はBulma由来の固定色を引き継ぐ過渡期の負債を含む
- **テスト**: Vitest 4 + Testing Library + MSW。**`hooks/`と`utils/`は`*.test.ts(x)`必須**（親CLAUDE.md共通規約）。co-location内のhook・純粋関数も同ディレクトリにテスト併設
- **PWA/Web Push**: **該当なし**（plainer frontにService Worker/manifest/push実装は存在しない。MSWのworkerはモック専用）

### iegotoへの適用判断

Vite+React SPAである事実によりT-4の「Next.js暫定」は覆る（→ `02-tech-selection.md` T-4）。co-location規約・rule of two・テスト規約は移植価値が高い。PWA/Pushはplainerに前例がなく自前設計（→ `06-frontend-design.md`）。

## R-2 バックエンド構成（plainer-backend）

### 事実

- **言語/FW**: **Kotlin 2.3 / JVM 21 / Ktor 3.4**（`build.gradle.kts`）。TypeScriptではない
- **API形式**: REST。**TypeSpecスキーマファースト**（`typespec/*.tsp`がSSoT → `openapi/openapi.yaml`生成 → orvalでTSクライアント生成）。OpenAPI手編集禁止、Kotlin実装との整合はテストで機械検査（`jp.co.plainer.app.openapi.*`）
- **レイヤ構成**: DDD標準の4層ディレクトリではなく独自マッピング:
  - `route/`（presentation + application: **UseCaseがrouterとco-location**） / `service/`（横断ワークフロー） / `repository/`（infrastructure、フラット配置） / `domain/`（エンティティ） / `config/` / `shared/`
  - 依存方向はArchUnit的な強制ではなくCLAUDE.md規約 + CIガードテスト（`AsteriskUsageGuardTest`、`RouterBoundaryTest`等）で担保
- **リポジトリパターン**: **interface分離なし・具象クラス直**（全Repositoryが`class XxxRepository(private val dslContext: DSLContext)`）。「1 DomainObject = 1 Repository」が実態としても守られている。DIはコンテナ不使用の**手動DI**（トップレベルファクトリ関数 `fun contentRepository() = ContentRepository(dslContext())`）
- **UseCase**: **1 UseCase = 1クラス（`object`シングルトン）、publicは原則`process()`のみ**。命名は`<動詞句>UseCase`（`ContentExportUseCase`等）。置き場所は`route/`配下にrouterと同居。Routerは「セッションからテナント解決 → UseCase呼び出し → respond」の薄いadapter:
  ```kotlin
  // route/privates/api/page/ApiPageRouter.kt:22-29
  val productId = session.getProductId(nameUrl) ?: throw UnauthorizedProductAccessException()
  val output = PagesGetUseCase.process(productId, contentId)
  call.respond(output)
  ```
- **ORM/マイグレーション**: JOOQ 3.20（codegen、asterisk全面禁止・具体カラム列挙）+ Flyway（`V{YYYYMMDDHHmmss}__{snake_case}.sql`、UTC）
- **ドメインテスト**: Kotest `FunSpec`一択（751ファイル）。domainは不変data class + ファクトリ`new()`で外部依存なしの純粋ユニット（`PageTest.kt`）。`testUnit`タスクで高並列実行
- **テナント分離（IDOR防止の二層防御）**: ①Router層でセッションからproductId解決 ②UseCase層でRepositoryに**scoped find**（`find(id, productId = productId)`）。スコープ引数はKotlinでは**オプショナル**で、渡し忘れはCLAUDE.md規約+専用スキル`/idor-detector`+CIスキャンで検知する運用

### iegotoへの適用判断

言語が異なるためFW・ORMの直接流用は不可能で、**移植するのは構造規約**（Router薄型化 / UseCase粒度・命名 / 1集約1Repository / 二層防御）。iegotoはTSの型システムでplainより一段強くでき、**スコープ引数を必須化**して型レベルで越境を防ぐ（→ `07-backend-design.md`）。T-5の「plainerがNestJSなら合わせる」前提は消滅（→ T-3/T-5確定の根拠）。

## R-3 フィーチャーフラグ（plainer-feature-flag）

### 事実

- **アーキテクチャ**: `flags/{dev,stg,prd}/feature-flags.json`（Git管理）→ GitHub Actionsデプロイ → GCS → Cloud Functions v2（`flagApi`）→ API Gateway（Google ID Token認証）→ plainer-backend。環境はGCPプロジェクト完全分離
- **フラグ定義**: `name` / `description` / `defaultValue` / `cleanupBy` の4フィールド必須（JSON Schema検証、`additionalProperties: false`）。`cleanupBy`は**削除見積もり日付（有効期限ではない）**で、API配信物からは二重に除去される内部フィールド
- **削除履歴**: `deleted-flags.json` に理由つきで永続化し**フラグ名の再利用を禁止**。CI（`ci-flags.yaml`）がschema/重複/再利用/削除登録漏れを検証
- **棚卸し**: `notify-flag-cleanup.yml` が平日09:00 JSTに`cleanupBy`超過フラグをSlack通知。恒久フラグは`2099-12-31`
- **backend側の消費**: 配信APIを直接引かず**同期ジョブでDBテーブルに同期 → 評価はDB参照**（stale-but-serving。API障害時もリクエストパス無影響、空レスポンス時は削除スキップで全消し防止）。評価ヘルパーは`isTruthy`（未登録→false: fail-closed）と`isEnabledOrDefaultTrue`（未登録→true: fail-open）の2モード
- **front側**: セッション埋め込み + `GET /api/v1/feature-flags`の2経路。取得中・エラー時はfail-closed

### iegotoへの適用判断

この配管の複雑さの大半は「フラグ基盤とbackendが別GCPプロジェクトでIAM/Gateway越境認証する」商用SaaS要件に由来し、Cloud Run 1サービスのiegotoにはオーバースペック。**「Git管理+schema検証+cleanupBy棚卸し+削除履歴+fail-closed/fail-open 2モード」という運用規律だけを移植**し、GCS/Functions/Gateway/DB同期ジョブは持ち込まない（→ `08-feature-flag.md`）。

## R-4 Terraform構成（plainer-infrastructure）

### 事実

- **3層構成**: `terraform/gcp/` 配下に `modules/`（25個: cloud_run / cloud_sql / cloud_scheduler / secret_manager / cloud_monitoring 等） / `environments/`（dev / stg / prd / stg-mon / prd-mon / dns / local の7ワークスペース） / `stacks/`（複数モジュールを束ねた機能単位）
- **モジュールのパラメータ化**: 「巨大object変数 + `optional()`デフォルト + `validation` + `for_each`」パターン。例: `cloud_run`は`services = map(object({...}))`を受けサブモジュール`service/`/`job/`/`service_account/`に分割。outputsで他モジュールへname→resource mapを公開
- **環境分離**: 環境差分は**tfvarsではなくlocals**（`locals.tf` + サービス別`locals_*.tf`約20ファイル、`*.tfvars`は.gitignoreで全除外）。`main.tf`でモジュールにlocalsを丸渡し
- **state/実行**: **Terraform Cloud**（org `PLAINER`、workspace `gcp-{env}`）でstate管理+plan/apply実行。GitHub Actionsはfmtチェック（`terraform-fmt.yml`）とAIレビュー（`claude-pr-review.yml`）のみ
- **Secret管理**: `secret_manager`モジュールは**「器（secret ID）だけ」を作り、値はTerraformに書かない**（`secret_data_wo`のwrite-onlyダミー初期値、実値は別途投入）。Cloud Runへは`dynamic "env"` + `secret_key_ref { version = "latest" }`で**環境変数として注入**（volumeではない）。非機密`env.vars`と機密`env.secrets`をlocalsで明確分離
- **Cloud SQL dev実例**: POSTGRES_17 / db-f1-micro / ZONAL / private IP（VPC + allocated_ip_range）/ PITR・バックアップ7世代・`deletion_protection`はモジュール内固定

### iegotoへの適用判断

流用するのは「modules/envs分離 + locals方式 + 巨大object変数パターン + Secretの器だけ方式 + env注入」。簡略化するのは①Terraform Cloud → **GCS backend + GitHub Actionsでplan/apply**（T-8と整合）②環境をstg/prodの2つに圧縮③モジュールは使う機能だけに削る④VPC+コネクタは使わず**Cloud Run内蔵のCloud SQL接続**で代替（コスト削減、T-1と整合）（→ `04-operations.md` O-1）。

---

## 抽出結果によるT-3/T-4/T-5への影響サマリ

| 暫定決定 | plainerの実態 | 判定 |
|---|---|---|
| T-3: tRPC（plainerがRESTならRESTに倒す余地） | REST + TypeSpec→OpenAPI→orvalの3段生成 | **tRPC確定**。plainerの生成パイプラインはKotlin↔TSの言語境界を越えるための装置であり、TSモノレポでは根本理由が存在しない。型共有はtRPCが生成なしで達成する |
| T-4: Next.js App Router（plainerのfrontに合わせる第一候補） | Vite + React SPA + React Router 7 | **Vite + React SPAに変更**。SSR不要（認証必須・SEO不要）でco-location規約・Chakra v3・TanStack Queryの資産をそのまま移植できる |
| T-5: Hono + tRPC（plainerがNestJSならNestJS+REST） | Kotlin/Ktor（TSフレームワークではない） | **Hono + tRPC確定**。FWの直接一致は原理的に不可能。plainerからは構造規約（Router薄型化・UseCase粒度・二層防御）を移植する |
| T-1のORM: Prisma暫定（plainerのORMに合わせる余地） | JOOQ（Kotlin専用） | **Prisma確定**。制約が言語ごと消滅 |

詳細な確定理由は `02-tech-selection.md` を参照。
