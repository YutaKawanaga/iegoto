resource "google_sql_database_instance" "postgres" {
  project          = var.project_id
  region           = var.region
  name             = var.name
  database_version = "POSTGRES_17"

  settings {
    tier    = "db-f1-micro" # 家族規模。必要になったらスケールアップ
    edition = "ENTERPRISE"

    backup_configuration {
      enabled                        = true
      point_in_time_recovery_enabled = true # Neon Free で失っていた PITR (移行動機の1つ)
      transaction_log_retention_days = 7
    }
    ip_configuration {
      ipv4_enabled = false
      # 移行時: private_network に VPC を指定するか、Cloud Run からの直接接続を設定
    }
  }

  deletion_protection = true
}

resource "google_sql_database" "app" {
  project  = var.project_id
  instance = google_sql_database_instance.postgres.name
  name     = "iegoto"
}
