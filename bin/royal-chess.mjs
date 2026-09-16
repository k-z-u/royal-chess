#!/usr/bin/env node
import http from 'node:http'
import { createReadStream } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import net from 'node:net'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..', 'dist')
const pkg = JSON.parse(await readFile(path.resolve(HERE, '..', 'package.json'), 'utf8'))

const GOLD = '\u001b[38;5;179m'
const DIM = '\u001b[2m'
const BOLD = '\u001b[1m'
const RESET = '\u001b[0m'

function usage() {
  console.log(`
${GOLD}${BOLD}Royal Chess${RESET} ${DIM}v${pkg.version}${RESET}

${BOLD}Usage${RESET}
  $ npx royal-chess [options]

${BOLD}Options${RESET}
  -p, --port <number>   Port to listen on (default 4173, auto-increments if busy)
      --host <address>  Address to bind (default 127.0.0.1)
      --no-open         Do not open the browser automatically
  -h, --help            Show this help
  -v, --version         Print the version

${DIM}The game runs entirely in your browser. Nothing is uploaded anywhere.${RESET}
`)
}

function parseArgs(argv) {
  const opts = { port: 4173, host: '127.0.0.1', open: true }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '-h' || a === '--help') {
      usage()
      process.exit(0)
    } else if (a === '-v' || a === '--version') {
      console.log(pkg.version)
      process.exit(0)
    } else if (a === '-p' || a === '--port') {
      opts.port = Number(argv[++i])
    } else if (a.startsWith('--port=')) {
      opts.port = Number(a.slice(7))
    } else if (a === '--host') {
      opts.host = argv[++i]
    } else if (a.startsWith('--host=')) {
      opts.host = a.slice(7)
    } else if (a === '--no-open') {
      opts.open = false
    }
  }
  if (!Number.isFinite(opts.port) || opts.port <= 0 || opts.port > 65535) opts.port = 4173
  return opts
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
}

async function fileFor(urlPath) {
  const clean = decodeURIComponent(urlPath.split('?')[0].split('#')[0])
  const rel = path.normalize(clean).replace(/^([.][.][/\\])+/, '').replace(/^[/\\]+/, '')
  const target = path.join(ROOT, rel)
  if (!target.startsWith(ROOT)) return null
  try {
    const s = await stat(target)
    if (s.isFile()) return target
    if (s.isDirectory()) {
      const idx = path.join(target, 'index.html')
      const si = await stat(idx)
      if (si.isFile()) return idx
    }
  } catch {
    /* fall through to SPA fallback */
  }
  try {
    const fallback = path.join(ROOT, 'index.html')
    const s = await stat(fallback)
    if (s.isFile()) return fallback
  } catch {
    /* nothing to serve */
  }
  return null
}

function freePort(start, host) {
  return new Promise((resolve) => {
    const tryPort = (port, attempts) => {
      if (attempts > 30) return resolve(start)
      const srv = net.createServer()
      srv.once('error', () => tryPort(port + 1, attempts + 1))
      srv.once('listening', () => srv.close(() => resolve(port)))
      srv.listen(port, host)
    }
    tryPort(start, 0)
  })
}

function openBrowser(url) {
  const cmd =
    process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'cmd' : 'xdg-open'
  const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url]
  try {
    const child = spawn(cmd, args, { stdio: 'ignore', detached: true })
    child.on('error', () => {})
    child.unref()
  } catch {
    /* ignore */
  }
}

const opts = parseArgs(process.argv.slice(2))

try {
  const s = await stat(path.join(ROOT, 'index.html'))
  if (!s.isFile()) throw new Error('missing build')
} catch {
  console.error(
    `${GOLD}Royal Chess${RESET} could not find a production build in ${DIM}${ROOT}${RESET}.`,
  )
  console.error('Run `npm run build` first (the published package ships with one).')
  process.exit(1)
}

const port = await freePort(opts.port, opts.host)

const server = http.createServer(async (req, res) => {
  const file = await fileFor(req.url ?? '/')
  if (!file) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
    res.end('Not found')
    return
  }
  const ext = path.extname(file).toLowerCase()
  const immutable = file.includes(`${path.sep}assets${path.sep}`)
  res.writeHead(200, {
    'content-type': MIME[ext] ?? 'application/octet-stream',
    'cache-control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
  })
  createReadStream(file).pipe(res)
})

server.on('error', (err) => {
  console.error(`${GOLD}Royal Chess${RESET} failed to start: ${err.message}`)
  process.exit(1)
})

server.listen(port, opts.host, () => {
  const url = `http://${opts.host === '0.0.0.0' ? 'localhost' : opts.host}:${port}/`
  console.log('')
  console.log(`  ${GOLD}${BOLD}\u265B  Royal Chess${RESET} ${DIM}v${pkg.version}${RESET}`)
  console.log('')
  console.log(`  ${DIM}serving${RESET}  ${url}`)
  console.log(`  ${DIM}stop with${RESET}  Ctrl+C`)
  console.log('')
  if (opts.open) openBrowser(url)
})

const shutdown = () => {
  server.close(() => process.exit(0))
  setTimeout(() => process.exit(0), 500)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
