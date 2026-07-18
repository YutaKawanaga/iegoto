# iegoto 運用・品質方針（§10.4 O-1〜O-5）

作成日: 2026-07-17（同日更新: R-4完了によりO-1のTerraform構成を確定）
ステータス: 決定案
関連: `docs/design/02-tech-selection.md` / `docs/design/05-plainer-extraction-report.md` R-4

---

## O-1 環境構成

**決定: dev はローカル（docker compose）、クラウドは prod のみの1環境**（設計レビューで変更。個人利用のWebアプリでstg維持コストが見合わないため）。

| 環境 | 実体 | 用途 |
|---|---|---|
| dev | ローカル docker compose（Postgres）+ `pnpm dev` | 日常開発。GCPリソース不要で回せることを必須要件にする |
| prod | GCPプロジェクト `iegoto-prod` | main merge時の自動デプロイ先（T-8）。品質担保はPR CI（unit/統合/E2E）に寄せる |

- stgを持たない代わりの安全弁: PR CIのE2E（ローカル環境相手）/ デプロイ後ヘルスチェック+リビジョンロールバック / 本番投入前の新機能はフィーチャーフラグの`enabledFamilyIds`で自家族限定公開（08）
- Terraformの`envs/`はprodのみ作成。locals方式（下記）のため、将来stgが必要になったら`envs/prod`の複製+locals差し替えで追加できる

### 配信構成（セルフレビューで確定）

**SPA（apps/web）のビルド成果物は、API（Hono）と同一のCloud Runコンテナから配信する（単一オリジン）。**

- Dockerイメージのビルド時に`apps/web`をビルドし、Honoが静的ファイルとして配信（`/api`・`/trpc`以外はSPAフォールバック）
- 理由: ①CORS設定が不要 ②セッションクッキーがSameSite=Laxで素直に動く ③PWAのscopeが自然に`/`になる ④配信用インフラ（GCS+LB等）が丸ごと不要
- 独自ドメインはCloud Runのカスタムドメインマッピングで接続（LBを立てない。証明書は自動管理）

- Terraformディレクトリ構成（R-4のplainer構成を縮小移植して確定。`05-plainer-extraction-report.md`）:
  ```
  infra/
  ├── modules/
  │   ├── cloud_run_service/   # サービス本体 + secret注入 + Cloud SQL接続
  │   ├── cloud_sql/           # PITR・バックアップ設定込み（O-3）
  │   ├── cloud_scheduler/     # Google同期(毎時) + リマインダー配信(毎分)。httpターゲットのみに削る
  │   ├── secret_manager/      # 「器だけ」方式（下記）
  │   ├── artifact_registry/
  │   └── monitoring/          # O-2のアラート3種
  └── envs/
      └── prod/                # backend.tf(GCS) / locals.tf / main.tf / provider.tf
                               #   ※stgは作らない。必要になったらこの複製+locals差し替えで追加
  ```
- plainerから移植する型（R-4）:
  - モジュールは「object型変数 + `optional()`デフォルト + `validation`」でパラメータ化し、環境側から丸渡し
  - **環境差分はtfvarsではなく`envs/*/locals.tf`に集約**（plainer方式。tfvarsは.gitignore対象とし使わない）。モジュール本体に環境分岐を書かない
  - **Secretは「器だけTerraform」**: secret IDのみ作成し、値はTerraformに書かない（ダミー初期バージョン→実値は手動/CI投入）。Cloud Runへは`secret_key_ref`の環境変数注入。非機密`env.vars`と機密`env.secrets`をlocalsで分離
- plainerから簡略化する点（R-4の注意点を採用）:
  - **stateはTerraform CloudではなくGCS backend**。plan/applyはGitHub Actions（T-8: PRでplanコメント、applyはmerge後に手動承認）
  - 環境はprodのみ（monitoring専用workspace・dns・local環境は作らない。監視はmonitoringモジュールに同居）
  - **VPC・VPCコネクタは作らない**: Cloud Run内蔵のCloud SQL接続（T-1のコネクタ方式）を使い、ネットワーク系モジュールを丸ごと省略
- Web Push(FCM/VAPID)・Google OAuthクライアントは**ローカル開発用とprod用を分離**（開発中の通知が本番端末に飛ぶ事故を防ぐ）

### 月額コスト試算（prod・asia-northeast1、2026年時点の概算）

| リソース | 構成 | 月額目安 |
|---|---|---|
| Cloud SQL (db-f1-micro) | 常時起動・ZONAL・SSD 10GB・バックアップ7世代+PITR | **$10〜14**（インスタンス$8〜11 + ストレージ$2 + バックアップ$1前後） |
| Cloud Run | min-instances=0（T-2でポーリング採用のためscale-to-zero可） | $0〜2（家族規模のリクエストは無料枠内が中心） |
| Cloud Scheduler | 2ジョブ（Google同期・リマインダー） | $0（3ジョブまで無料） |
| Artifact Registry / Secret Manager / GCS(state・エクスポート) / Logging・Monitoring | — | $0〜1（ほぼ無料枠内） |
| **合計** | | **月 $12〜17（約¥2,000〜2,700）**。支配項はCloud SQL |

