# iegoto フロントエンド設計書

作成日: 2026-07-17
ステータス: 決定案（R-1で抽出したplainer front規約をiegotoに適用したもの）
関連: `02-tech-selection.md` T-3/T-4 / `05-plainer-extraction-report.md` R-1 / `docs/requirements.md` F-01〜F-09

---

## 1. 技術スタック（T-3/T-4確定を反映）

| 項目 | 採用 | 備考 |
|---|---|---|
| ビルド/FW | Vite + React + TypeScript | plainer frontと同構成（React 19 / Vite 7世代を起点） |
| ルーティング | React Router（`RouteObject[]`オブジェクト定義） | ファイルベースルーティングは使わない（plainer方式） |
| データフェッチ | tRPC + `@trpc/react-query`（TanStack Query） | orval生成hooksと同じ書き味。`staleTime`等の既定はQueryProviderに集約 |
| クライアント状態 | React state + Context から開始 | jotaiはMVPでは導入しない。導入する場合は「atom直接export禁止・hook経由のみ」（plainer規約）を最初から適用 |
| スタイリング | **shadcn/ui + Tailwind CSS**（Radix UIベース） | 設計レビューでの決定によりplainerのChakra構成は踏襲しない。詳細は§5 |
| Lint/Format | Biome | 抑制コメントには理由必須（plainer共通規約） |
| テスト | Vitest + Testing Library | `hooks/` `utils/` はテスト必須（plainer共通規約） |
| PWA | `vite-plugin-pwa` + 自前Push用Service Worker | plainerに前例なし。§6で自前設計 |

## 2. ディレクトリ構成

plainerの`front/CLAUDE.md`規約を移植し、iegotoの画面（today / calendar / event / shopping / settings / invite）に適用する。

```
apps/web/src/
├── main.tsx                      # エントリーポイント
├── routers/
│   ├── router.tsx                # RouteObject[] 定義（唯一のルート定義箇所）
│   └── protected-routes.tsx      # 認証ガード（未ログイン→/login）
├── pages/                        # 薄いラッパーのみ。ロジック禁止
│   ├── today/today-page.tsx      # F-06 今日のまとめ（ホーム "/"）
│   ├── calendar/calendar-page.tsx
│   ├── shopping/shopping-page.tsx
│   ├── assignments/assignments-page.tsx   # F-04 自分の担当/担当者未定
│   ├── settings/…                # family / members / google / notification 各page
│   ├── invite/invite-join-page.tsx        # /invite/:token（認証後合流）
│   └── login/login-page.tsx
├── components/
│   ├── ui/                       # shadcn/ui生成コンポーネント（CLIで追加する所有コード。§5）
│   ├── layout/                   # RootLayout（ヘッダ・ボトムナビ）
│   ├── today-container/
│   ├── calendar-container/       # 月/週ビュー・メンバーフィルタ（F-02）
│   ├── event-edit-container/     # 予定フォーム（F-03）
│   ├── shopping-container/
│   ├── assignments-container/
│   ├── settings-container/
│   └── invite-join-container/
├── hooks/                        # グローバルhook（テスト必須）
│   ├── use-auth.ts
│   ├── use-family.ts             # セッション中の family / member 一覧
│   ├── use-realtime.ts           # SSE購読 + invalidate + ポーリングfallback（T-2）
│   ├── use-push.ts               # Push購読・許可状態（F-08）
│   ├── use-feature-flags.ts      # 08-feature-flag.md。取得中/エラーはfail-closed
│   ├── use-app-toast.ts          # toast一元化（plainerのuse-plainer-toast方式）
│   └── use-document-title.ts
├── providers/                    # ChakraProvider(theme) / QueryProvider / TrpcProvider
├── utils/                        # 純粋関数（テスト必須）
├── constants/
└── sw/                           # Service Worker（push受信・通知クリック）
```

### 移植する規約（plainer front/CLAUDE.md 由来）

1. **pagesは薄いラッパー**: `useDocumentTitle` + 対応containerのマウント + モーダル用`<Outlet />`のみ。ロジック・データフェッチを書かない
2. **co-location**: ロジックは `components/{domain}-container/use-*.ts` に集約。UIコンポーネントはprops経由の純粋UI。専用子コンポーネント・純粋関数・テストは同ディレクトリに同居
3. **components/{domain} は pages/ と1:1**（勝手なドメイン名を発明しない）。深さ上限2。**ドメイン間import禁止**（CIスクリプトで機械チェック。plainerの`check:domain-imports`相当を自作）
4. **rule of two**: 共通化は2ドメイン目から参照された時点で`components/`直下へ昇格。先回り配置禁止。「UIは共有・hookはドメイン別」
5. **モーダル**: 200行以上は`*-modal/`ディレクトリでco-locate、未満はフラット`*-modal.tsx`。ルーティングと連動するモーダル（予定編集）は`<Outlet />`経由
6. **hook分割**: 1 hook 1責務。300行を超えたらsub-hookに分割し、sub-hookにもテスト併設
7. **共通コード規約**（plainer親CLAUDE.md）: `any`禁止 / `interface`禁止（`type`使用） / `switch`禁止（Recordで置換） / デッドコード禁止 / 静的コレクションのレンダリング内生成禁止 / マジックストリング定数化 / lint抑制コメントに理由必須

## 3. ルーティング設計

