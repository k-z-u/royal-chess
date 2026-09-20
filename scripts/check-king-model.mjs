// Does the browser fetch models/king.glb — and does it actually reach the board?
//
//   npm run build && npm start -- --port 4173 --no-open &
//   node scripts/check-king-model.mjs http://127.0.0.1:4173/
//
// Runs against the dev server and the production preview alike: it reads the
// rendered scene through the ?debug handles instead of importing app modules,
// so it checks what a player would actually see.
import { chromium } from 'playwright'

const url = (process.argv[2] ?? 'http://127.0.0.1:4173/') + '?debug'
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })

const problems = []
page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`))
page.on('console', (m) => {
  if (m.type() === 'error') problems.push(`console.error: ${m.text()}`)
})

let glbStatus = 0
let glbBytes = 0
page.on('response', (r) => {
  if (r.url().includes('king.glb')) glbStatus = r.status()
})
page.on('requestfinished', async (r) => {
  if (!r.url().includes('king.glb')) return
  try {
    glbBytes = (await (await r.response())?.body())?.length ?? 0
  } catch {}
})

await page.goto(url, { waitUntil: 'load' })

// the two kings on the back ranks, read straight off the rendered scene
const kings = () =>
  page.evaluate(() => {
    const found = []
    window.__scene?.traverse((o) => {
      if (!o.isMesh) return
      const g = o.geometry
      g.computeBoundingBox()
      const b = g.boundingBox
      if (Math.abs(b.max.y - b.min.y - 1.1) > 0.02) return
      found.push({ verts: g.attributes.position.count, uuid: g.uuid })
    })
    return found
  })

// the procedural king is a 96-segment lathe (~43k verts); the Blender mesh is
// far lighter, so a low count proves the override is on the board
const BLENDER_MAX_VERTS = 20000
let board = await kings()
for (let i = 0; i < 30 && !board.some((k) => k.verts < BLENDER_MAX_VERTS); i++) {
  await page.waitForTimeout(500)
  board = await kings()
}

const check = (ok, label, extra = '') =>
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${extra ? '  — ' + extra : ''}`)

check(glbStatus === 200, 'king.glb fetched', `status=${glbStatus} bytes=${glbBytes}`)
check(problems.length === 0, 'no page errors', problems.join(' | '))
check(board.length === 2, 'two kings on the board', JSON.stringify(board))
check(
  board.length === 2 &&
    board.every((k) => k.verts < BLENDER_MAX_VERTS) &&
    board[0].uuid === board[1].uuid,
  'both kings render the Blender mesh',
  JSON.stringify(board),
)

const st = await page.evaluate(() => {
  const g = window.__chess?.getState?.()
  return g ? { pieces: g.pieces.length, status: g.status.kind } : null
})
check(st && st.pieces === 32 && st.status === 'playing', 'game state intact', JSON.stringify(st))

await page.screenshot({ path: '/tmp/royal-chess-shots/king.png' })
await browser.close()
process.exit(
  problems.length || glbStatus !== 200 || !board.every((k) => k.verts < BLENDER_MAX_VERTS) ? 1 : 0,
)
