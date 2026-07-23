# 定期ジョブ (現構成の GitHub Actions cron の置き換え)。
# 認証は現APIと同じ Bearer CRON_SECRET (移行時に OIDC 認証へ強化してもよい)

resource "google_cloud_scheduler_job" "dispatch_reminders" {
  project   = var.project_id
  region    = var.region
  name      = "iegoto-dispatch-reminders"
  schedule  = "*/5 * * * *"
  time_zone = "Asia/Tokyo"

  http_target {
    http_method = "POST"
    uri         = "${var.api_url}/jobs/dispatch-reminders"
    # 移行時: ヘッダに Authorization: Bearer <cron-secret> を設定するか、
    # oidc_token ブロックで Cloud Run の IAM 認証に切り替える
  }
}

# 日次バックアップは Cloud SQL の自動バックアップ + PITR が担うため、
# GitHub Actions の pg_dump ジョブは長期保管用途 (月次) に縮退してよい
