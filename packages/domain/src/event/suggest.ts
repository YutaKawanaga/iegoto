/**
 * 過去予定サジェスト (S-5)。
 * 部分一致 (前方一致優先)・同一タイトル集約・最大5件はここの純粋ロジックで、
 * 候補の絞り込み (家族全員・直近1年) は repository のクエリ側で行う
 */

export const SUGGEST_MAX = 5

/** サジェスト照合用のタイトル正規化。event.normalized_title に保存する */
export function normalizeTitle(title: string): string {
  return title.normalize('NFKC').toLowerCase().trim().replace(/\s+/g, ' ')
}

export type SuggestCandidate<T> = {
  normalizedTitle: string
  /** 直近に使われた日時 (同一タイトル集約時は最新を残す) */
  lastUsedAt: Date
  payload: T
}

/**
 * 入力に対して候補を並べ替えて上位を返す。
 * 前方一致 > 部分一致、同順位内は新しい順。同一 normalizedTitle は最新の1件に集約
 */
export function rankSuggestions<T>(
  input: string,
  candidates: SuggestCandidate<T>[],
  max: number = SUGGEST_MAX,
): T[] {
  const q = normalizeTitle(input)
  if (q.length === 0) {
    return []
  }
  const dedup = new Map<string, SuggestCandidate<T>>()
  for (const c of candidates) {
    const existing = dedup.get(c.normalizedTitle)
    if (existing === undefined || existing.lastUsedAt.getTime() < c.lastUsedAt.getTime()) {
      dedup.set(c.normalizedTitle, c)
    }
  }
  const matched = [...dedup.values()]
    .map((c) => ({
      c,
      rank: c.normalizedTitle.startsWith(q) ? 0 : c.normalizedTitle.includes(q) ? 1 : 2,
    }))
    .filter((x) => x.rank < 2)
  matched.sort(
    (a, b) => a.rank - b.rank || b.c.lastUsedAt.getTime() - a.c.lastUsedAt.getTime(),
  )
  return matched.slice(0, max).map((x) => x.c.payload)
}
