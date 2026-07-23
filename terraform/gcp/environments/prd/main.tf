# iegoto GCP構成 (docs/design/04 O-1)。Vercel構成からの移行トリガーは docs/design/10 §5

module "secret_manager" {
  source     = "../../modules/secret_manager"
  project_id = local.project_id
  secret_ids = [
    "database-url",      # Cloud SQL 接続文字列 (pgbouncer/直接)
    "google-client-id",
    "google-client-secret",
    "session-secret",
    "vapid-public-key",
    "vapid-private-key",
    "cron-secret",
  ]
}

module "cloud_sql" {
  source     = "../../modules/cloud_sql"
  project_id = local.project_id
  region     = local.region
  name       = "${local.app_name}-postgres"
}

module "feature_flags" {
  source     = "../../modules/feature_flags"
  project_id = local.project_id
  region     = local.region
  app_name   = local.app_name
}

module "api" {
  source              = "../../modules/cloud_run_api"
  project_id          = local.project_id
  region              = local.region
  name                = "${local.app_name}-api"
  image               = local.api_image
  flags_bucket_name   = module.feature_flags.bucket_name
  secret_ids          = module.secret_manager.secret_ids
}

module "scheduler_jobs" {
  source      = "../../modules/scheduler_jobs"
  project_id  = local.project_id
  region      = local.region
  api_url     = module.api.url
  cron_secret_id = "cron-secret"
}
