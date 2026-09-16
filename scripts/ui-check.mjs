/**
 * Headless UI / interaction check.
 *
 *   npm run build && npm start -- --port 4173 --no-open
 *   node scripts/ui-check.mjs http://127.0.0.1:4173/
 *
 * Runs against a dev server too (where the __chess debug handle is exposed),
 * which is what the interaction assertions need.
 */
import { chromium } from 'playwright'

const url = process.argv[2] ?? 'http://127.0.0.1:4173/'
const outDir = process.argv[3] ?? '/tmp/royal-chess-shots'

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()

const problems = []
page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`))
page.on('console', (m) => {
  if (m.type() === 'error') problems.push(`console.error: ${m.text()}`)
})

await page.goto(url, { waitUntil: 'load' })
await page.waitForTimeout(3200)

let failures = 0
const check = (ok, label, extra = '') => {
  if (!ok) failures++
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${extra ? '  — ' + extra : ''}`)
}

const state = () => page.evaluate(() => window.__chess.getState())
const hasHandle = await page.evaluate(() => !!window.__chess)

const shot = async (name) => {
  await page.screenshot({ path: `${outDir}/${name}.png` })
}

// ---------------------------------------------------------------- rendering
const info = await page.evaluate(() => {
  const c = document.querySelector('canvas')
  const gl = c?.getContext('webgl2') || c?.getContext('webgl')
  return { canvas: !!c, w: c?.width ?? 0, h: c?.height ?? 0, webgl: !!gl }
})
check(info.canvas && info.webgl && info.w > 0, 'webgl canvas is live', JSON.stringify(info))

// a blank frame compresses to a few KB; a lit board does not
const frame = await page.screenshot()
check(frame.length > 200_000, 'scene renders real pixels', `${(frame.length / 1024) | 0} KB`)
await page.screenshot({ path: `${outDir}/01-desktop.png` })

