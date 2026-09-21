/**
 * Headless UI / interaction check.
 *
 *   npm run dev   (in another terminal)
 *   node scripts/ui-check.mjs http://127.0.0.1:5173/
 *
 * It runs against the dev server because the interaction assertions need the
 * `__shogi` store handle and the `__camera` that the debug module exposes. The
 * rendering assertions work against a production build too.
 */
import { chromium } from 'playwright'

const url = process.argv[2] ?? 'http://127.0.0.1:5199/'
const outDir = process.argv[3] ?? '/tmp/royal-shogi-shots'

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()

const problems = []
page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`))
page.on('console', (m) => {
  if (m.type() === 'error') problems.push(`console.error: ${m.text()}`)
})

await page.goto(url, { waitUntil: 'load' })
await page.waitForTimeout(3500)

let failures = 0
const check = (ok, label, extra = '') => {
  const line = `${ok ? 'ok  ' : 'FAIL'} ${label}${extra ? `  — ${extra}` : ''}`
  if (!ok) failures += 1
  console.log(line)
}

const state = () => page.evaluate(() => window.__shogi.getState())
const hasHandle = await page.evaluate(() => !!window.__shogi)
const shot = async (name) => page.screenshot({ path: `${outDir}/${name}.png` })

// ---------------------------------------------------------------- rendering
const info = await page.evaluate(() => {
  const canvas = document.querySelector('canvas')
  const gl = canvas?.getContext('webgl2') || canvas?.getContext('webgl')
  return { canvas: !!canvas, w: canvas?.width ?? 0, h: canvas?.height ?? 0, webgl: !!gl }
})
check(info.canvas && info.webgl && info.w > 0, 'webgl canvas is live', JSON.stringify(info))

const frame = await page.screenshot()
check(frame.length > 120_000, 'the scene renders real pixels', `${(frame.length / 1024) | 0} KB`)
await shot('01-desktop')

const brand = await page.textContent('.brand-text')
check(brand?.includes('将棋'), 'the brand is in Japanese', brand ?? '')
const title = await page.title()
check(title === 'ロイヤルチェス · 将棋', 'the document title is Japanese', title)

if (!hasHandle) {
  console.log('\n(no __shogi handle — production build; skipping interaction assertions)')
} else {
  /** World → screen for a shogi square, so a real click can land on it. */
  const project = async (file, rank) => {
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
    const eye = mul(cam.v, (file - 5) * 1, 0.02, (rank - 5) * 1, 1)
    const clip = mul(cam.p, eye[0], eye[1], eye[2], eye[3])
    const size = page.viewportSize()
    return [((clip[0] / clip[3] + 1) / 2) * size.width, ((1 - clip[1] / clip[3]) / 2) * size.height]
  }

  /** Tap a square with the real mouse — this exercises the board's tap layer. */
  const tapSquare = async (file, rank) => {
    const [x, y] = await project(file, rank)
    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.up()
    await page.waitForTimeout(220)
  }

  /**
   * Play moves through the same actions the UI uses, so legality checks, the
   * promotion prompt and the engine hand-off are all exercised.
   */
  const playMoves = async (list, { answerPromotion = true } = {}) => {
    for (const usi of list) {
      await page.evaluate(
        ([from, to]) => {
          const g = window.__shogi.getState()
          const sq = (text) => {
            const file = Number(text[0])
            const rank = 'abcdefghi'.indexOf(text[1]) + 1
            return (rank - 1) * 9 + (9 - file)
          }
          // route through the same actions the UI uses, so legality, promotion
          // prompts and the engine hand-off are all exercised
          g.selectSquare(sq(from))
          g.attemptMove(sq(from), sq(to))
        },
        [usi.slice(0, 2), usi.slice(2, 4)],
      )
      // a move that can promote opens the dialog, so answer it the way the USI
      // text asks: '+' promotes, anything else declines
      const pending = await page.evaluate(() => !!window.__shogi.getState().promotion)
      if (pending && answerPromotion) {
        await page.evaluate((promote) => window.__shogi.getState().choosePromotion(promote), usi.endsWith('+'))
      }
      await page.waitForTimeout(110)
    }
  }

  // --------------------------------------------------- selecting & tapping
  await page.evaluate(() => window.__shogi.getState().newGame({ mode: 'human' }))
  await page.waitForTimeout(400)

  const SQ = (file, rank) => (rank - 1) * 9 + (9 - file)
  await tapSquare(7, 7)
  let st = await state()
  check(st.selected === SQ(7, 7), 'tapping the 歩 at 7g selects it', `selected=${st.selected}`)
  const targets = st.targets.map((m) => (m >> 7) & 0x7f)
  check(targets.includes(SQ(7, 6)), 'the 歩 at 7g offers 7f', `targets=${targets.join(',')}`)
  await shot('02-selected')
  await tapSquare(7, 6)
  st = await state()
  check(st.history.length === 1, 'tapping the target square plays the move', st.history[0]?.kif ?? '')
  check(st.history[0]?.kif === '７六歩(77)', 'the move is written in KIF', st.history[0]?.kif ?? '')

  const panelText = await page.textContent('.movelist')
  check(panelText?.includes('７六歩(77)'), 'the move list shows the KIF move', panelText?.trim().slice(0, 40) ?? '')

  // ------------------------------------------------------------ promotion
  await page.evaluate(() => window.__shogi.getState().newGame({ mode: 'human' }))
  await page.waitForTimeout(300)
  // leave the dialog open on purpose: this test is about the dialog itself
  await playMoves(['7g7f', '3c3d', '8h2b'], { answerPromotion: false })
  await page.waitForTimeout(300)
  st = await state()
  check(!!st.promotion, 'the promotion dialog opens for a 角 entering the zone', JSON.stringify(st.promotion))
  await shot('03-promotion')
  await page.evaluate(() => window.__shogi.getState().choosePromotion(true))
  await page.waitForTimeout(500)
  st = await state()
  const horse = st.pieces.find((p) => p.square === SQ(2, 2))
  check(Math.abs(horse?.code ?? 0) === 14, '成る turns the 角 into 馬', `code=${horse?.code}`)

  // ------------------------------------------------------------ declaration of 不成
  await page.evaluate(() => window.__shogi.getState().newGame({ mode: 'human' }))
  await page.waitForTimeout(300)
  await playMoves(['7g7f', '3c3d', '8h2b'])
  await page.waitForTimeout(250)
  await page.evaluate(() => window.__shogi.getState().choosePromotion(false))
  await page.waitForTimeout(450)
  st = await state()
  const bishop = st.pieces.find((p) => p.square === SQ(2, 2))
  check(Math.abs(bishop?.code ?? 0) === 6, '成らず keeps the 角', `code=${bishop?.code}`)

  // ------------------------------------------------------------ the 3D board
  // The render cannot be eyeballed from here, so assert on the scene graph:
  // every koma mesh must stand on the square the rules say it is on, and the
  // two sides must face each other.
  await page.evaluate(() => window.__shogi.getState().newGame({ mode: 'human' }))
  await page.waitForTimeout(500)
  const scene = await page.evaluate(() => {
    const koma = []
    window.__scene.traverse((o) => {
      // a koma is the mesh whose geometry has two material groups (face + wood)
      if (o.isMesh && o.geometry?.groups?.length === 2 && o.geometry.groups[0].materialIndex === 0) {
        const m = o.matrixWorld.elements
        koma.push({
          x: m[12],
          z: m[14],
          yaw: Math.atan2(m[8], m[10]),
          textured: !!o.material?.[0]?.map,
        })
      }
    })
    return { koma, expected: window.__shogi.getState().pieces.map((p) => ({ square: p.square, code: p.code })) }
  })
  check(scene.koma.length === 40, 'the scene draws 40 koma for the opening position', `${scene.koma.length}`)
  check(scene.koma.every((k) => k.textured), 'every koma carries its kanji texture')

  // world x/z → square, the same mapping the tap layer uses
  const SQUARE = (x, z) => {
    const file = Math.round(x) + 5
    const rank = Math.round(z) + 5
    return (rank - 1) * 9 + (9 - file)
  }
  const drawn = new Set(scene.koma.map((k) => SQUARE(k.x, k.z)))
  const ruled = new Set(scene.expected.map((p) => p.square))
  const missing = [...ruled].filter((sq) => !drawn.has(sq))
  check(missing.length === 0, 'every piece on the board is drawn on its own square', `missing=${missing.length}`)
  const sente = scene.koma.filter((k) => Math.abs(k.yaw) < 0.01).length
  const gote = scene.koma.filter((k) => Math.abs(Math.abs(k.yaw) - Math.PI) < 0.01).length
  check(sente === 20 && gote === 20, 'both sides face their owner', `sente=${sente} gote=${gote}`)

  // ------------------------------------------------------------ capture to hand
  await playMoves(['7g7f', '3c3d', '8h2b+', '8c8d'])
  await page.waitForTimeout(450)
  st = await state()
  const handText = await page.textContent('.panel')
  check(st.hands[0].bishop === 1, 'the captured 角 is in 先手’s hand', `bishop=${st.hands[0].bishop}`)
  check(handText?.includes('角'), 'the panel lists the piece in hand')

  // ------------------------------------------------------------ a drop
  await page.evaluate(() => {
    const g = window.__shogi.getState()
    g.selectHand({ color: 1, type: 6 })
  })
  await page.waitForTimeout(250)
  st = await state()
  check(st.dropTargets.length > 20, 'selecting a held 角 offers drop squares', `${st.dropTargets.length}`)
  await shot('04-hand')
  await tapSquare(5, 5)
  st = await state()
  check(
    st.history.length === 5 && st.hands[0].bishop === 0,
    'dropping the 角 plays it and empties the stand',
    `${st.history[4]?.kif}`,
  )
  check(st.history[4]?.kif?.includes('打'), 'the drop is written with 打', st.history[4]?.kif ?? '')

  // ------------------------------------------------------------ illegal move
  await page.evaluate(() => window.__shogi.getState().newGame({ mode: 'human' }))
  await page.waitForTimeout(300)
  const before = (await state()).history.length
  await page.evaluate(() => {
    const g = window.__shogi.getState()
    const sq = (file, rank) => (rank - 1) * 9 + (9 - file)
    g.attemptMove(sq(7, 7), sq(7, 4))
  })
  await page.waitForTimeout(250)
  check((await state()).history.length === before, 'an illegal move is refused')

  // ------------------------------------------------------------ 千日手
  await page.evaluate(() => window.__shogi.getState().newGame({ mode: 'human' }))
  await page.waitForTimeout(300)
  const shuffle = ['5i5h', '5a4b', '5h5i', '4b5a']
  for (let i = 0; i < 3; i += 1) await playMoves(shuffle)
  await page.waitForTimeout(600)
  st = await state()
  check(st.status.kind === 'repetition', 'fourfold repetition ends the game', JSON.stringify(st.status))
  const overText = await page.textContent('.modal')
  check(overText?.includes('千日手'), 'the result dialog says 千日手', overText?.slice(0, 30) ?? '')
  await shot('05-sennichite')

  // ------------------------------------------------------------ resign
  await page.evaluate(() => window.__shogi.getState().newGame({ mode: 'human' }))
  await page.waitForTimeout(300)
  await page.evaluate(() => window.__shogi.getState().resign())
  await page.waitForTimeout(400)
  st = await state()
  check(st.status.kind === 'resign', 'resigning ends the game', JSON.stringify(st.status))

  // ------------------------------------------------------------ undo
  await page.evaluate(() => window.__shogi.getState().newGame({ mode: 'human' }))
  await page.waitForTimeout(300)
  await playMoves(['7g7f', '3c3d'])
  const plies = (await state()).history.length
  await page.evaluate(() => window.__shogi.getState().undo())
  await page.waitForTimeout(400)
  check((await state()).history.length < plies, 'undo rewinds a ply')

  // ------------------------------------------------------------ hint
  await page.evaluate(() => window.__shogi.getState().newGame({ mode: 'cpu', difficulty: 2 }))
  await page.waitForTimeout(400)
  await page.evaluate(() => window.__shogi.getState().askHint())
  let hinted = false
  for (let i = 0; i < 120; i += 1) {
    await page.waitForTimeout(100)
    if ((await page.evaluate(() => window.__shogi.getState().hint)) !== null) {
      hinted = true
      break
    }
  }
  check(hinted, 'the hint button produces a suggestion')

  // ------------------------------------------------------------ the engine
  const t0 = Date.now()
  await playMoves(['7g7f'])
  let handedOff = false
  for (let i = 0; i < 10; i += 1) {
    const s = await page.evaluate(() => {
      const g = window.__shogi.getState()
      return { thinking: g.thinking, plies: g.history.length }
    })
    if (s.thinking || s.plies >= 2) {
      handedOff = true
      break
    }
    await page.waitForTimeout(60)
  }
  check(handedOff, 'the engine takes the turn when it changes')
  let replyMs = -1
  for (let i = 0; i < 300; i += 1) {
    await page.waitForTimeout(100)
    if ((await page.evaluate(() => window.__shogi.getState().history.length)) >= 2) {
      replyMs = Date.now() - t0
      break
    }
  }
  const cpuHistory = await page.evaluate(() => window.__shogi.getState().history.map((h) => h.usi).join(' '))
  check(replyMs > 0 && replyMs < 25000, 'the engine answers', `${replyMs}ms  ${cpuHistory}`)
  await page.waitForTimeout(700)
  await shot('06-cpu')

  // ------------------------------------------------------------ flip
  await page.evaluate(() => window.__shogi.getState().toggleView())
  await page.waitForTimeout(1500)
  check((await state()).viewSide === -1, 'the viewpoint flips to 後手')
  await shot('07-flipped')
}

// ------------------------------------------------------------ responsive
for (const [w, h, name] of [
  [390, 844, '08-mobile'],
  [834, 1112, '09-tablet'],
  [1920, 1080, '10-wide'],
]) {
  await page.setViewportSize({ width: w, height: h })
  await page.waitForTimeout(2000)
  await shot(name)
}

console.log('\nerrors:', problems.length ? `\n  ${problems.join('\n  ')}` : '(none)')
if (problems.length) failures += problems.length
console.log(failures ? `\n${failures} CHECK(S) FAILED` : '\nALL UI CHECKS PASSED')
await browser.close()
process.exit(failures ? 1 : 0)
