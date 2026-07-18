# iegoto（家ごと）

家族の予定・買い物・分担など「家の共有事」をまるごと集める、家族専用のWebカレンダー。

## ドキュメント

| ドキュメント | 内容 |
|---|---|
| [要件定義書 v1.2](docs/requirements.md) | プロダクト要件（機能・非機能・スコープ・決定事項ログ） |
| [仕様決定書](docs/design/01-spec-decisions.md) | §10.3 S-1〜S-7（プロフィール昇格・招待リンク・メンバー削除・TZ・サジェスト・通知粒度・複数家族） |
| [技術選定書](docs/design/02-tech-selection.md) | §10.2 T-1〜T-8（DB・リアルタイム・API・FW・モノレポ・Google同期・CI/CD） |
| [ドメインモデル設計書](docs/design/03-domain-model.md) | 集約・テーブル定義・繰り返し予定の設計・ユースケース一覧 |
| [運用・品質方針](docs/design/04-operations.md) | §10.4 O-1〜O-5(環境・監視・バックアップ・テスト・成功指標) |
| [plainer構成抽出レポート](docs/design/05-plainer-extraction-report.md) | R-1〜R-4（plainer 3リポジトリの構成調査結果と適用判断） |
| [フロントエンド設計書](docs/design/06-frontend-design.md) | Vite+React SPA・ディレクトリ規約・PWA/Web Push設計 |
| [バックエンド設計書](docs/design/07-backend-design.md) | DDDレイヤ構成・Repository/UseCase規約・テナント分離 |
| [フィーチャーフラグ方針](docs/design/08-feature-flag.md) | フラグ定義・配信・評価・ライフサイクル運用 |
| [実装順序](docs/design/09-implementation-order.md) | MVP到達までのフェーズ分け（iOS Pushスパイク・家族投入タイミング含む） |

## ステータス

要件確定・**設計確定**（実装未着手）。plainerリポジトリ参照タスク（R-1〜R-4）は完了し、
技術選定（T-1〜T-8）は全項目確定。次フェーズはモノレポ雛形の実装。
