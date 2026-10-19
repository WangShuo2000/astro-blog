import fs from 'node:fs/promises'
import http from 'node:http'
import path from 'node:path'
import { gzipSync } from 'node:zlib'
const root = path.resolve(process.argv[2])
const port = Number(process.argv[3])
const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
  '.xml': 'application/xml',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
}
http
  .createServer(async (req, res) => {
    try {
      let file = path.resolve(
        root,
        `.${decodeURIComponent(new URL(req.url, 'http://local').pathname)}`,
      )
      if (!file.startsWith(root + path.sep) && file !== root) throw Error()
      let st = await fs.stat(file)
      if (st.isDirectory()) {
        file = path.join(file, 'index.html')
        st = await fs.stat(file)
      }
      let body = await fs.readFile(file)
      res.setHeader(
        'content-type',
        types[path.extname(file)] || 'application/octet-stream',
      )
      res.setHeader(
        'cache-control',
        file.includes('/_astro/')
          ? 'public,max-age=31536000,immutable'
          : 'no-cache',
      )
      if (
        /gzip/.test(req.headers['accept-encoding'] || '') &&
        body.length > 512 &&
        /\.(html|css|js|mjs|json|xml|svg|wasm)$/.test(file)
      ) {
        body = gzipSync(body)
        res.setHeader('content-encoding', 'gzip')
        res.setHeader('vary', 'accept-encoding')
      }
      res.end(body)
    } catch {
      res.writeHead(404)
      res.end('Not found')
    }
  })
  .listen(port, '127.0.0.1', () =>
    console.log(`Serving ${root} at http://127.0.0.1:${port}`),
  )
