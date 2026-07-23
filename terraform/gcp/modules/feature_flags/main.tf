# フィーチャーフラグ配信バケット (plainer-feature-flag 方式)。
# 現Vercel構成の「ビルド時バンドル」から「GCS配信 + API起動時/定期読み込み」へ移行し、
# フラグ変更を再デプロイなしで反映できるようにする。
# アップロードは CI (flags/feature-flags.json の変更検知) が行う想定
resource "google_storage_bucket" "flags" {
  project  = var.project_id
  location = var.region
  name     = "${var.project_id}-${var.app_name}-flags"

  uniform_bucket_level_access = true
  versioning {
    enabled = true # 誤更新のロールバック用
  }
  lifecycle_rule {
    action { type = "Delete" }
    condition {
      num_newer_versions = 10 # 直近10世代のみ保持
      with_state         = "ARCHIVED"
    }
  }
}
