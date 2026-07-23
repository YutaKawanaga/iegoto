/**
 * 月表示の複数日予定バーのレイアウト計算 (F-02)。
 * 複数日にまたがる予定を日毎の個別チップではなく、週の行を横断する連続バーとして
 * 描画するための「週内セグメント + レーン割り当て」を純関数で求める
 */

export type MultiDayItem = {
  /** occurrence を一意に識別するキー (eventId + originalStartAt) */
  key: string
  /** 期間の開始日 (YYYY-MM-DD) */
  startKey: string
  /** 期間の終了日 (YYYY-MM-DD, inclusive) */
  endKey: string
}

export type WeekSegment = {
  key: string
  /** 週内の開始列 (0-6) */
  startIdx: number
  /** 週内の終了列 (0-6, inclusive) */
  endIdx: number
  /** 前の週から続いている (左端を角丸にしない) */
  continuesLeft: boolean
  /** 次の週へ続いていく (右端を角丸にしない) */
  continuesRight: boolean
  /** 縦の段 (0 が最上段)。同週で重なる予定は別レーンに積む */
  lane: number
}

/**
 * 1週 (7日分の dateKey 昇順) に対して、各複数日予定のセグメントとレーンを計算する。
 * レーンは「開始が早い順 → 長い順」の貪欲割り当てで、空いている最小レーンに置く
 */
export function layoutWeekSegments(weekKeys: string[], items: MultiDayItem[]): WeekSegment[] {
  const first = weekKeys[0]
  const last = weekKeys[weekKeys.length - 1]
  if (first === undefined || last === undefined) {
    return []
  }

  const overlapping = items
    .filter((item) => item.startKey <= last && item.endKey >= first)
    .map((item) => {
      const startIdx = item.startKey < first ? 0 : weekKeys.indexOf(item.startKey)
      const endIdx = item.endKey > last ? weekKeys.length - 1 : weekKeys.indexOf(item.endKey)
      return {
        key: item.key,
        startIdx,
        endIdx,
        continuesLeft: item.startKey < first,
        continuesRight: item.endKey > last,
      }
    })
    .filter((seg) => seg.startIdx >= 0 && seg.endIdx >= seg.startIdx)
    .sort((a, b) => a.startIdx - b.startIdx || b.endIdx - a.endIdx || a.key.localeCompare(b.key))

  // レーン割り当て: 各レーンの「最後に使った列」を追跡し、重ならない最小レーンへ
  const laneEnds: number[] = []
  return overlapping.map((seg) => {
    let lane = laneEnds.findIndex((end) => end < seg.startIdx)
    if (lane === -1) {
      lane = laneEnds.length
      laneEnds.push(seg.endIdx)
    } else {
      laneEnds[lane] = seg.endIdx
    }
    return { ...seg, lane }
  })
}

/** 週内で使われるレーン数 (表示上限 cap で切る) */
export function laneCount(segments: WeekSegment[], cap: number): number {
  let max = 0
  for (const seg of segments) {
    if (seg.lane + 1 > max) {
      max = seg.lane + 1
    }
  }
  return Math.min(max, cap)
}
