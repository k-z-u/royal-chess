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

  // ------------------------------------------------------------ help mode
  // hovering a piece must preview its moves without selecting anything
  const cam = await page.evaluate(() => ({
    p: Array.from(window.__camera.projectionMatrix.elements),
    v: Array.from(window.__camera.matrixWorldInverse.elements),
  }))
  const mul = (m, x, y, z, w) => [
    m[0] * x + m[4] * y + m[8] * z + m[12] * w,
    m[1] * x + m[5] * y + m[9] * z + m[13] * w,
    m[2] * x + m[6] * y + m[10] * z + m[14] * w,
    m[3] * x + m[7] * y + m[11] * z + m[15] * w,
  ]
  const project = (sq) => {
    const x = sq.charCodeAt(0) - 97 + 0.5 - 4
    const z = 4 - (sq.charCodeAt(1) - 49 + 0.5)
    const eye = mul(cam.v, x, 0.02, z, 1)
    const clip = mul(cam.p, eye[0], eye[1], eye[2], eye[3])
    return [((clip[0] / clip[3] + 1) / 2) * page.viewportSize().width, ((1 - clip[1] / clip[3]) / 2) * page.viewportSize().height]
  }
  const hoverSquare = async (sq) => {
    const [x, y] = project(sq)
    await page.mouse.move(x, y)
    await page.waitForTimeout(260)
    return state()
  }

  await page.evaluate(() => {
    const g = window.__chess.getState()
    g.newGame({ mode: 'human' })
    g.setSetting('help', true)
  })
  await page.waitForTimeout(400)

  st = await hoverSquare('e2')
  check(
    st.previewTargets.includes('e3') && st.previewTargets.includes('e4') && st.selected === null,
    'help mode previews the hovered pawn without selecting it',
    `hover=${st.hoverSquare} preview=${st.previewTargets.join(',')}`,
  )
  await shot('02b-help-hover')

  st = await hoverSquare('e7')
  check(
    st.previewTargets.length === 0,
    'help mode never previews the opponent',
    `hover=${st.hoverSquare} preview=${st.previewTargets.join(',')}`,
  )

  st = await hoverSquare('d1')
  check(
    st.previewTargets.length === 0,
    'help mode leaves blocked pieces alone',
    `hover=${st.hoverSquare} preview=${st.previewTargets.join(',')}`,
  )

  await page.evaluate(() => window.__chess.getState().setSetting('help', false))
  await page.waitForTimeout(200)
  st = await hoverSquare('e2')
  check(st.previewTargets.length === 0, 'help mode off shows nothing', `preview=${st.previewTargets.join(',')}`)

  await page.evaluate(() => window.__chess.getState().setSetting('help', true))
  await page.waitForTimeout(150)

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
  // the app must never leave the turn hanging: it either reports that the
  // engine is thinking or the reply is already on the board. That part is
  // entirely ours to get right and does not depend on how fast this machine
  // renders (a fast search plus the deliberate pacing can finish in ~470ms).
  let handedOff = false
  for (let i = 0; i < 8; i++) {
    const s = await page.evaluate(() => {
      const g = window.__chess.getState()
      return { thinking: g.thinking, plies: g.history.length }
    })
    if (s.thinking || s.plies >= 2) {
      handedOff = true
      break
    }
    await page.waitForTimeout(60)
  }
  check(handedOff, 'the engine takes the turn the moment it changes')
  let replyMs = -1
  for (let i = 0; i < 300; i++) {
    await page.waitForTimeout(100)
    if ((await page.evaluate(() => window.__chess.getState().history.length)) >= 2) {
      replyMs = Date.now() - t0
      break
    }
  }
  const cpuHist = await page.evaluate(() =>
    window.__chess.getState().history.map((h) => h.san).join(' '),
  )
  // a generous bound: software-rendered headless runs of this scene crawl, so
  // anything tighter measures the harness rather than the game
  check(replyMs > 0 && replyMs < 20000, 'cpu answers', `${replyMs}ms  ${cpuHist}`)
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
