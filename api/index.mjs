// Vercel Functions エントリ (コミット必須: Vercel はビルド開始時のファイルで関数を検出する)。
// 実体は buildCommand 中に scripts/build-vercel-function.mjs が生成する単一バンドル。
//
// Vercel の Node ランタイムはこの関数を旧来の (req, res) 形式で呼び出す
// (.vc-config.json: shouldAddHelpers=true)。バンドル内の Hono ハンドラは
// Web 標準 (Request → Response) のため、ここで双方向の変換を行う。
// 将来 Web ハンドラとして呼ばれても動くよう両形式に対応する
import { Buffer } from 'node:buffer'
import bundle from './_bundle.cjs'

const webHandler = bundle.default

function toWebRequest(req) {
  const proto = req.headers['x-forwarded-proto'] ?? 'https'
  const host = req.headers['x-forwarded-host'] ?? req.headers.host ?? 'localhost'
  const url = `${proto}://${host}${req.url}`

  const headers = new Headers()
  for (const [key, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) {
      for (const v of value) headers.append(key, v)
    } else if (value !== undefined) {
      headers.set(key, value)
    }
  }

  const method = req.method ?? 'GET'
  let body
  if (method !== 'GET' && method !== 'HEAD') {
    // Vercel の helpers がボディを消費済み (req.body) の場合はそこから復元する
    if (req.body !== undefined && req.body !== null) {
      body =
        typeof req.body === 'string'
          ? req.body
          : Buffer.isBuffer(req.body)
            ? req.body
            : JSON.stringify(req.body)
    }
  }
  return new Request(url, { method, headers, body })
}

async function writeWebResponse(res, response) {
  res.statusCode = response.status
  for (const [key, value] of response.headers.entries()) {
    if (key !== 'set-cookie') {
      res.setHeader(key, value)
    }
  }
  // set-cookie は複数ヘッダとして個別に送る必要がある (セッション発行で必須)
  const setCookies = response.headers.getSetCookie()
  if (setCookies.length > 0) {
    res.setHeader('set-cookie', setCookies)
  }
  const buf = Buffer.from(await response.arrayBuffer())
  res.end(buf)
}

export default async function handler(req, res) {
  // Web ハンドラとして呼ばれた場合 (Request が直接渡る)
  if (typeof Request !== 'undefined' && req instanceof Request) {
    return webHandler(req)
  }
  // Node 形式 (req, res)
  const response = await webHandler(toWebRequest(req))
  await writeWebResponse(res, response)
}
