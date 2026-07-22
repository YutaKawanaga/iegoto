# デプロイ手順（Vercel + Neon。10-vercel-hosting.md の実施手順）

すべて無料枠で完結する。所要 30 分程度。

## 1. Neon（DB）

1. Vercel ダッシュボード → 対象プロジェクト → Storage → **Create Database → Neon (Postgres)** で作成
   （Neon 単体で作って接続文字列を手で貼ってもよい）
2. 接続文字列を2種類控える:
   - **Pooled connection** (`-pooler` を含む) → 環境変数 `DATABASE_URL`
   - **Direct connection** → 環境変数 `DIRECT_URL`（`prisma migrate deploy` 用）
   - Vercel の Neon 連携を使った場合は自動設定される変数名を上記に合わせてリネームする
3. リージョンは **Singapore (aws-ap-southeast-1)** を選ぶ（現行環境の実値）。
   `vercel.json` の `"regions": ["sin1"]` はこれに合わせて関数を同居させる設定。
   Neon のリージョンを変えた場合は `regions` も揃えること（関数↔DB 間の往復が
   リクエストごとに複数回発生するため、離れているとそれだけで数百msの遅延になる）

## 2. Google OAuth クライアント

1. [GCP Console](https://console.cloud.google.com/apis/credentials) → 認証情報 → OAuth クライアント ID（Web アプリ）
2. 承認済みリダイレクト URI に以下を登録:
   - 本番: `https://<プロジェクト名>.vercel.app/auth/google/callback`
   - ローカル: `http://localhost:8000/auth/google/callback`
3. OAuth 同意画面はテストモードでよい（自分と家族のアカウントをテストユーザーに追加）
4. クライアント ID / シークレットを控える

## 3. Vercel プロジェクト

1. Vercel → Add New Project → この GitHub リポジトリを import
2. 設定はリポジトリの `vercel.json` が正:
   - Framework Preset: **Other** / Root Directory: リポジトリルート（変更しない）
   - Build/Install/Output は vercel.json が上書きする（ビルド時に `prisma migrate deploy` も実行）
3. 環境変数（Production）を設定:

| 変数 | 値 |
|---|---|
| `DATABASE_URL` | Neon の pooled 接続文字列 |
| `DIRECT_URL` | Neon の direct 接続文字列 |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | 手順2の値 |
| `APP_ORIGIN` | `https://<プロジェクト名>.vercel.app` |
| `API_ORIGIN` | `https://<プロジェクト名>.vercel.app`（同一オリジン構成） |

   ⚠️ `AUTH_DEV_BYPASS` は本番に**絶対に設定しない**
4. Deploy。以後は main への push で自動デプロイ、PR で Preview（Preview には本番 DB を向けない —
   Preview 用の環境変数は未設定のままにしておけば API は起動時に fail-fast する）

## 4. 動作確認

1. `https://<プロジェクト名>.vercel.app/health` が `{"ok":true}` を返す
2. トップ → Google ログイン → 家族作成 → 予定作成 → カレンダー表示
3. スマホからも同 URL で確認（375px レイアウト）

## 5. バックアップと復元

日次バックアップは GitHub Actions（`.github/workflows/db-backup.yml`）で自動実行される:

- 毎日 JST 03:00 に `pg_dump -Fc` を実行し Actions Artifacts に保存（30日保持。毎月1日分は90日保持）
- **初回セットアップ（必須・1回だけ）**: GitHub リポジトリの Settings → Secrets and variables →
  Actions に `NEON_DIRECT_URL`（Neon の direct 接続文字列 = Vercel の `DIRECT_URL` と同じ値）を登録し、
  Actions タブから db-backup を手動実行（workflow_dispatch）して成功することを確認する

復元手順（事故時）:

1. GitHub → Actions → db-backup → 対象日の実行 → Artifacts から `iegoto.dump` をダウンロード
2. Neon コンソールで復元先ブランチ（または新プロジェクト）を作成し、direct 接続文字列を控える
3. `pg_restore -d "<復元先のdirect接続文字列>" --clean --if-exists --no-owner --no-privileges iegoto.dump`
4. 内容確認後、Vercel の `DATABASE_URL` / `DIRECT_URL` を復元先に切り替えて Redeploy

補足: まず Neon の Restore（ブランチの過去時点復元。Free は直近24時間）を検討し、
それより古い時点に戻したい場合に本手順を使う。アプリ層の論理削除が第一の防御線である点は 10 §3 のとおり。

## 6. まだやらないこと（フェーズ3/4。09-implementation-order.md）

- Google カレンダー同期（フェーズ3。当面見送り）
- Web Push / PWA 仕上げ（フェーズ4）とリマインダー配信ジョブ

## ローカル開発クイックスタート

```bash
cp .env.example .env        # そのままで動く (AUTH_DEV_BYPASS=1)
docker compose up -d        # Postgres
pnpm install
pnpm db:migrate             # 初回マイグレーション
pnpm --filter @iegoto/api dev    # API :8000
pnpm --filter @iegoto/web dev    # Web :7475 (→ /trpc は 8000 へプロキシ)
# http://localhost:7475 → 「開発用ログイン」ボタンでログイン
```
