# iegoto 設計セッション引き継ぎドキュメント

**このドキュメントは、plainerリポジトリ（learningsales org）を参照できるClaude Codeセッションへの引き継ぎ用。単体で全文脈が伝わるように書かれている。**

作成日: 2026-07-17 / 引き継ぎ元: yutakawanaga/iegoto の設計セッション

---

## 0. あなた（新セッション）への依頼

あなたのセッションには `learningsales/plainer-backend`（可能なら `learningsales/plainer-infrastructure` も）がソースとして入っているはず。依頼は次の3ステップ:

1. **§4のR-1〜R-4に従ってplainerの構成を抽出する**（このセッションの本来の目的）
2. 抽出結果をもとに、§3の暫定決定（T-3/T-4/T-5等）を確定または修正する
3. その結果を反映した設計書更新版を**Markdownとしてチャットに出力する**

**重要な制約**: あなたのセッションからは `yutakawanaga/iegoto` リポジトリにアクセスできない（オーナー横断のリポジトリ追加は未サポート）。したがって成果物はコミットではなくチャット出力とし、ユーザーがiegoto側に持ち帰る。plainer側のリポジトリには一切変更を加えないこと。

---

## 1. プロダクト概要（iegoto）

**「家族の予定・買い物・分担を1か所に集める、家族専用のWebカレンダー」**（TimeTreeの汎用グループ型ではなく家族特化）

- 利用環境: Webブラウザのみ（PC/スマホ、レスポンシブ、375px〜最優先）。ネイティブアプリなし
- アカウントモデル（Cozi型）: **家族=1アカウント + メンバーはプロフィール**。スマホを持たない子どももプロフィールとして予定の主体になれる。認証は**Googleログインのみ**。家族内の権限分離はMVPでは無し
- MVP機能（Must）:
  - F-01 家族アカウント・メンバー管理（プロフィールCRUD、招待リンク）
  - F-02 カレンダー表示（月/週、メンバーカラー色分け、メンバーフィルタ、重複は並列表示）
  - F-03 予定CRUD（**対象メンバー（誰の予定か・複数可）と担当者（誰が対応するか）を別項目で持つ**のが差別化点。繰り返しは内部RRULE準拠でGoogleカレンダー相当のUI、例外編集3択。過去予定サジェスト付き）
  - F-04 担当者割当（自分の担当一覧、担当者未定一覧）
  - F-05 共有買い物リスト（複数リスト、リアルタイム反映）
  - F-06 今日のまとめビュー（ホーム画面）
  - F-07 Googleカレンダー読み取り専用インポート（1時間ごと同期）
  - F-08 Web Push通知（変更通知+リマインダー）
  - F-09 PWA対応（iOSでWeb Pushを成立させる前提要件）
- 非機能の要点: 変更は数秒以内に他メンバーへ反映 / 家族外からのアクセス完全遮断 / 子どものデータを扱うため外部提供・広告なし / 個人〜小規模、単一リージョン
- Won't: 予定チャット、アルバム、位置共有、課金、ネイティブアプリ

## 2. 技術方針（決定済みの前提）

- 前後段ともTypeScript、モノレポ（pnpm workspace + Turborepo確定）
- バックエンドはDDD（レイヤ構成はplainer-backendを参考にする ← R-2）
- フロントはplainer-backendのfrontを参考にpage単位ディレクトリ構成（← R-1）
- インフラ: Google Cloud（Cloud Runベース）、IaCはTerraform（← R-4）
- フィーチャーフラグ導入予定、plainerのfeatureflag実装を参考（← R-3）

## 3. ここまでの決定事項サマリ

### 3.1 技術選定（T-1〜T-8）