- 別途: 独自ドメイン代（年¥1,500〜2,000程度）
- 将来SSE化（T-2の拡張パス）するとSSE接続中インスタンスが保持され実質min-instance=1相当（+$10〜20/月）になる点に注意。ポーリング採用はコスト面でも効いている
- 削減余地: SSD→HDDで-$1程度 / それ以上下げたい場合はDBだけ外部マネージド（Neon等の無料枠）に出す選択肢があるが、T-1の構成と運用が分裂するためコストが痛くなってから検討
- 金額は概算。着手時に[公式料金](https://cloud.google.com/sql/pricing)で再確認する

## O-2 監視・エラートラッキング

**決定: Sentryをフロント・バック両方にMVPから導入。メトリクス監視はCloud Monitoringの標準機能+最小のアラートのみ。**

- Sentry（無料枠で開始）: フロント（ソースマップアップロードをCIに組み込み）+ バック（ユースケース層でコンテキスト付与: familyId・ユースケース名。**個人情報＝予定タイトル等はSentryに送らない**。§6プライバシー要件）
- Cloud Monitoring アラート（最小構成）:
  - Cloud Run 5xx率
  - Cloud SQL ディスク使用率・接続数
  - Cloud Scheduler ジョブ失敗（Googleカレンダー同期・リマインダー配信の停止は気づきにくいので必須）
- 通知先: メール（個人運用のため。SlackはCould）

## O-3 バックアップ

**決定: Cloud SQL自動バックアップ（日次・7世代）+ PITR（ポイントインタイムリカバリ）有効化。リストア手順を docs に残し、半年に1回「バックアップから一時インスタンスへ復元→確認→破棄」のリハーサルを行う**（stg廃止に伴い一時インスタンス方式に変更）。

- 自動バックアップ: 日次（深夜帯）、保持7日
- PITR: トランザクションログ保持7日（「昨日の操作ミスで予定が消えた」に分単位で戻せる。家族の予定は消えたら致命的、の要件に対する主対策）
- prodのみ月次でGCSへの論理エクスポート（`pg_dump`）を追加保持（インスタンス自体の削除事故への保険。保持12ヶ月）
- リストア手順書を `docs/runbooks/restore.md` として整備（本番で初めてやらない）
- アプリ層の論理削除（S-3）が第一の防御線、PITRが第二、エクスポートが最終ライン、という3層構え

## O-4 テスト戦略

**決定: ドメイン層ユニットテスト必須 + ユースケース統合テスト（実Postgres）+ E2Eはクリティカルパス2本のみ。**

| レイヤ | 方針 | ツール |
|---|---|---|
| domain | **必須**。特に繰り返し予定の展開・分割（「これ以降すべて」）・例外適用、TZ境界（終日予定・月末・第n曜日）、サジェストの正規化/集約はテーブル駆動で網羅 | Vitest |
| application | 主要ユースケースを実Postgres（Testcontainers）で統合テスト。特にメンバー削除時の担当者未定化、招待の失効・期限、familyId越境アクセスの拒否 | Vitest + Testcontainers |
| presentation/front | コンポーネント単体は最小限。ロジックはhooks/domainに寄せてそちらでテスト | Vitest + Testing Library |
| E2E | クリティカルパス2本のみ: (1)サインアップ→メンバー追加→予定作成→カレンダー表示 (2)買い物リスト追加→別セッションでリアルタイム反映確認 | Playwright |

- CI（T-8）でユニット+統合+E2Eを必須チェック化（E2EはCI内で起動したローカル環境相手に実行。stg廃止のため、デプロイ後は書き込みを伴わないヘルスチェックのみ）
- ユニット・統合テストのファイルはソース隣接（co-location、`*.test.ts`）。E2Eコードのみモノレポ直下の `e2e/` workspaceに置く（plainerの`e2e/`構成: `tests/` / `fixtures/` / `helpers/` を踏襲）
- 繰り返し予定まわりはバグ密度が最も高くなる箇所と想定し、RRULEラッパを `packages/domain`（event配下）に隔離して集中的にテストする

## O-5 成功指標（MVP完了定義）

**決定: 「自分の家族で2週間、紙のカレンダー/TimeTreeを開かずに運用できたらMVP完了」を主指標とし、補助の定量指標で崩れを検知する。**

- 主指標（定性）: 2週間の実運用で既存手段（紙・TimeTree）に一度も戻らない
- 補助指標（定量、2週間の運用期間中に計測）:
  - 家族のログイン可能メンバー全員が週4日以上アプリを開く
  - 週あたり新規予定登録 5件以上（「見るだけ」で登録が続かない状態の検知）
  - 担当者付き予定の割合 30%以上（担当者機能が使われているか＝差別化機能の検証）
  - 買い物リスト経由の買い物が週1回以上
  - Web Push到達: 家族の全ログインメンバーがPWAインストール+通知許可済み（F-08/F-09の成立確認）
- 運用中に発生した不満・手戻りはGitHub Issuesに起票し、MVP完了判定時に「Must昇格すべきものが残っていないこと」を条件に加える
