# iegoto バックエンド設計書

作成日: 2026-07-17
ステータス: 決定案（R-2で抽出したplainer-backendの構造規約をTypeScript/Hono/tRPCに翻訳して適用）
関連: `02-tech-selection.md` T-1/T-2/T-3/T-5 / `03-domain-model.md` / `05-plainer-extraction-report.md` R-2

---

## 0. 方針

plainer-backend（Kotlin/Ktor）から移植するのは**構造規約**であり、実装技術ではない。
plainerはDDD標準4層と厳密一致しない独自マッピング（`route/`にUseCase同居、`service/`が別枠）を
採っているが、iegotoはこの曖昧さを持ち込まず**DDD標準の層名に正規化**し、対応表で規約を引き継ぐ（R-2注意点4）。

| plainer | iegoto | 層 |
|---|---|---|
| `route/`（Router部分） | `apps/api/src/modules/{domain}/router.ts` | presentation |
| `route/`（UseCase部分）・`service/` | `apps/api/src/modules/{domain}/usecases/` | application |
| `repository/` | `packages/db/src/repositories/` | infrastructure |
| `domain/` | `packages/domain/src/{domain}/` | domain |
| `config/` | `apps/api/src/config/` | infrastructure(設定) |
| `shared/` | `packages/shared/` | 共有カーネル |

依存方向: `presentation → application → domain` / `infrastructure → domain`。
domainはどのパッケージにも依存しない（Prisma型もimportしない）。強制はESLint/Biomeの
import制限ルール + pnpm workspaceのパッケージ境界（`packages/domain`が`packages/db`に依存しないことは
package.jsonの依存関係で物理的に強制される）。

## 1. ディレクトリ構成

```
apps/api/src/
├── main.ts                        # Honoアプリ組み立て・tRPCアダプタ・起動
├── trpc.ts                        # initTRPC・Context生成・認証/テナントmiddleware
├── auth/                          # Google OAuth code flow・セッションクッキー（T-4で決定）
├── sse/                           # 家族単位SSEストリーム（T-2。tRPC外のHono直ルート）
├── jobs/                          # Scheduler起点のHTTPエンドポイント（plainerのroute/job/相当）
│   ├── sync-google-calendar.ts    #   OIDCトークン検証つき（Scheduler→Cloud Run）
│   └── dispatch-reminders.ts
├── modules/                       # ドメイン別。tRPC routerとusecaseをco-location（plainer方式）
│   ├── family/
│   │   ├── router.ts              # procedureの束。薄いadapterのみ
│   │   └── usecases/
│   │       ├── sign-up-family.ts
│   │       ├── join-family-by-invitation.ts
│   │       ├── issue-invitation.ts
│   │       └── ...
│   ├── member/
│   ├── event/
│   │   └── usecases/              # create-event / update-event / list-events-in-range /
│   │                              # suggest-past-events / list-unassigned-events ...
│   ├── shopping/
│   ├── google-calendar/
│   └── notification/
└── config/                        # 環境変数の型付きロード（zodでparse、起動時fail-fast）

packages/domain/src/
├── family/                        # Family・Member・Invitation（エンティティ・VO・ドメインサービス）
├── event/                         # Event・EventOverride・RRULE展開・マスタ分割ロジック
├── shopping/
├── google-calendar/
├── notification/
└── shared/                        # Id<T>（branded type）・FamilyId等の共通VO

packages/db/
├── prisma/schema.prisma           # スキーマ・マイグレーション
└── src/
    ├── client.ts                  # PrismaClient生成
    ├── mappers/                   # Prisma行 ↔ domainエンティティ変換
    └── repositories/              # 1集約 = 1 Repository（具象のみ）
```

## 2. リポジトリパターン（03-domain-model.md §5の未決事項①②を確定）

**決定: plainerに合わせ、interfaceと実装の分離はしない。具象Repositoryクラスのみを`packages/db`に置く。**

