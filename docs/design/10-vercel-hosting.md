# iegoto ホスティング構成（当面の採用: Vercel無料構成）

作成日: 2026-07-19
ステータス: **採用**（当面のホスティング）。`04-operations.md` O-1のGCP構成は**破棄せず移行先候補として保持**する
関連: `04-operations.md` / `02-tech-selection.md` T-8 / `07-backend-design.md`

---

## 0. 決定

**当面はVercel + Neonの完全無料構成で運用する（月額$0、独自ドメインも取得しない）。**
GCP構成（O-1）は設計資産として残し、§5の移行トリガーを満たした時点で移行する。

## 1. 構成

```
GitHub (main merge)
  └→ Vercel Git連携
       ├── apps/web  → 静的配信（SPA）
       └── apps/api  → Vercel Functions（Honoアダプタ）─┐
                                                        ├→ Neon (Postgres, pooler経由)
Cloud Scheduler（無料枠3ジョブ・GCPで唯一残す）─────────┘
  ├── 毎時: Google同期      → https://<app>.vercel.app/jobs/sync-google-calendar
  ├── 毎分: リマインダー配信 → https://<app>.vercel.app/jobs/dispatch-reminders
  └── 日次: pg_dumpバックアップ起動（§3）
```

| 要素 | サービス | 無料枠の根拠 |
|---|---|---|
| ホスティング/API | Vercel Hobby | 帯域100GB/月・関数実行とも家族規模では余裕。**非商用限定** |
| DB | Neon Free（Postgres） | 0.5GB。予定+買い物データなら当分足りる。autosuspendあり（コールドスタート数百ms許容） |
| cron | GCP Cloud Scheduler | 3ジョブまで無料。VercelのジョブURLを共有シークレットヘッダ付きで叩く（Vercel Hobbyのcronは「2本・日次・精度粗」で要件を満たさないため外部化） |
| バックアップ格納 | Cloudflare R2 or GCS(USリージョン無料枠) | 日次dumpは数MB級 |
| ドメイン | `<app>.vercel.app` サブドメイン | 取得しない。HTTPS自動のためWeb Push/PWA/OAuthすべて成立 |

- 単一オリジンの原則（O-1配信構成）はVercelでも同じ: SPAとAPIが同一オリジンで、CORS不要・SameSite=Laxクッキー・PWA scope `/`
- 環境変数・シークレットはVercelダッシュボードで管理（Secret Managerは使わない）
- Prisma→Neonは**pooler接続文字列**を使う（サーバレスからの直結はコネクション枯渇するため必須）
- PRごとのPreview Deploymentが無料で付く。stgを持たない決定（O-1）の補完として活用する
  （Preview環境のDBはNeonのbranch機能 or 共有devブランチDB。本番DBには向けない）

## 2. デプロイ・CI（T-8のVercel版）

- デプロイはVercelのGit連携に委譲: main merge → production、PR → Preview
- GitHub Actionsは**CI専用**（lint / typecheck / unit+統合 / E2E）。必須チェックを通らないとマージ不可（ここは変更なし）
- Terraformは当面**凍結**（GCPで残るのはScheduler 3ジョブのみで、手作業で十分。GCP移行時にO-1の設計を解凍する）
- jobs認証: GCP構成のOIDC検証の代わりに、`Authorization: Bearer <CRON_SECRET>`の共有シークレット検証
  （SchedulerのHTTPヘッダ設定 + Vercel環境変数。`07-backend-design.md`のjobs実装で分岐ではなく抽象化して吸収）

## 3. バックアップ（O-3の無料版・重要な代償ポイント）

Neon Freeは復元ポイントの保持が短く、Cloud SQLのPITR 7日相当の保護がない。**日次pg_dumpを最初から必須とする**:

- 日次でdumpジョブ（Scheduler起点）→ R2/GCSへ保存、30世代保持
- 月次分は12ヶ月保持（O-3の月次エクスポートと同じ）
- リストア手順書（O-3）はNeonへの`pg_restore`手順として書く。リハーサルはNeonのブランチに復元して確認
- アプリ層の論理削除（S-3）が第一の防御線である点は変わらない

## 4. 制約の受容（決定済みのトレードオフ）

| 制約 | 受容理由・対策 |
|---|---|
| Vercel Hobbyは非商用限定 | 自家族用の個人アプリなので該当しない。他家族に提供し始めるなら§5で移行 |
| PITRがない | §3の日次dump + 論理削除でカバー。「分単位で戻せる」保護は失う |
| SSE拡張パスが細い（接続中課金） | T-2でポーリングファースト採用済みのためMVPに影響なし |
| vercel.appドメインのまま | 後から独自ドメインへ移すと**PWAインストールとPush購読はオリジン単位のため家族に再インストール・再許可してもらう必要がある**。家族数人なので許容（アプリ内で案内すれば済む） |
| Neon autosuspendのコールドスタート | 朝イチの初回アクセスが数百ms遅い程度。許容 |

## 5. GCP構成（O-1）への移行トリガー

いずれかを満たしたらO-1のGCP構成へ移行する（設計・Terraform構成は保持済みのため解凍するだけ）:

1. 自家族以外への提供を始める（Hobbyの非商用制限に抵触）
2. 「分単位で戻せる」バックアップ（PITR）が欲しい事故・ヒヤリを経験した
3. NeonのDB容量・接続数が無料枠を超えた
4. SSE等、常駐プロセス前提の機能を本格導入したくなった

移行時の注意: オリジンが変わるためPush購読・PWAインストールの再設定が必要（§4と同じ性質）。
DBはpg_dump/restoreで移行（0.5GB以下なので数分）。

## 6. 運用実績による更新 (2026-07-23)

本ドキュメントの計画からの差分・確定事項:

- **リージョン**: Neon は aws-ap-southeast-1 (Singapore)。Vercel Functions を `sin1` に固定
  (デフォルト iad1 のままだと関数↔DB が毎クエリ太平洋横断になり体感悪化した実測に基づく)
- **リポジトリは public**: Hobby プランの private リポジトリでは「コミット作者が
  プロジェクト協力者でない」判定で Git 連携/Deploy Hook の両方がブロックされたため、
  履歴全体のシークレットスキャンを実施の上で public 化して解決した
- **§3 バックアップ**: R2/GCS ではなく GitHub Actions (日次 pg_dump → Artifacts 30日保持、
  毎月1日分は90日) で実装。復元手順は docs/deploy.md
- **定期ジョブ**: Cloud Scheduler 相当は GitHub Actions cron (リマインダー配信 5分間隔)
- **§5 GCP移行**: IaC スケルトンを `terraform/gcp/` に用意済み (フィーチャーフラグの
  GCS配信化を含む)。移行トリガーを踏んだら解凍する
