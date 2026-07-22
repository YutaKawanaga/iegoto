/**
 * アプリロゴ「巣箱と鳥の家族」(巣箱=家=iegoto、鳥=家族)。
 * アプリアイコン (public/favicon.svg) と同一モチーフの白背景向け配色版。
 * 鳥の色はメンバーカラー (coral / sky / amber) と揃えている
 */
export function AppLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="86 76 340 340" className={className} role="img" aria-label="iegoto" fill="none">
      {/* 巣箱: 屋根 + 本体 + 入り口 */}
      <path
        d="M136 222 L256 114 L376 222"
        stroke="#0d9488"
        strokeWidth="44"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="158" y="206" width="196" height="196" rx="30" fill="#0d9488" />
      <circle cx="256" cy="282" r="46" fill="#ffffff" />
      {/* ヒナ (入り口から顔を出す) */}
      <circle cx="256" cy="298" r="30" fill="#fbbf24" />
      <path d="M280 292 L298 300 L280 308 Z" fill="#f97316" />
      <circle cx="266" cy="290" r="5.5" fill="#ffffff" />
      <circle cx="268" cy="290" r="2.6" fill="#1e293b" />
      {/* 親鳥 (コーラル / 左) */}
      <path d="M118 130 L92 116 L99 143 Z" fill="#f87171" />
      <circle cx="150" cy="134" r="34" fill="#f87171" />
      <circle cx="143.88" cy="140.12" r="15.3" fill="#fca5a5" />
      <path d="M178 125 L203 135 L178 145 Z" fill="#f59e0b" />
      <circle cx="164.28" cy="123.8" r="5.78" fill="#ffffff" />
      <circle cx="166.32" cy="123.8" r="2.72" fill="#1e293b" />
      {/* 親鳥 (スカイ / 右) */}
      <path d="M394 130 L420 116 L413 143 Z" fill="#38bdf8" />
      <circle cx="362" cy="134" r="34" fill="#38bdf8" />
      <circle cx="368.12" cy="140.12" r="15.3" fill="#7dd3fc" />
      <path d="M334 125 L309 135 L334 145 Z" fill="#f59e0b" />
      <circle cx="347.72" cy="123.8" r="5.78" fill="#ffffff" />
      <circle cx="345.68" cy="123.8" r="2.72" fill="#1e293b" />
    </svg>
  )
}
