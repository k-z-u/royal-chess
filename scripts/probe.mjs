/**
 * End-to-end click probe using the real camera matrices.
 *
 *   node scripts/probe.mjs http://127.0.0.1:4173/ 1440 900
 *
 * Open the page with ?debug so the camera handle is available.
 */
import { chromium } from 'playwright'

const url = process.argv[2] ?? 'http://127.0.0.1:4173/'
const W = Number(process.argv[3] ?? 1440)
const H = Number(process.argv[4] ?? 900)

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: W, height: H } })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text())
})

const target = url.includes('?') ? `${url}&debug` : `${url}?debug`
await page.goto(target, { waitUntil: 'load' })
await page.waitForTimeout(3200)

let failures = 0
const check = (ok, label, extra = '') => {
  if (!ok) failures++
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${extra ? '  — ' + extra : ''}`)
}

const mats = await page.evaluate(() => ({
  p: Array.from(window.__camera.projectionMatrix.elements),
  v: Array.from(window.__camera.matrixWorldInverse.elements),
}))
const mul = (m, x, y, z, w) => [
  m[0] * x + m[4] * y + m[8] * z + m[12] * w,
  m[1] * x + m[5] * y + m[9] * z + m[13] * w,
  m[2] * x + m[6] * y + m[10] * z + m[14] * w,
  m[3] * x + m[7] * y + m[11] * z + m[15] * w,
]
function project(sq) {
  const f = sq.charCodeAt(0) - 97
  const r = sq.charCodeAt(1) - 49
  const x = (f + 0.5) - 4
  const z = 4 - (r + 0.5)
  const eye = mul(mats.v, x, 0.02, z, 1)
  const clip = mul(mats.p, eye[0], eye[1], eye[2], eye[3])
  return [((clip[0] / clip[3] + 1) / 2) * W, ((1 - clip[1] / clip[3]) / 2) * H]
}

const moves = () =>
  page.evaluate(() =>
    [...document.querySelectorAll('.move-san')].map((e) => e.textContent.trim()).filter(Boolean),
  )

async function clickSquare(sq) {
  const [x, y] = project(sq)
  await page.mouse.click(x, y)
  await page.waitForTimeout(200)
  return [x | 0, y | 0]
}

// --- a real click on a piece must select it (store is available with ?debug)
const p1 = await clickSquare('e2')
const sel = await page.evaluate(() => window.__chess?.getState().selected)
check(sel === 'e2', 'real click on the e2 pawn selects it', `selected=${sel} at ${p1[0]},${p1[1]}`)

const p2 = await clickSquare('e4')
await page.waitForTimeout(400)
let list = await moves()
check(
  list.includes('e4'),
  'real click on e4 plays the move',
  `at ${p2[0]},${p2[1]}  list=${list.join(' ')}`,
)

// --- cpu replies
const t0 = Date.now()
let replyMs = -1
for (let i = 0; i < 250; i++) {
  await page.waitForTimeout(100)
  list = await moves()
  if (list.length >= 2) {
    replyMs = Date.now() - t0
    break
  }
}
check(replyMs > 0 && replyMs < 6000, 'cpu answers promptly', `${replyMs}ms  ${list.join(' ')}`)

// --- rotating must not be mistaken for a click
const st0 = await page.evaluate(() => JSON.stringify(window.__chess.getState().selected))
const [ax, ay] = project('a1')
await page.mouse.move(ax, ay)
await page.mouse.down()
await page.mouse.move(ax + 180, ay - 70, { steps: 14 })
await page.mouse.up()
await page.waitForTimeout(300)
const st1 = await page.evaluate(() => JSON.stringify(window.__chess.getState().selected))
check(st0 === st1, 'drag-orbit does not select a square', `${st0} -> ${st1}`)

// --- zoom
await page.mouse.wheel(0, -400)
await page.waitForTimeout(500)
check(errors.length === 0, 'orbit + zoom raise no errors', errors.join(' | ') || 'clean')

// --- a drawn frame (a black frame would compress far smaller)
const buf = await page.screenshot()
check(buf.length > 200_000, 'scene renders real pixels', `${(buf.length / 1024) | 0} KB`)
await page.screenshot({ path: '/tmp/royal-chess-shots/probe.png' })

console.log(errors.length ? `\nerrors:\n  ${errors.join('\n  ')}` : '\nerrors: (none)')
console.log(failures ? `\n${failures} CHECK(S) FAILED` : '\nALL PROBE CHECKS PASSED')
await browser.close()
process.exit(failures ? 1 : 0)
