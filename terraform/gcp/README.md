# terraform/gcp — GCP移行用スケルトン (未適用)

現在の本番は Vercel + Neon の0円構成 (docs/design/10)。本ディレクトリは
**移行トリガー (10 §5: ユーザー数増・PITR必要性・SSE常時接続など) を踏んだ場合**に
解凍して使う GCP 構成 (docs/design/04 O-1) の IaC スケルトン。

## 構成 (plainer-infrastructure の構造を踏襲)

```
environments/prd/   環境別設定 (backend/provider/locals/main)
modules/
  cloud_run_api/    APIサーバ (Hono) の Cloud Run service
  cloud_sql/        PostgreSQL (プライベートIP・PITR有効)
  secret_manager/   シークレット (DATABASE_URL, VAPID鍵, CRON_SECRET 等)
  feature_flags/    フラグ配信用 GCS バケット (plainer-feature-flag 方式)
  scheduler_jobs/   Cloud Scheduler (リマインダー配信・日次バックアップ)
```

## フィーチャーフラグ運用の前提

現構成ではフラグ (flags/feature-flags.json) をビルド時にバンドルしているため、
値の変更に再デプロイが必要。GCP移行時は plainer と同じ
「GCS にフラグ JSON を置き、API が起動時/定期で読む」方式へ切り替える:

- `feature_flags` モジュールがバージョニング付き GCS バケットを用意
- デプロイフローとは独立に `flags/feature-flags.json` をアップロードして反映
- API サービスアカウントに `roles/storage.objectViewer` のみ付与

## 使い方 (移行時)

1. Terraform Cloud (または GCS backend) を backend.tf に設定
2. `environments/prd/locals.tf` の project_id 等を実値に変更
3. `terraform init && terraform plan` で差分確認 → 段階的に apply
4. DBは Neon から `pg_dump | pg_restore` で移行 (数分。docs/design/10 §5)