| # | 論点 | 決定 | 状態 |
|---|---|---|---|
| T-1 | DB | Cloud SQL (PostgreSQL)。ORMは**Prisma暫定**（plainerのORMに合わせる余地あり） | 確定（ORMのみ要確認） |
| T-2 | リアルタイム反映 | SSE + Postgres LISTEN/NOTIFY、フォールバック5秒ポーリング。WebSocket・Firestoreは不採用 | 確定 |
| T-3 | API形式 | **tRPC（暫定）**。plainerがREST(OpenAPI)なら一貫性優先でRESTに倒す。GraphQLは不採用確定 | **暫定 → R-2で確定** |
| T-4 | フロントFW | **Next.js App Router（暫定）**。plainerのfrontが別FWならそちらに合わせる。カレンダーUIは自作+date-fns+rruleパッケージ | **暫定 → R-1で確定** |
| T-5 | バックエンドFW | **Hono + tRPCアダプタ + 自前DDDレイヤ（暫定）**。plainerがNestJSなら「NestJS + REST」の組で一貫させる（NestJS+tRPC混成だけは避ける） | **暫定 → R-2で確定** |
| T-6 | モノレポ | pnpm workspace + Turborepo。apps/web, apps/api, packages/{domain,db,shared}, infra/ | 確定 |
| T-7 | Google同期 | Cloud Scheduler毎時ポーリング + syncToken差分同期。refresh tokenはDB保存+アプリ層AES-256-GCM暗号化（鍵はSecret Manager）。スコープはcalendar.readonlyのみ | 確定 |
| T-8 | CI/CD | GitHub Actions + Workload Identity Federation。main→stg自動、prod手動承認で同一イメージをプロモート。Terraformはplan on PR / apply on merge | 確定 |

### 3.2 仕様決定（S-1〜S-7）要点のみ

- S-1 子どもプロフィール昇格: **対応する**。Member（プロフィール）とUserAccount（Googleログイン主体）を分離、Member.userAccountIdはnullable。招待リンク経由で既存プロフィールに後から紐づけ可能
- S-2 招待リンク: 256bitトークン（DBにはハッシュ保存）、有効期限7日、回数無制限、家族ごと同時有効1本（再発行で旧失効）、参加時に全員へ通知
- S-3 メンバー削除: 論理削除。過去予定は保持（「(削除済み)名前」表示）、未来予定は対象から外し、唯一の担当者だった予定は「担当者未定」に戻す
- S-4 TZ: MVPはAsia/Tokyo固定。ただしeventにtimezoneカラムは持つ。終日予定はdate型でTZ非依存。RRULE展開はローカル時刻→UTC変換
- S-5 過去予定サジェスト: 部分一致（前方一致優先）、家族全員の予定、直近1年、最大5件、同一タイトル集約。時刻・対象・担当・場所を引き継ぎ、**メモと繰り返し設定は引き継がない**
- S-6 通知粒度: MVPはユーザーごと2トグルのみ（変更通知/リマインダー）。Google同期起因・買い物リスト操作は通知しない
- S-7 複数家族: MVPは1ユーザー1家族（部分UNIQUE制約で強制）。スキーマはMember経由の間接参照で将来の複数所属に対応可能な形

### 3.3 ドメインモデル要点

- 集約ルート: Family（Member・Invitation含む）/ Event / ShoppingList / GoogleCalendarLink / UserAccount。全クエリがfamilyId必須でテナント分離
- 繰り返し予定: マスタ+RRULE文字列+例外テーブル（event_override）、**表示時展開**（Google方式）。「これ以降すべて」はマスタ分割（旧にUNTIL設定+新マスタ作成）
- 担当者はMVPでは単数（event.assignee_member_id, NULL=担当者未定）
- Googleインポート予定はimported_eventとして別テーブル（singleEvents=trueで展開済み取得、自前RRULE展開を持ち込まない）

### 3.4 運用（O-1〜O-5）要点

- 環境: devはローカルdocker compose、stg/prodはGCPプロジェクト分離。Terraformは modules/ + envs/{stg,prod}
- 監視: Sentry前後段（予定タイトル等の個人情報は送らない）+ Cloud Monitoring最小アラート（5xx率、SQLディスク、Schedulerジョブ失敗）
- バックアップ: Cloud SQL日次+PITR 7日、prodは月次pg_dump→GCS 12ヶ月
- テスト: domain層ユニット必須（RRULE展開・TZ境界を重点）、application層はTestcontainers統合、E2EはPlaywright2本のみ
- 成功指標: 自分の家族で2週間、紙/TimeTreeに戻らず運用できたらMVP完了（補助定量指標あり）