| パス | page | 備考 |
|---|---|---|
| `/` | today | ホーム=今日のまとめ（F-06） |
| `/calendar` | calendar | `?view=month\|week&date=…` をURLに持つ（リロード・共有耐性） |
| `/calendar/events/new` `/calendar/events/:eventId` | calendar配下のモーダル | `<Outlet />`でカレンダー上に重ねる。編集スコープ3択もモーダル内 |
| `/assignments` | assignments | 自分の担当 / 担当者未定タブ（F-04） |
| `/shopping` `/shopping/:listId` | shopping | F-05 |
| `/settings/...` | settings各page | family / members / google / notification |
| `/invite/:token` | invite-join | 未ログインならGoogleログイン→合流（S-1/S-2） |
| `/login` | login | 認証はバックエンドの`/auth/google`へリダイレクト（T-4） |

- 認証ガードは`protected-routes.tsx`に集約。`/login`と`/invite/:token`以外はすべて保護
- モバイル（375px〜最優先）: レイアウトはボトムナビ（今日 / カレンダー / 買い物 / 担当 / 設定）を基本とし、PCはサイドナビに切替

## 4. データフェッチ・状態管理

- **サーバ状態はすべてTanStack Query（tRPC hooks）**。手書きfetch禁止、型は`AppRouter`から推論（手書きAPI型の禁止はplainerの「型は生成物からimport」規約のtRPC版）
- mutationは`useMutation` + `mutateAsync`、副作用（invalidate・navigate・toast）は`onSuccess`に集約（plainer規約踏襲）
- **リアルタイム反映（T-2）**: `use-realtime.ts`が家族単位のSSEストリームを購読し、受信イベント（種別+対象ID）に応じて該当queryを`invalidateQueries`する。SSE切断時はフォアグラウンド限定の5秒ポーリングにフォールバック。楽観更新は買い物リストのチェック操作（F-05）のみMVPで採用し、他は再取得で十分
- クエリキーはtRPCの自動キーに委ね、手動キー管理をしない

## 5. スタイリング・UI（shadcn/ui + Tailwind CSS）

設計レビューの結果、UIライブラリはplainerのChakra UIを踏襲せず **shadcn/ui**（Tailwind CSS + Radix UI）を採用する。

- Chakraとの思想の違い: shadcn/uiはnpm依存ライブラリではなく、**コンポーネントのソースをCLIでリポジトリにコピーして所有する**方式。したがって`components/ui/`の扱いはplainerの「編集禁止」と**逆**で、自分のコードとして編集してよい。ただし無秩序な直接改造は避け、カスタマイズはvariant追加（`class-variance-authority`）を優先して生成時の構造から離れすぎないこと
- デザイントークンはTailwind theme + CSS variablesに集約:
  - **メンバーカラー（F-02の核心）**: `--member-1`〜`--member-N`（プリセット8〜12色）をCSS variablesで定義し、Tailwindの`colors.member.*`として公開。予定チップ・アバター・フィルタUIはこのトークン経由でのみ着色し、**固定色の直書き禁止**（plainerの「固定色直書き禁止」規約の趣旨を維持）
  - semanticトークン（`background` / `foreground` / `primary` / `destructive`等）はshadcn標準のCSS variables構成に従う
- クラス合成は`cn()`（clsx + tailwind-merge）、variant定義は`class-variance-authority`のshadcn標準構成
- `packages/theme`は**作らない**（Chakraのテーマ共有パッケージが前提の案だった。Tailwind設定とCSS variablesは`apps/web`内で完結し、webアプリが1つの間は共有パッケージにする理由がない）
- toastはshadcn推奨のsonnerを`use-app-toast.ts`でラップして呼び出しを一元化（plainerのtoast一元化規約の趣旨を維持）
- ダーク対応はMVP外（CSS variables経由を守っていれば後付け可能）

## 6. PWA / Web Push（F-08 / F-09。plainerに前例がないため自前設計）

- `vite-plugin-pwa` でmanifest生成 + precache。オフライン対応はMVPでは「アプリシェルのみ」（データのオフライン閲覧はCould）
- **Push受信用Service Workerは自前実装**（`sw/`）: `push`イベントで通知表示、`notificationclick`で該当画面（予定詳細/今日）へ遷移。`vite-plugin-pwa`の`injectManifest`モードでprecacheと同居させる
- 購読フロー（`use-push.ts`）: PWAインストール済み判定 → `Notification.requestPermission()` → `pushManager.subscribe`（VAPID公開鍵）→ 購読情報をtRPCでバックエンドへ登録（`push_subscription`テーブル）
- iOS制約（F-09）: Web Pushは**ホーム画面追加後のみ**動作するため、オンボーディングで「①ホーム画面に追加 → ②通知を許可」の2段導線を実装。インストール状態は`display-mode: standalone`で判定
- 開発時の注意（R-1の指摘）: Vite devプロキシ・（テストで使う場合の）MSW workerとpush用SWのスコープ衝突に注意。push SWは本番ビルドでのみ登録し、devでは通知UIをモックする

## 7. テスト

- Vitest + Testing Library。`hooks/`・`utils/`・co-location内の`use-*.ts`と純粋関数は**テスト必須**（plainer共通規約）
- tRPCのモックは「hookをラップした自前hook（`use-*.ts`）をユニットテストではモックする」方式を基本とし、コンポーネント結合テストが必要な箇所のみtRPCクライアントをテスト用サーバに差し替える
- カレンダー描画ロジック（週グリッド計算・並列表示のレイアウト計算）は純粋関数として`calendar-container/`内に切り出してテーブル駆動でテスト（RRULE展開自体は`packages/domain`側の責務。O-4）
