# iegoto フィーチャーフラグ方針

作成日: 2026-07-17
ステータス: 決定案（R-3で抽出したplainer-feature-flagの運用規律を縮小移植）
関連: `05-plainer-extraction-report.md` R-3 / `docs/requirements.md` §8

---

## 0. 方針: 「運用規律は移植、配管は持ち込まない」

plainerのフラグ基盤（GCS + Cloud Functions v2 + API Gateway + backend側DB同期ジョブ）の複雑さの大半は、
フラグ基盤とbackendが**別GCPプロジェクト**でIAM/ID Token/Gateway越境認証する商用SaaS要件に由来する（R-3）。
Cloud Run 1サービスのiegotoにこの配管を持ち込む理由はない。

| plainerの要素 | iegoto | 判断 |
|---|---|---|
| フラグ定義をGit管理・PRレビュー | **採用** | `flags/{stg,prd}/feature-flags.json` |
| JSON Schema検証 + CI | **採用**（zodで簡略化） | 重複・命名・必須フィールドをCIで検証 |
| `cleanupBy`（削除見積もり日付）棚卸し | **採用**（Slack→GitHub Issueに変更） | 消し忘れ防止はフラグ運用の本体 |
| `deleted-flags.json`（名前再利用禁止） | **採用** | 削除理由の記録ごと移植 |
| fail-closed / fail-open の2評価モード | **採用**（概念のみ） | `isEnabled`（未知→false）/ `isEnabledOrDefaultTrue`（未知→true） |
| GCS / Cloud Functions / API Gateway 配信 | 不採用 | フラグはアプリにバンドルして配布 |
| backend側のDB同期ジョブ + feature_flagsテーブル | 不採用 | 配信元=自分自身のため冗長化が不要 |
| 3環境×クロスプロジェクトIAM/WIF | 不採用 | クラウド環境はprodのみ（O-1）、同一リポジトリ内 |

## 1. フラグ定義

モノレポ直下 `flags/` に置く（plainerのスキーマから`cleanupBy`まで踏襲。環境はprodのみ=単一セットで、
ローカル開発も同じファイルを読む。O-1）:

```
flags/
├── feature-flags.json
└── deleted-flags.json
```

```json
{
  "version": "1.0.0",
  "flags": [
    {
      "name": "enable-google-calendar-sync",
      "description": "F-07 Googleカレンダー同期の段階公開",
      "defaultValue": false,
      "cleanupBy": "2026-12-31",
      "enabledFamilyIds": []
    }
  ]
}
```

- フィールド: `name`（`^[a-z0-9][a-z0-9-]*[a-z0-9]$`、3〜64文字）/ `description` / `defaultValue` /
  `cleanupBy`（`YYYY-MM-DD`必須。**削除見積もり日付であり有効期限ではない**）— ここまでplainerと同一
- iegoto独自の追加: `enabledFamilyIds`（任意）。`defaultValue: false`のフラグを**特定の家族だけ先行有効化**する
  （MVPでの用途: 自分の家族でのドッグフーディング → 全体公開）。評価は
  `enabledFamilyIds.includes(familyId) || defaultValue`
- 恒久フラグ（killswitch等）は`cleanupBy: "2099-12-31"`で棚卸し対象から除外（plainer運用踏襲)
- スキーマ・評価ロジックはzodで`packages/feature-flags`に定義し、CI検証スクリプト（`scripts/validate-flags.ts`）とAPIの実行時ロード・評価ヘルパー（§2）で共用する

## 2. 配信・評価

**フラグJSONはビルド時にAPIサーバへバンドルし、起動時にzodでparseしてプロセス内に保持する。**
フラグ変更の反映 = mainマージ → 通常のデプロイ（T-8）。専用の配信インフラを持たない。

- 評価は**サーバサイドのみ**を正とする:
  - `flags.isEnabled(name, familyId)` — 未知のフラグ名は`false`（fail-closed。既定はこちら）
  - `flags.isEnabledOrDefaultTrue(name, familyId)` — 未知は`true`（fail-open。既存動作を段階的に
    フラグ配下へ入れる時のデプロイ順序問題にだけ使う）
- フロントへは`featureFlags.list` tRPC query（familyId解決済みの評価結果`Record<string, boolean>`）で渡す。
  フロントは取得中・エラー時`false`（fail-closed。plainer front踏襲）
- デプロイ即反映が必要な緊急killswitchが将来必要になったら、その時点で「環境変数によるオーバーライド」
  （`FLAG_OVERRIDE_<name>=true|false`）を足す。GCS外部化はそれでも足りない場合の最終手段

## 3. CI・ライフサイクル

- **検証（PR時）**: `scripts/validate-flags.ts` — ①zodスキーマ検証 ②フラグ名重複 ③`deleted-flags.json`の
  名前再利用チェック ④feature-flags.jsonから消えたのにdeleted-flags.json未登録の検出（plainerのCI 4点セット）
- **棚卸し（週次）**: GitHub Actions cron（週1）が`cleanupBy`超過フラグを検出し、**GitHub Issueを起票**
  （既存Issueがあればスキップ。plainerのSlack通知の個人開発版）
- **削除フロー**: feature-flags.jsonから削除 + deleted-flags.jsonに理由つきで追記（同一PR）。
  コード側の分岐削除も同一PRで行う
- 段階公開の標準手順: `defaultValue: false` + `enabledFamilyIds: [自家族]`で投入 → 検証後
  `defaultValue: true`に変更 → 安定後フラグ削除（`cleanupBy`が削除の締切目安）