---

## 4. 実施タスク: plainer構成の抽出（R-1〜R-4）

コードの変更・コミットは不要。実際のディレクトリ・ファイルパスを根拠として引用しながらMarkdownレポートにまとめること。不明・該当なしは推測せず「該当なし」と明記。

### R-1 フロントエンドのpage単位ディレクトリ構成（plainer-backendのfront）
- フレームワークとバージョン（Next.js/Vite等、ルーティング方式）
- page単位ディレクトリの具体ルール: 命名規則、1つのpage配下に何を置くか（コンポーネント/hooks/API呼び出し/型/テストの配置）
- 共通コンポーネント・共通hooksの置き場所と、page配下との使い分け基準
- 状態管理・データフェッチの方式とAPIクライアントの生成方法
- スタイリング方式

### R-2 バックエンドのDDDレイヤ構成（plainer-backend）
- フレームワークとAPI形式（REST/tRPC/GraphQL）
- domain / application / infrastructure / presentation の実際のディレクトリ分けと依存方向ルール
- リポジトリパターン: インターフェースの置き場所、実装の置き場所、DIの方法
- ユースケースの粒度と実装単位（1ユースケース1クラスか、サービスクラスか）、命名規則
- ORMとマイグレーション管理
- ドメイン層テストの書き方（実例を1つ引用）

### R-3 フィーチャーフラグのアーキテクチャ
- 注意: `plainer-featureflag` という単独リポジトリは存在しない模様。plainer-backend内（なければ plainer-microservices）を "featureflag" / "feature_flag" / "flag" で検索して実装を探す
- フラグの保存先（DB/設定ファイル/外部サービス）、評価タイミング（サーバ/クライアント）、配信方式、SDK・ヘルパー構成
- フラグの追加〜削除のライフサイクル運用があれば

### R-4 Terraform構成（plainer-infrastructureがソースにあれば）
- モジュール分割の単位（cloud-run/cloud-sql/scheduler等の切り方）
- 環境分離の方法（ディレクトリ/workspace/tfvars）
- state管理（backend構成）とCIからのplan/apply方式
- Secret管理の方式

## 5. 抽出後にやること（このセッション内で続けて実施）

1. **T-3/T-4/T-5の確定**: §3.1の暫定決定をplainerの実態と突き合わせ、「plainerに合わせる」か「iegoto単体最適を貫く」かを理由付きで判定。判断基準: 開発者は同一人物なので開発体験の一貫性に価値がある。ただしplainer側がiegotoの要件（SSE、PWA、RRULE、tRPC適性）に合わない構成なら無理に合わせない
2. **フロントエンド設計書のドラフト作成**: R-1のルールをiegotoのページ構成（today / calendar / event編集 / shopping / settings / invite）に適用したディレクトリ設計
3. **バックエンド設計書のドラフト作成**: R-2のレイヤ規約をiegotoに適用。リポジトリIFの置き場所・ユースケース実装単位・命名規則を確定（§3.3のユースケース一覧が対象: signUpFamily / joinFamilyByInvitation / createEvent / updateEvent(編集スコープ3択) / listEventsInRange / suggestPastEvents / syncGoogleCalendar / dispatchReminders 等）
4. **フィーチャーフラグ組み込み方針**: R-3の方式をiegotoにどう載せるか（MVPでの用途例: 新機能の段階公開、家族単位での有効化）
5. **インフラ構成の当たり**: R-4を踏まえた infra/modules の分割案
6. 成果物一式（抽出レポート+更新版設計書）をMarkdownでチャットに出力（iegotoリポジトリへ持ち帰り、`docs/design/` 配下に反映される）
