import { chromium } from 'playwright'
import fs from 'node:fs'
const workerFile = fs.readdirSync('dist/assets').find(x => x.startsWith('worker'))
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()
page.on('pageerror', e => console.log('[pageerror]', e.message))
await page.goto(process.argv[2], { waitUntil: 'load' })
await page.waitForTimeout(2000)
const res = await page.evaluate(async (wf) => {
  const w = new Worker('/assets/' + wf, { type: 'module' })
  const run = (fen, difficulty) => new Promise((resolve) => {
    const t = performance.now()
    const h = (e) => { w.removeEventListener('message', h); resolve({ ms: Math.round(performance.now() - t), move: e.data.move }) }
    w.addEventListener('message', h)
    w.postMessage({ id: Math.random(), fen, difficulty })
  })
  const out = []
  const start = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1'
  const mid = 'r2q1rk1/pp2ppbp/2np1np1/8/2P1P3/2N1BP2/PP2N1PP/R2QKB1R w KQ - 0 9'
  out.push(['opening d1', await run(start, 1)])
  out.push(['opening d2', await run(start, 2)])
  out.push(['opening d3', await run(start, 3)])
  out.push(['middlegame d2', await run(mid, 2)])
  out.push(['middlegame d3', await run(mid, 3)])
  return out
}, workerFile)
for (const [k, v] of res) console.log(k.padEnd(15), v.ms + 'ms', JSON.stringify(v.move))
await browser.close()