- plainerは全Repositoryが具象クラス直（interface 0件）で運用が成立している（R-2）。個人開発規模で
  抽象化の恩恵（実装差し替え）は発生しないため、iegotoも同じ割り切りを採る
- 「リポジトリIFはdomain層に置くべき」というDDD教義より、**domainがdb実装に依存しない**ことだけを守る:
  Repositoryのメソッドは引数・戻り値ともに`packages/domain`のエンティティ/VOを使い、Prisma型を漏らさない
  （変換は`mappers/`に集約）
- **1集約 = 1 Repository**: `FamilyRepository`（Member・Invitation含む）/ `EventRepository`（EventTarget・
  EventOverride含む）/ `ShoppingListRepository` / `GoogleCalendarLinkRepository`（ImportedEvent含む）/
  `UserAccountRepository`（PushSubscription・NotificationSetting含む）

### テナントスコープの型レベル強制（plainerより一段強くする。R-2注意点3）

plainerはスコープ引数がオプショナルで、渡し忘れを規約+CIスキャン（/idor-detector相当）で検知している。
iegotoはTSの型で構造的に防ぐ:

```ts
// packages/domain/src/shared/id.ts — branded type（plainerのId<T>相当）
export type Id<T extends string> = string & { readonly __brand: T }
export type FamilyId = Id<'Family'>

// packages/db/src/repositories/event-repository.ts
export class EventRepository {
  constructor(private readonly tx: PrismaTx) {}

  // familyId は必須第一引数。オプショナルにしない
  async find(familyId: FamilyId, id: EventId): Promise<Event | null> { ... }
  async listMastersInRange(familyId: FamilyId, range: DateTimeRange): Promise<Event[]> { ... }
}
```

- **全publicメソッドの第一引数を`familyId: FamilyId`にする**（家族非依存の`UserAccountRepository`のみ例外）。
  WHERE句には常に`family_id`を含める
- 二層防御（plainerのRouter層/UseCase層防御の翻訳）:
  1. tRPC middleware（`familyProcedure`）がセッションから`familyId`・`memberId`を解決して`ctx`に載せる。
     未所属ならここで拒否
  2. UseCaseは`ctx.familyId`をRepositoryに必ず渡す（型が必須引数なので渡し忘れはコンパイルエラー）
- CIの追加ガード: `repositories/`内で`prisma.<model>.find*`を直接呼ぶ際に`family_id`条件が無いものを
  grepで検知するスクリプトを用意（Prismaはクエリビルダを文字列検査しづらいので、レビュー観点として
  `docs/`にチェックリスト化する程度に留め、主防御は型とする）

## 3. ユースケース（03-domain-model.md §5の未決事項③を確定)

**決定: 1ユースケース = 1ファイル = 1 exported関数。命名は`<動詞句>`のcamelCase、ファイルはkebab-case。**

- plainerの「1 UseCase 1クラス（object）、publicは`process()`のみ」のTS翻訳。TSにobjectシングルトンは
  不要なので、名前付きexportの関数1つに簡約する
- plainer自身にも`prepare()/export()`の2メソッド例があるため（R-2）、規約は「原則1エントリポイント関数。
  正当な理由があれば同一ファイル内に補助exportを許す」とする
- 粒度は`03-domain-model.md` §4のユースケース一覧と1:1（signUpFamily / createEvent / updateEvent / ...）

```ts
// apps/api/src/modules/event/usecases/create-event.ts
export async function createEvent(ctx: FamilyContext, input: CreateEventInput): Promise<CreateEventOutput> {
  const event = Event.create({ ... })           // 業務ルールはdomain層（packages/domain）
  await ctx.db.$transaction(async (tx) => {     // トランザクション境界はUseCase
    await new EventRepository(tx).save(ctx.familyId, event)
    await enqueueChangeNotification(tx, ctx, event)   // S-6/F-08
  })
  await notifyFamilyChanged(ctx.familyId, { type: 'event', id: event.id })  // NOTIFY（T-2）
  return toOutput(event)
}
```

