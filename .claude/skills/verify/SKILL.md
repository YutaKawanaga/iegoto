---
name: verify
description: コミット前のフル検証 (lint / typecheck / ユニット+統合テスト / ビルド / 必要ならE2E) を実行する。「検証して」「フルチェックして」「コミット前の確認」で使用。
---

# フル検証

以下を順に実行し、すべて緑であることを確認する。失敗したら修正してから再実行する。

```bash
pnpm exec biome check --write .   # lint + フォーマット (自動修正込み)
pnpm typecheck
DATABASE_URL=postgresql://iegoto:iegoto@localhost:5432/iegoto_test \
DIRECT_URL=postgresql://iegoto:iegoto@localhost:5432/iegoto_test \
pnpm test                          # ユニット + 実Postgres統合テスト
pnpm build
```

- 統合テストは実Postgresが必要。DBが未起動なら起動し、`iegoto_test` が無ければ
  `createdb` + `pnpm --filter @iegoto/db run migrate:deploy` で作る
- 画面 (apps/web) を変更した場合は E2E も実行する:
  `pnpm --filter @iegoto/e2e run e2e` (サンドボックスでは `CHROMIUM_PATH=/opt/pw-browsers/chromium` を付与)
- lint の自動修正で差分が出たら、それもコミットに含める
