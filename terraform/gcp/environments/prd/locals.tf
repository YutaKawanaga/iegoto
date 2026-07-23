locals {
  project_id = "iegoto-prod" # 移行時に実プロジェクトIDへ変更
  region     = "asia-northeast1"
  app_name   = "iegoto"

  # コンテナイメージはデプロイパイプラインが更新する (初期値はプレースホルダ)
  api_image = "asia-northeast1-docker.pkg.dev/${local.project_id}/${local.app_name}/api:dummy"
}
