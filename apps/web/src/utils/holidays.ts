import { holidays } from '@holiday-jp/holiday_jp'

/**
 * 日本の祝日 (F-02)。@holiday-jp/holiday_jp のデータ (内閣府CSV由来、1970〜2050) を
 * ビルド時バンドルし、日付キー (YYYY-MM-DD) から祝日名を引く
 */
// holidays の型は全日付キーのリテラルの巨大な Record のため、string で引ける形に緩める
const holidayByDate: Partial<Record<string, { name: string }>> = holidays

export function holidayName(dateKey: string): string | null {
  return holidayByDate[dateKey]?.name ?? null
}
