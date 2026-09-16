/**
 * Engine verification harness.
 *
 *   node scripts/verify-engine.mjs
 *
 * 1. compiles src/engine/engine.ts to a temporary ESM module
 * 2. checks the move generator against chess.js with perft on six standard positions
 * 3. checks that the engine always answers with a legal move
 * 4. plays a couple of games against a random mover
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, rmSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Chess } from 'chess.js'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')
const OUT = path.join(HERE, '.build')

rmSync(OUT, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })
execFileSync(
  'npx',
  [
    'tsc',
    path.join(ROOT, 'src/engine/engine.ts'),
    '--ignoreConfig',
    '--outDir',
    OUT,
    '--module',
    'esnext',
    '--target',
    'es2022',
    '--moduleResolution',
    'bundler',
    '--skipLibCheck',
  ],
  { cwd: ROOT, stdio: 'inherit' },
)

const { perft, findBestMove } = await import(path.join(OUT, 'engine.js'))

let failures = 0
const check = (ok, label, extra = '') => {
  if (!ok) failures++
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${extra ? '  — ' + extra : ''}`)
}

function perftRef(fen, depth) {
  const c = new Chess(fen)
  const rec = (d) => {
    if (d === 0) return 1
    let n = 0
    for (const m of c.moves({ verbose: true })) {
      c.move(m)
      n += rec(d - 1)
      c.undo()
    }
    return n
  }
  return rec(depth)
}

const positions = [
  ['start', 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', [1, 2, 3, 4]],
  ['kiwipete', 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1', [1, 2, 3]],
  ['endgame', '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1', [1, 2, 3, 4]],
  ['promotions', 'r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1', [1, 2, 3]],
  ['position 5', 'rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8', [1, 2, 3]],
  ['position 6', 'r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10', [1, 2, 3]],
]

console.log('\nperft (move generator vs chess.js)')
for (const [name, fen, depths] of positions) {
  for (const d of depths) {
    const mine = perft(fen, d)
    const ref = perftRef(fen, d)
    check(mine === ref, `perft(${d}) ${name.padEnd(12)}`, `mine=${mine} ref=${ref}`)
  }
}

console.log('\nlegal answers')
const tricky = [
  '8/8/8/8/8/5k2/6q1/7K w - - 0 1',
  '7k/5Q2/6K1/8/8/8/8/8 b - - 0 1',
  'rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2',
  '8/P6k/8/8/8/8/7K/8 w - - 0 1',
  'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1',
  'rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8',
]
for (const fen of tricky) {
  const c = new Chess(fen)
  const legal = new Set(c.moves({ verbose: true }).map((m) => m.from + m.to + (m.promotion ?? '')))
  const over = legal.size === 0
  for (const diff of [1, 2, 3]) {
    const mv = findBestMove(fen, diff)
    const key = mv ? mv.from + mv.to + (mv.promotion ?? '') : 'null'
    check(over ? mv === null : legal.has(key), `legal d=${diff} ${fen.slice(0, 26)}`, key)
  }
}

console.log('\ntactics')
{
  const fen = '6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1'
  const mv = findBestMove(fen, 3)
  const c = new Chess(fen)
  const m = c.move({ from: mv.from, to: mv.to, promotion: mv.promotion })
  check(c.isCheckmate(), 'finds mate in one', m.san)
}
{
  const fen = '4k3/8/8/3q4/8/8/8/3RK3 w - - 0 1'
  const mv = findBestMove(fen, 2)
  check(mv.to === 'd5', 'takes a hanging queen', `${mv.from}${mv.to}`)
}
{
  // must not hang the queen for nothing
  const fen = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2'
  const mv = findBestMove(fen, 3)
  const c = new Chess(fen)
  c.move({ from: mv.from, to: mv.to, promotion: mv.promotion })
  const reply = c.moves({ verbose: true })
  const losesQueen = reply.some((r) => r.captured === 'q')
  check(!losesQueen, 'does not hang the queen', `${mv.from}${mv.to}`)
}

console.log('\nspeed')
{
  const fen = 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3'
  for (const d of [1, 2, 3]) {
    const t = Date.now()
    findBestMove(fen, d)
    const ms = Date.now() - t
    check(ms < 3000, `difficulty ${d} under 3s`, `${ms}ms`)
  }
}

console.log('\nstrength')
{
  let wins = 0
  const games = 2
  for (let g = 0; g < games; g++) {
    const c = new Chess()
    let ply = 0
    while (!c.isGameOver() && ply < 220) {
      if (c.turn() === 'w') {
        const mv = findBestMove(c.fen(), 2)
        c.move({ from: mv.from, to: mv.to, promotion: mv.promotion })
      } else {
        const ms = c.moves({ verbose: true })
        c.move(ms[Math.floor(Math.random() * ms.length)])
      }
      ply++
    }
    if (c.isCheckmate() && c.turn() === 'b') wins++
  }
  check(wins === games, `beats a random mover`, `${wins}/${games}`)
}

rmSync(OUT, { recursive: true, force: true })

console.log('')
if (failures) {
  console.log(`${failures} CHECK(S) FAILED`)
  process.exit(1)
}
console.log('ALL ENGINE CHECKS PASSED')