if (!hasHandle) {
  console.log('\n(no __chess handle — production build; skipping interaction assertions)')
} else {
  // ------------------------------------------------------------ selection
  await page.evaluate(() => {
    const g = window.__chess.getState()
    g.newGame({ mode: 'human' })
  })
  await page.waitForTimeout(400)
  await page.evaluate(() => window.__chess.getState().selectSquare('e2'))
  await page.waitForTimeout(200)
  let st = await state()
  check(
    st.selected === 'e2' && st.legalTargets.includes('e3') && st.legalTargets.includes('e4'),
    'selecting a pawn exposes its legal targets',
    `targets=${st.legalTargets.join(',')}`,
  )
  await shot('02-selected')

  // ------------------------------------------------------------ illegal move
  const before = (await state()).history.length
  await page.evaluate(() => {
    const g = window.__chess.getState()
    g.selectSquare('e2')
    g.selectSquare('e5')
  })
  await page.waitForTimeout(250)
  check((await state()).history.length === before, 'illegal move is refused')

  // ------------------------------------------------------------ promotion
  await page.evaluate(() => window.__chess.getState().newGame({ mode: 'human' }))
  await page.waitForTimeout(300)
  const seq = [
    ['a2', 'a4'],
    ['b7', 'b5'],
    ['a4', 'b5'],
    ['a7', 'a6'],
    ['b5', 'a6'],
    ['b8', 'c6'],
    ['a6', 'a7'],
    ['c6', 'b8'],
  ]
  for (const [f, t] of seq) {
    await page.evaluate(
      ([ff, tt]) => {
        const g = window.__chess.getState()
        g.selectSquare(ff)
        g.selectSquare(tt)
      },
      [f, t],
    )
    await page.waitForTimeout(90)
  }
  await page.evaluate(() => {
    const g = window.__chess.getState()
    g.selectSquare('a7')
    g.selectSquare('b8')
  })
  await page.waitForTimeout(300)
  st = await state()
  check(!!st.promotion, 'promotion dialog opens', JSON.stringify(st.promotion))
  await shot('03-promotion')
  await page.evaluate(() => window.__chess.getState().choosePromotion('q'))
  await page.waitForTimeout(500)
  st = await state()
  check(st.pieces.find((p) => p.square === 'b8')?.type === 'q', 'promotion applies')

  // ------------------------------------------------------------ en passant
  await page.evaluate(() => window.__chess.getState().newGame({ mode: 'human' }))
  await page.waitForTimeout(300)
  for (const [f, t] of [
    ['e2', 'e4'],
    ['a7', 'a6'],
    ['e4', 'e5'],
    ['d7', 'd5'],
    ['e5', 'd6'],
  ]) {
    await page.evaluate(
      ([ff, tt]) => {
        const g = window.__chess.getState()
        g.selectSquare(ff)
        g.selectSquare(tt)
      },
      [f, t],
    )
    await page.waitForTimeout(90)
  }
  await page.waitForTimeout(300)
  st = await state()
  check(
    !st.pieces.find((p) => p.square === 'd5') && st.lastMove?.enPassant === true,
    'en passant removes the pawn behind the target',
  )

  // ------------------------------------------------------------ castling
  await page.evaluate(() => window.__chess.getState().newGame({ mode: 'human' }))
  await page.waitForTimeout(300)
  for (const [f, t] of [
    ['e2', 'e4'],
    ['e7', 'e5'],
    ['g1', 'f3'],
    ['b8', 'c6'],
    ['f1', 'c4'],
    ['g8', 'f6'],
    ['e1', 'g1'],
  ]) {
    await page.evaluate(
      ([ff, tt]) => {
        const g = window.__chess.getState()
        g.selectSquare(ff)
        g.selectSquare(tt)
      },
      [f, t],
    )
    await page.waitForTimeout(90)
  }
  await page.waitForTimeout(500)
  st = await state()
  const wk = st.pieces.find((p) => p.type === 'k' && p.color === 'w')
  check(
    wk?.square === 'g1' && !!st.pieces.find((p) => p.type === 'r' && p.square === 'f1'),
    'kingside castling moves king and rook',
    `king=${wk?.square}`,
  )

  // ------------------------------------------------------------ checkmate
  await page.evaluate(() => window.__chess.getState().newGame({ mode: 'human' }))
  await page.waitForTimeout(300)
  for (const [f, t] of [
    ['e2', 'e4'],
    ['e7', 'e5'],
    ['d1', 'h5'],
    ['b8', 'c6'],
    ['f1', 'c4'],
    ['g8', 'f6'],
    ['h5', 'f7'],
  ]) {
    await page.evaluate(
      ([ff, tt]) => {
        const g = window.__chess.getState()
        g.selectSquare(ff)
        g.selectSquare(tt)
      },
      [f, t],
    )
    await page.waitForTimeout(90)
  }
  await page.waitForTimeout(900)
  st = await state()
  check(
    st.status.kind === 'checkmate' && st.status.winner === 'w',
    'checkmate detected',
    JSON.stringify(st.status),
  )
  await shot('04-checkmate')

  // ------------------------------------------------------------ undo
  const plies = (await state()).history.length
  await page.evaluate(() => window.__chess.getState().undo())
  await page.waitForTimeout(400)
  check((await state()).history.length < plies, 'undo rewinds a ply')

  // ------------------------------------------------------------ cpu
  await page.evaluate(() => window.__chess.getState().newGame({ mode: 'cpu', difficulty: 2 }))
  await page.waitForTimeout(400)
  const t0 = Date.now()
  await page.evaluate(() => {
    const g = window.__chess.getState()
    g.selectSquare('e2')
    g.selectSquare('e4')
  })
  let replyMs = -1
  for (let i = 0; i < 200; i++) {
    await page.waitForTimeout(100)
    if ((await page.evaluate(() => window.__chess.getState().history.length)) >= 2) {
      replyMs = Date.now() - t0
      break
    }
  }
  const cpuHist = await page.evaluate(() =>
    window.__chess.getState().history.map((h) => h.san).join(' '),
  )
  check(replyMs > 0 && replyMs < 6000, 'cpu answers promptly', `${replyMs}ms  ${cpuHist}`)
  check(!cpuHist.includes('null'), 'cpu produced a move')
  await page.waitForTimeout(900)
  await shot('05-cpu')

  // ------------------------------------------------------------ flip
  await page.evaluate(() => window.__chess.getState().toggleView())
  await page.waitForTimeout(1400)
  check((await state()).viewFrom === 'b', 'viewpoint flips')
  await shot('06-flipped')
}

// ------------------------------------------------------------ responsive
for (const [w, h, name] of [
  [390, 844, '07-mobile'],
  [834, 1112, '08-tablet'],
  [1920, 1080, '09-wide'],
]) {
  await page.setViewportSize({ width: w, height: h })
  await page.waitForTimeout(1800)
  await shot(name)
}

console.log('\nerrors:', problems.length ? '\n  ' + problems.join('\n  ') : '(none)')
if (problems.length) failures += problems.length
console.log(failures ? `\n${failures} CHECK(S) FAILED` : '\nALL UI CHECKS PASSED')
await browser.close()
process.exit(failures ? 1 : 0)
