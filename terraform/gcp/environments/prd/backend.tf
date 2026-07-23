terraform {
  required_version = ">= 1.9"

  # 移行時に有効化する (Terraform Cloud か GCS backend を選択)
  # backend "gcs" {
  #   bucket = "iegoto-tfstate"
  #   prefix = "prd"
  # }

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 7.0"
    }
  }
}
