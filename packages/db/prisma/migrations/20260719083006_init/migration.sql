-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "family" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "family_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_account" (
    "id" UUID NOT NULL,
    "google_sub" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "avatar_url" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member" (
    "id" UUID NOT NULL,
    "family_id" UUID NOT NULL,
    "user_account_id" UUID,
    "display_name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invitation" (
    "id" UUID NOT NULL,
    "family_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "revoked_at" TIMESTAMPTZ,
    "created_by_member_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event" (
    "id" UUID NOT NULL,
    "family_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "normalized_title" TEXT NOT NULL,
    "memo" TEXT,
    "location" TEXT,
    "is_all_day" BOOLEAN NOT NULL,
    "start_at" TIMESTAMPTZ,
    "end_at" TIMESTAMPTZ,
    "start_date" TEXT,
    "end_date" TEXT,
    "timezone" TEXT NOT NULL,
    "rrule" TEXT,
    "recurrence_end_at" TIMESTAMPTZ,
    "assignee_member_id" UUID,
    "reminder_minutes_before" INTEGER,
    "next_reminder_at" TIMESTAMPTZ,
    "created_by_member_id" UUID NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_target" (
    "event_id" UUID NOT NULL,
    "member_id" UUID NOT NULL,

    CONSTRAINT "event_target_pkey" PRIMARY KEY ("event_id","member_id")
);

-- CreateTable
CREATE TABLE "event_override" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "original_start_at" TIMESTAMPTZ NOT NULL,
    "is_cancelled" BOOLEAN NOT NULL,
    "patch" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_override_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shopping_list" (
    "id" UUID NOT NULL,
    "family_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shopping_list_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shopping_item" (
    "id" UUID NOT NULL,
    "shopping_list_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "added_by_member_id" UUID NOT NULL,
    "checked_at" TIMESTAMPTZ,
    "checked_by_member_id" UUID,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shopping_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "user_account_id" UUID NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_account_google_sub_key" ON "user_account"("google_sub");

-- CreateIndex
CREATE INDEX "member_family_id_idx" ON "member"("family_id");

-- CreateIndex
CREATE UNIQUE INDEX "invitation_token_hash_key" ON "invitation"("token_hash");

-- CreateIndex
CREATE INDEX "invitation_family_id_idx" ON "invitation"("family_id");

-- CreateIndex
CREATE INDEX "event_family_id_start_at_idx" ON "event"("family_id", "start_at");

-- CreateIndex
CREATE INDEX "event_family_id_normalized_title_idx" ON "event"("family_id", "normalized_title");

-- CreateIndex
CREATE INDEX "event_next_reminder_at_idx" ON "event"("next_reminder_at");

-- CreateIndex
CREATE UNIQUE INDEX "event_override_event_id_original_start_at_key" ON "event_override"("event_id", "original_start_at");

-- CreateIndex
CREATE INDEX "shopping_list_family_id_idx" ON "shopping_list"("family_id");

-- CreateIndex
CREATE INDEX "shopping_item_shopping_list_id_idx" ON "shopping_item"("shopping_list_id");

-- CreateIndex
CREATE INDEX "session_user_account_id_idx" ON "session"("user_account_id");

-- AddForeignKey
ALTER TABLE "member" ADD CONSTRAINT "member_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "family"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member" ADD CONSTRAINT "member_user_account_id_fkey" FOREIGN KEY ("user_account_id") REFERENCES "user_account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "family"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event" ADD CONSTRAINT "event_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "family"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_target" ADD CONSTRAINT "event_target_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_override" ADD CONSTRAINT "event_override_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shopping_list" ADD CONSTRAINT "shopping_list_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "family"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shopping_item" ADD CONSTRAINT "shopping_item_shopping_list_id_fkey" FOREIGN KEY ("shopping_list_id") REFERENCES "shopping_list"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_user_account_id_fkey" FOREIGN KEY ("user_account_id") REFERENCES "user_account"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- 部分UNIQUE制約 (S-7): 1アカウント1家族 + 家族内1プロフィールを同時に強制
-- (Prisma schema では表現できないため raw SQL。03-domain-model.md member 表参照)
CREATE UNIQUE INDEX "member_active_user_account_unique"
  ON "member" ("user_account_id")
  WHERE "user_account_id" IS NOT NULL AND "deleted_at" IS NULL;
