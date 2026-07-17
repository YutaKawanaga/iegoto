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

## ステータス

要件確定・設計中。plainerリポジトリ参照タスク（R-1〜R-4）が未着手のため、
技術選定の一部（T-3/T-4/T-5）は暫定。詳細は[技術選定書 §0](docs/design/02-tech-selection.md)を参照。
