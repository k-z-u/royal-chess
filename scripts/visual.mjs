import { chromium } from 'playwright'
const url = (process.argv[2] ?? 'http://127.0.0.1:4173/') + '?debug'
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
page.on('pageerror', e => console.log('[pageerror]', e.message))
await page.goto(url, { waitUntil: 'load' })
await page.waitForTimeout(3200)

const play = async (list) => {
  for (const [f, t] of list) {
    await page.evaluate(([ff, tt]) => {
      const g = window.__chess.getState()
      g.selectSquare(ff); g.selectSquare(tt)
    }, [f, t])
    await page.waitForTimeout(80)
  }
  await page.waitForTimeout(500)
}
const clear = () => page.evaluate(() => window.__chess.getState().newGame({ mode: 'human' }))

// zoomed-in look at the frame labels
await page.waitForTimeout(1500)
await page.mouse.move(720, 470)
for (let i = 0; i < 8; i++) { await page.mouse.wheel(0, -300); await page.waitForTimeout(140) }
await page.waitForTimeout(250)
const camDist = await page.evaluate(() => window.__camera.position.distanceTo({ x: 0, y: 0.32, z: 0 }).toFixed(2))
console.log('camera distance after zoom:', camDist)
await page.screenshot({ path: '/tmp/royal-chess-shots/z1-zoom.png' })

// check indicator
await clear(); await page.waitForTimeout(300)
await play([['e2','e4'],['f7','f5'],['d1','h5']])
await page.screenshot({ path: '/tmp/royal-chess-shots/z2-check.png' })

// promotion dialog
await clear(); await page.waitForTimeout(300)
await play([['a2','a4'],['b7','b5'],['a4','b5'],['a7','a6'],['b5','a6'],['b8','c6'],['a6','a7'],['c6','b8']])
await page.evaluate(() => { const g = window.__chess.getState(); g.selectSquare('a7'); g.selectSquare('b8') })
await page.waitForTimeout(500)
await page.screenshot({ path: '/tmp/royal-chess-shots/z3-promo.png' })
await page.evaluate(() => window.__chess.getState().choosePromotion('q'))
await page.waitForTimeout(900)
await page.screenshot({ path: '/tmp/royal-chess-shots/z4-promoted.png' })

// settings + new game dialogs
await page.evaluate(() => [...document.querySelectorAll('button')].find(b => b.title === 'Settings')?.click())
await page.waitForTimeout(600)
await page.screenshot({ path: '/tmp/royal-chess-shots/z5-settings.png' })
await page.keyboard.press('Escape')
await page.waitForTimeout(300)
await page.evaluate(() => [...document.querySelectorAll('button')].find(b => b.title === 'New game')?.click())
await page.waitForTimeout(600)
await page.screenshot({ path: '/tmp/royal-chess-shots/z6-newgame.png' })
console.log('done')
await browser.close()
