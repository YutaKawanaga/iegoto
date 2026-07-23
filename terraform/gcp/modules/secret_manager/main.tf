# シークレットの箱のみ作成。値は移行時に手動/CIで add-version する (tfstate に値を残さない)
resource "google_secret_manager_secret" "secrets" {
  for_each  = toset(var.secret_ids)
  project   = var.project_id
  secret_id = each.value
  replication {
    auto {}
  }
}
