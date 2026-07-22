-- Web Push 購読 (F-08)
CREATE TABLE "push_subscription" (
    "id" UUID NOT NULL,
    "user_account_id" UUID NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "push_subscription_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "push_subscription_endpoint_key" ON "push_subscription"("endpoint");
CREATE INDEX "push_subscription_user_account_id_idx" ON "push_subscription"("user_account_id");
ALTER TABLE "push_subscription" ADD CONSTRAINT "push_subscription_user_account_id_fkey"
    FOREIGN KEY ("user_account_id") REFERENCES "user_account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

COMMENT ON TABLE "push_subscription" IS 'Web Push の購読。1行 = 1ブラウザ/1端末';
COMMENT ON COLUMN "push_subscription"."endpoint" IS 'Push サービスのエンドポイントURL (端末を一意に識別)';

-- 通知の種類別 ON/OFF (行がない = 全種別ON)
CREATE TABLE "notification_setting" (
    "user_account_id" UUID NOT NULL,
    "event_created" BOOLEAN NOT NULL DEFAULT true,
    "event_changed" BOOLEAN NOT NULL DEFAULT true,
    "reminder" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notification_setting_pkey" PRIMARY KEY ("user_account_id")
);

COMMENT ON TABLE "notification_setting" IS '通知の種類別 ON/OFF。行がない = 全種別ON';
