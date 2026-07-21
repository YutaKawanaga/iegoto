// Vercel Functions エントリ (コミット必須: Vercel はビルド開始時のファイルで関数を検出する)。
// 実体は buildCommand 中に scripts/build-vercel-function.mjs が生成する単一バンドル
module.exports = require('./_bundle.cjs')