- **Routerは薄いadapterのみ**（plainerのApiPageRouter方式）: zodでinput検証 → `ctx`確認 → usecase呼び出し → 返却。
  ロジック・クエリをprocedure内に書かない

```ts
// apps/api/src/modules/event/router.ts
export const eventRouter = router({
  create: familyProcedure.input(createEventInput).mutation(({ ctx, input }) => createEvent(ctx, input)),
  listInRange: familyProcedure.input(rangeInput).query(({ ctx, input }) => listEventsInRange(ctx, input)),
})
```

## 4. DI・Context（R-2注意点2の採用）

plainerの「グローバルDSLContext + トップレベルファクトリ関数」はKotlinのfork分離前提の設計で、
Node（シングルプロセス・非同期並行）に素朴に移植するとテスト分離で事故る。iegotoは
**リクエストスコープのContextに明示的に載せて受け渡す**:

- `createContext`（tRPCアダプタ）: セッションクッキー復号 → `{ db, session }` を生成
- `familyProcedure` middleware: `session.userAccountId` → member/family解決 → `FamilyContext`
  （`{ db, familyId, memberId, userAccountId }`）に絞り込む
- UseCaseは`ctx`経由でのみdb・テナント情報にアクセス。グローバルなclient参照を作らない
- DIコンテナ（InversifyJS等）は導入しない（plainer同様の手動DI。規模に対して過剰）

## 5. バリデーションの役割分担

| 層 | 責務 | 実装 |
|---|---|---|
| presentation | 入力の形式検証（型・必須・文字数・enum） | zod（tRPC input） |
| domain | 業務ルール（終了>開始、RRULE妥当性、招待期限、担当者がfamily所属メンバーか等） | エンティティのファクトリ/メソッド内で検証しthrow |
| infrastructure | 一意制約等の最終防衛 | DB制約（部分UNIQUE等。03-domain-model.md） |

- domainのエラーは`DomainError`階層（`InvitationExpiredError`等）で表現し、tRPCの`errorFormatter`で
  コード変換。plainerの`ApiError`統一に相当する役割はtRPCのエラー型が担う
- UseCaseのOutput型は明示的に定義する（Prismaの戻り値型をそのまま返さない。plainerの
  `@Serializable` Output必須規約の趣旨=「境界の型を明示する」の翻訳）

## 6. マイグレーション運用

- Prisma Migrate。マイグレーション名はplainerのFlyway規約に倣い`snake_case`の説明的な名前
  （Prismaが自動でUTCタイムスタンプを付与するため、plainerの`V{YYYYMMDDHHmmss}`要件は自動的に満たされる）
- 新規テーブル・カラムにはschema.prismaの`///`コメントで説明を残す（plainerの`COMMENT ON`規約相当）
- ロールバックは前方修正（新しいマイグレーションで戻す）を原則とする

## 7. テスト（O-4の具体化）

| 対象 | 方式 | plainerからの移植点 |
|---|---|---|
| `packages/domain` | Vitest純粋ユニット。DB・ネットワーク依存なし | Kotestの`FunSpec`構造は`describe`/`test`に対応。「ファクトリ`new()`で生成→性質を検証」のスタイル、RRULE展開・マスタ分割・TZ境界のテーブル駆動網羅 |
| `apps/api`（usecase） | Testcontainers（実Postgres）で統合テスト | familyId越境アクセスの拒否テストを必須化（plainerのIDOR防御テストの趣旨） |
| Repository | usecase統合テストで兼ねる。複雑なクエリ（期間検索・サジェスト集約）のみ単体で追加 | — |

- 越境テストの定型: 「family Aのデータをfamily BのContextで取得→nullまたは拒否」を全集約に対して用意する
