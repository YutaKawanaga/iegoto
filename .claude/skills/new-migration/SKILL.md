---
name: new-migration
description: Prisma のDBマイグレーションを正しい手順で追加する。「テーブルを足したい」「カラム追加」「スキーマ変更」で使用。
---

# マイグレーション追加

1. `packages/db/prisma/schema.prisma` を編集する
   - テーブル/カラム名は snake_case へ `@map` する (既存モデルの流儀に合わせる)
   - コメントで用途を書く
2. マイグレーションSQLを生成・適用する:

```bash
cd packages/db
DATABASE_URL=postgresql://iegoto:iegoto@localhost:5432/iegoto \
DIRECT_URL=postgresql://iegoto:iegoto@localhost:5432/iegoto \
pnpm run migrate:dev --name <snake_case_description>
```

3. テストDBにも適用し、クライアントを再生成する:

```bash
DATABASE_URL=postgresql://iegoto:iegoto@localhost:5432/iegoto_test \
DIRECT_URL=postgresql://iegoto:iegoto@localhost:5432/iegoto_test \
pnpm run migrate:deploy
pnpm run generate
```

4. リポジトリ層を追加/変更した場合は `src/repositories/integration.test.ts` にテストを足す
   (テナント境界: familyId 必須第一引数の規約を守る。07 §2)
5. 本番への適用は Vercel のビルド時 `prisma migrate deploy` が自動で行う (手作業不要)
