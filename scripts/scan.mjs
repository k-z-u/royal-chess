import { chromium } from 'playwright'

const url = (process.argv[2] ?? 'http://127.0.0.1:4173/') + '?debug'
const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()
page.on('pageerror', (e) => console.log('[pageerror]', e.message))
page.on('console', (m) => {
  if (m.type() === 'error') console.log('[err]', m.text())
})
await page.goto(url, { waitUntil: 'load' })
await page.waitForTimeout(3000)

// instrument: record pointer events reaching the canvas
await page.evaluate(() => {
  const c = document.querySelector('canvas')
  window.__ev = []
  for (const t of ['pointerdown', 'pointerup', 'click']) {
    c.addEventListener(t, (e) => window.__ev.push(`${t}@${Math.round(e.clientX)},${Math.round(e.clientY)}`), true)
  }
})

const sel = () => page.evaluate(() => window.__chess.getState().selected)
const clear = () => page.evaluate(() => window.__chess.setState({ selected: null, legalTargets: [] }))

console.log('scanning clicks (row = y, col = x)')
const xs = [300, 450, 600, 720, 840, 990, 1140]
const ys = [250, 350, 450, 550, 650, 750]
for (const y of ys) {
  const row = []
  for (const x of xs) {
    await clear()
    await page.mouse.click(x, y)
    await page.waitForTimeout(90)
    row.push(String(await sel() ?? '·').padStart(3))
  }
  console.log(String(y).padStart(4), row.join(' '))
}

const ev = await page.evaluate(() => window.__ev.slice(0, 6))
console.log('canvas events seen:', ev.join(' | ') || '(none)')
await browser.close()
