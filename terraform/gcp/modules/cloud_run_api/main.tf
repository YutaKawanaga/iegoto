resource "google_service_account" "api" {
  project      = var.project_id
  account_id   = "${var.name}-sa"
  display_name = "iegoto API service account"
}

# フラグバケットは読み取りのみ (最小権限)
resource "google_storage_bucket_iam_member" "flags_reader" {
  bucket = var.flags_bucket_name
  role   = "roles/storage.objectViewer"
  member = "serviceAccount:${google_service_account.api.email}"
}

resource "google_secret_manager_secret_iam_member" "accessor" {
  for_each  = toset(var.secret_ids)
  project   = var.project_id
  secret_id = each.value
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.api.email}"
}

resource "google_cloud_run_v2_service" "api" {
  project  = var.project_id
  location = var.region
  name     = var.name

  template {
    service_account = google_service_account.api.email
    scaling {
      min_instance_count = 0 # コスト優先。コールドスタート許容 (常時1にすると月額増)
      max_instance_count = 3
    }
    containers {
      image = var.image
      resources {
        limits = { cpu = "1", memory = "512Mi" }
      }
      env {
        name  = "FLAGS_BUCKET"
        value = var.flags_bucket_name
      }
      env {
        name = "DATABASE_URL"
        value_source {
          secret_key_ref {
            secret  = "database-url"
            version = "latest"
          }
        }
      }
      # 他のシークレットも同様に secret_key_ref で注入する (移行時に追加)
    }
  }

  lifecycle {
    ignore_changes = [template[0].containers[0].image] # イメージ更新はデプロイパイプライン側
  }
}

resource "google_cloud_run_v2_service_iam_member" "public" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.api.name
  role     = "roles/run.invoker"
  member   = "allUsers" # アプリ層で認証 (Google OAuth + セッション)
}
