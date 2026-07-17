# plainer構成抽出タスク（R-1〜R-4）実施用プロンプト

要件定義書 §10.1 のplainer参照タスクを別セッションで実施するための指示書。

**使い方**: claude.ai/code で `learningsales/plainer-backend`（R-4は `learningsales/plainer-infrastructure` も）をソースにしたセッションを開始し、下記プロンプトをそのまま貼る。出力されたレポートをiegoto側のセッションに持ち帰り、`02-tech-selection.md` ほか各設計書の暫定項目（T-3/T-4/T-5等）を確定させる。

---

## 貼り付け用プロンプト

```
このリポジトリの構成を調査し、別プロダクト（iegoto: 家族向け共有カレンダーWebアプリ、TSモノレポ・DDD・Cloud Run想定）の設計に流用するための抽出レポートをMarkdownで出力してください。コードの変更・コミットは不要です。以下の4点を、実際のディレクトリ・ファイルパスを根拠として引用しながらまとめてください。

## R-1 フロントエンドのpage単位ディレクトリ構成
- フロントエンドのフレームワークとバージョン（Next.js/Vite等、ルーティング方式）
- page単位ディレクトリの具体ルール: 命名規則、1つのpage配下に何を置くか（コンポーネント/hooks/API呼び出し/型/テストの配置）
- 共通コンポーネント・共通hooksの置き場所と、page配下との使い分け基準
- 状態管理・データフェッチの方式（TanStack Query等）とAPIクライアントの生成方法
- スタイリング方式（Tailwind/CSS Modules等）

## R-2 バックエンドのDDDレイヤ構成
- フレームワーク（NestJS/Hono/Express等）とAPI形式（REST/tRPC/GraphQL）
- domain / application / infrastructure / presentation の実際のディレクトリ分けと依存方向のルール
- リポジトリパターンの実装: インターフェースの置き場所（domain層か否か）、実装の置き場所、DIの方法
- ユースケースの粒度と実装単位（1ユースケース1クラスか、サービスクラスか）、命名規則
- ORMとマイグレーション管理の方式
- ドメイン層のテストの書き方（実例を1つ引用）

## R-3 フィーチャーフラグのアーキテクチャ
- このリポジトリ（見つからなければ learningsales/plainer-microservices）内のフィーチャーフラグ実装を探す（"feature flag" / "featureflag" / "flag" で検索）
- フラグの保存先（DB/設定ファイル/外部サービス）、評価タイミング（サーバ/クライアント/両方）、配信方式、SDK・ヘルパーの構成
- フラグの追加〜削除のライフサイクル運用があれば

## R-4 Terraform構成（plainer-infrastructureがソースにあれば）
- モジュール分割の単位（cloud-run/cloud-sql/scheduler等がどう切られているか）
- 環境（stg/prod等）の分離方法（ディレクトリ/workspace/tfvars）
- state管理（backendの構成）とCIからのplan/apply方式
- Secret管理の方式（Secret Manager/KMS等）

## 出力形式
- 見出しはR-1〜R-4のまま
- 各項目、事実（パス引用つき）と、iegotoに流用する際の注意点を分けて記載
- 不明・該当なしの項目は推測せず「該当なし」と明記
```

---

## 持ち帰り後の反映先

| タスク | 反映先 | 影響する暫定決定 |
|---|---|---|
| R-1 | フロントエンド設計書（新規作成） | T-4（Next.js暫定） |
| R-2 | `03-domain-model.md` §5、バックエンド設計書 | T-3（tRPC暫定）/ T-5（Hono暫定）/ T-1のORM |
| R-3 | 共通設計書（フィーチャーフラグ節を新規作成） | — |
| R-4 | `04-operations.md` O-1、インフラ設計書 | infra/ディレクトリ構成 |
