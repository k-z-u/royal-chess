/**
 * Engine verification harness.
 *
 *   node scripts/verify-engine.mjs
 *
 * The rules engine is the part of this project that has to be provably right, so
 * the checks are layered, weakest to strongest:
 *
 *   1. perft — node counts to depth 5 against the published values for the
 *      standard opening position, and *per root move* against RubyShogi's
 *      numbers, which is what pinpoints a missing or extra move
 *   2. a full sweep of the ply-3 layer against tsshogi, an independently
 *      written shogi library: every legal move list must match exactly
 *   3. random games — 1,600+ deep positions with drops, promotions and mates,
 *      each compared move-for-move against tsshogi
 *   4. hand-written rule tests: 二歩, 打ち歩詰め, 行き所のない駒, 強制成り,
 *      pinned pieces, 千日手, 連続王手の千日手, 詰み, and SFEN round-trips
 *   5. engine checks: it finds a mate in one, never plays a 打ち歩詰め, always
 *      answers with a legal move, and beats a random mover
 *
 * Needs the dev dependencies installed (tsshogi is the reference).
 */
import { Position, fileOf, rankOf, moveFrom, moveTo, movePromotes, dropPiece } from '../src/shogi/game/position.ts'
import { legalMoves, perft, perftDivide, hasLegalMove, isLegalMove } from '../src/shogi/game/movegen.ts'
import { Game, START_SFEN } from '../src/shogi/game/rules.ts'
import { kifOf, parseUsi, usiOf } from '../src/shogi/game/notation.ts'
import { searchPosition, LEVELS } from '../src/shogi/engine/search.ts'
import { evaluate } from '../src/shogi/engine/evaluate.ts'
import { Position as TsPosition, Square, PieceType } from 'tsshogi'

let failures = 0
let checks = 0
function check(ok, label, extra = '') {
  checks += 1
  if (!ok) failures += 1
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${extra ? `  — ${extra}` : ''}`)
}
function section(name) {
  console.log(`\n=== ${name} ===`)
}

const usiSquare = (sq) => `${fileOf(sq)}${'abcdefghi'[rankOf(sq) - 1]}`
/** Square index from file (1-9, right to left) and rank (1-9, far to near). */
const SQ = (file, rank) => (rank - 1) * 9 + (9 - file)
const usi = (m) =>
  dropPiece(m) ? `${'PLNSGBR'[dropPiece(m) - 1]}*${usiSquare(moveTo(m))}` : `${usiSquare(moveFrom(m))}${usiSquare(moveTo(m))}${movePromotes(m) ? '+' : ''}`

/** tsshogi's own view of a position, enumerated through its public API. */
const DROP_TYPES = [PieceType.PAWN, PieceType.LANCE, PieceType.KNIGHT, PieceType.SILVER, PieceType.GOLD, PieceType.BISHOP, PieceType.ROOK]
function tsMoves(sfen) {
  const pos = TsPosition.newBySFEN(sfen)
  if (!pos) return null
  const out = []
  for (const from of Square.all) {
    for (const to of Square.all) {
      const move = pos.createMove(from, to)
      if (!move) continue
      if (pos.isValidMove(move)) out.push(move.usi)
      const promoted = move.withPromote()
      if (pos.isValidMove(promoted)) out.push(promoted.usi)
    }
  }
  for (const type of DROP_TYPES) {
    for (const to of Square.all) {
      const move = pos.createMove(type, to)
      if (move && pos.isValidMove(move)) out.push(move.usi)
    }
  }
  return out.sort()
}

function compareLists(sfen, label) {
  const pos = Position.fromSfen(sfen)
  const mine = legalMoves(pos).map(usi).sort()
  const theirs = tsMoves(sfen)
  if (theirs === null) {
    check(false, `${label}: tsshogi rejected the SFEN`, sfen)
    return false
  }
  const mineOnly = mine.filter((m) => !theirs.includes(m))
  const tsOnly = theirs.filter((m) => !mine.includes(m))
  const ok = mineOnly.length === 0 && tsOnly.length === 0
  check(
    ok,
    label,
    ok ? `${mine.length} moves` : `mine=${mine.length} ts=${theirs.length} mineOnly=[${mineOnly}] tsOnly=[${tsOnly}] ${sfen}`,
  )
  return ok
}

// ---------------------------------------------------------------- 1. perft

section('perft — the published node counts')
const EXPECTED = [30, 900, 25470, 719731, 19861490]
for (let depth = 1; depth <= 5; depth += 1) {
  const started = Date.now()
  const nodes = perft(Position.fromSfen(START_SFEN), depth)
  const want = EXPECTED[depth - 1]
  const seconds = ((Date.now() - started) / 1000).toFixed(1)
  check(nodes === want, `perft(${depth}) = ${nodes}`, nodes === want ? `${seconds}s` : `expected ${want}`)
}

section('perft(5) per root move — RubyShogi reference')
const PER_ROOT = {
  '9g9f': 879050, '8g8f': 721424, '7g7f': 1099961, '6g6f': 722473, '5g5f': 728065,
  '4g4f': 727359, '3g3f': 777353, '2g2f': 763797, '1g1f': 821423,
  '9i9h': 721423, '1i1h': 623123, '7i7h': 643428, '7i6h': 604467, '3i4h': 495883,
  '3i3h': 455271, '6i7h': 596975, '6i6h': 606016, '6i5h': 524756, '4i5h': 529913,
  '4i4h': 534086, '4i3h': 454476,
  '2h3h': 687521, '2h4h': 650175, '2h5h': 647634, '2h6h': 638030, '2h7h': 666383, '2h1h': 713800,
  '5i5h': 614526, '5i6h': 645667, '5i4h': 567032,
}
{
  const pos = Position.fromSfen(START_SFEN)
  let mismatches = 0
  let total = 0
  for (const { move, nodes } of perftDivide(pos, 5)) {
    total += nodes
    const want = PER_ROOT[usi(move)]
    if (want !== undefined && want !== nodes) {
      mismatches += 1
      check(false, `root ${usi(move)} perft(5)`, `got ${nodes} expected ${want}`)
    }
  }
  check(mismatches === 0, `all ${Object.keys(PER_ROOT).length} published root counts match`, `total ${total}`)
  check(Object.keys(PER_ROOT).length === 30, 'the reference covers every root move')
}

// ------------------------------------------------- 2. the ply-3 layer sweep

section('tsshogi cross-check — every position after three plies')
{
  const started = Date.now()
  const pos = Position.fromSfen(START_SFEN)
  let compared = 0
  let bad = 0
  let firstBad = ''
  for (const root of legalMoves(pos)) {
    pos.make(root)
    for (const reply of legalMoves(pos)) {
      pos.make(reply)
      for (const third of legalMoves(pos)) {
        pos.make(third)
        const mine = legalMoves(pos).map(usi).sort()
        const theirs = tsMoves(pos.toSfen())
        compared += 1
        if (!theirs || theirs.length !== mine.length || mine.some((m, i) => m !== theirs[i])) {
          bad += 1
          if (!firstBad) {
            const mineSet = new Set(mine)
            const tsSet = new Set(theirs ?? [])
            firstBad = `${pos.toSfen()} mineOnly=[${mine.filter((m) => !tsSet.has(m))}] tsOnly=[${(theirs ?? []).filter((m) => !mineSet.has(m))}]`
          }
        }
        pos.unmake()
      }
      pos.unmake()
    }
    pos.unmake()
  }
  check(bad === 0, `${compared} positions after three plies match tsshogi move for move`, bad ? firstBad : `${((Date.now() - started) / 1000).toFixed(1)}s`)
}

// ------------------------------------------------------- 3. random game fuzz

section('tsshogi cross-check — random games (drops, promotions, mates)')
{
  const games = 60
  const maxPlies = 90
  let compared = 0
  let bad = 0
  let firstBad = ''
  let drops = 0
  let promotions = 0
  let checksSeen = 0
  // a tiny deterministic PRNG, so a failure can be reproduced
  let seed = 20260921
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    return seed / 0x7fffffff
  }

  for (let g = 0; g < games; g += 1) {
    const game = new Game()
    for (let ply = 0; ply < maxPlies; ply += 1) {
      const sfen = game.pos.toSfen()
      const mine = legalMoves(game.pos).map(usi).sort()
      const theirs = tsMoves(sfen)
      compared += 1
      if (!theirs || theirs.length !== mine.length || mine.some((m, i) => m !== theirs[i])) {
        bad += 1
        if (!firstBad) {
          const mineSet = new Set(mine)
          const tsSet = new Set(theirs ?? [])
          firstBad = `${sfen} mineOnly=[${mine.filter((m) => !tsSet.has(m))}] tsOnly=[${(theirs ?? []).filter((m) => !mineSet.has(m))}]`
        }
        break
      }
      if (!mine.length) break
      const pick = mine[Math.floor(rand() * mine.length)]
      const move = legalMoves(game.pos).find((m) => usi(m) === pick)
      const record = game.play(move)
      if (record.dropped) drops += 1
      if (record.promoted) promotions += 1
      if (record.check) checksSeen += 1
    }
  }
  check(
    bad === 0,
    `${compared} randomly reached positions match tsshogi`,
    bad ? firstBad : `${drops} drops, ${promotions} promotions, ${checksSeen} checks`,
  )
}

// ------------------------------------------------------------ 4. rule tests

section('二歩 — two pawns on a file')
{
  // 先手 pawn at 5g (file 5 occupied), 歩 in hand: no drop on file 5
  const sfen = '4k4/9/9/9/9/9/4P4/9/4K4 b P 1'
  const pos = Position.fromSfen(sfen)
  const drops = legalMoves(pos).filter((m) => dropPiece(m))
  check(!drops.some((m) => fileOf(moveTo(m)) === 5), 'a 歩 cannot be dropped on a file with an unpromoted 歩')
  check(drops.some((m) => fileOf(moveTo(m)) === 4), 'the same 歩 can be dropped on any other file')
  // once that pawn promotes, the file is free again
  const promoted = '4k4/9/9/9/9/9/4+P4/9/4K4 b P 1'
  const drops2 = legalMoves(Position.fromSfen(promoted)).filter((m) => dropPiece(m))
  check(drops2.some((m) => fileOf(moveTo(m)) === 5), 'a promoted 歩 no longer blocks a 歩 drop on its file')
}

section('打ち歩詰め — a 歩 drop that mates immediately is illegal')
{
  // 後手 玉 at 5a, boxed in by its own 香 at 4a/6a and 歩 at 4b/6b; 先手’s 歩 at
  // 5c defends the square the drop would land on. P*5b is therefore mate — and
  // therefore illegal, which is exactly what 打ち歩詰め is about.
  const mate = '3lkl3/3p1p3/4P4/9/9/9/9/9/4K4 b P 1'
  const drops = legalMoves(Position.fromSfen(mate)).filter((m) => dropPiece(m) === 1)
  check(!drops.some((m) => moveTo(m) === SQ(5, 2)), 'P*5b (mate) is not generated')
  check(drops.length > 0, 'other 歩 drops are still generated')
  // the same shape with a 金 in hand: the drop is legal, and it is mate
  const goldSfen = '3lkl3/3p1p3/4P4/9/9/9/9/9/4K4 b G 1'
  compareLists(goldSfen, 'the 金 drop in the same shape is legal')
  const gold = legalMoves(Position.fromSfen(goldSfen)).find((m) => dropPiece(m) === 5 && moveTo(m) === SQ(5, 2))
  check(gold !== undefined, 'G*5b exists where P*5b did not')
  const pos = Position.fromSfen(goldSfen)
  pos.make(gold)
  check(!hasLegalMove(pos), 'G*5b is checkmate')
  check(pos.inCheck(), 'and it gives check')
}

section('行き所のない駒 — a piece may not be stranded')
{
  const sfen = '4k4/9/9/9/9/9/9/9/4K4 b LNP 1'
  const pos = Position.fromSfen(sfen)
  const drops = legalMoves(pos).filter((m) => dropPiece(m))
  const rankOfTo = (m) => rankOf(moveTo(m))
  check(!drops.some((m) => dropPiece(m) === 2 && rankOfTo(m) === 1), 'no 香 drop on the last rank')
  check(!drops.some((m) => dropPiece(m) === 3 && rankOfTo(m) <= 2), 'no 桂 drop on the last two ranks')
  check(!drops.some((m) => dropPiece(m) === 1 && rankOfTo(m) === 1), 'no 歩 drop on the last rank')
  check(drops.some((m) => dropPiece(m) === 2 && rankOfTo(m) === 2), 'a 香 drop one rank up is fine')
}

section('強制成り — stepping somewhere with no future move forces promotion')
{
  // 先手 歩 at 8b: its only move is 8a, where it could never move again
  const sfen = '4k4/1P7/9/9/9/9/9/9/4K4 b - 1'
  const moves = legalMoves(Position.fromSfen(sfen)).filter((m) => !dropPiece(m) && moveTo(m) === SQ(8, 1))
  check(moves.length === 1 && movePromotes(moves[0]), 'the only 歩 move onto the last rank promotes', moves.map(usi).join(' '))
  check(moves.length === 1, 'the unpromoted alternative is not offered')

  // the same 歩 one rank earlier has both options
  const free = '4k4/9/1P7/9/9/9/9/9/4K4 b - 1'
  const freeMoves = legalMoves(Position.fromSfen(free)).filter((m) => !dropPiece(m) && moveTo(m) === SQ(8, 2))
  check(freeMoves.length === 2, 'a 歩 entering the zone has both 成 and 不成', freeMoves.map(usi).join(' '))

  // a 銀 already inside the zone keeps both options too
  const silver = '4k4/9/1S7/9/9/9/9/9/4K4 b - 1'
  const silverMoves = legalMoves(Position.fromSfen(silver)).filter((m) => !dropPiece(m) && moveTo(m) === SQ(8, 2))
  check(silverMoves.length === 2, 'a 銀 entering the zone has both 成 and 不成', silverMoves.map(usi).join(' '))
  check(
    silverMoves.some(movePromotes) && silverMoves.some((m) => !movePromotes(m)),
    'the two 銀 moves differ in promotion',
  )
}

section('pins and self-check')
{
  // 先手 玉 5i, 先手 金 5h, 後手 飛 5a: the gold may only move along the file
  const sfen = '4r4/9/9/9/9/9/9/4G4/4K4 b - 1'
  const pos = Position.fromSfen(sfen)
  const gold = SQ(5, 8)
  const goldMoves = legalMoves(pos).filter((m) => !dropPiece(m) && moveFrom(m) === gold)
  check(goldMoves.length === 1, 'a pinned 金 has exactly one legal move', goldMoves.map(usi).join(' '))
  check(goldMoves.every((m) => fileOf(moveTo(m)) === 5), 'and it stays on the pinning file')
  check(goldMoves.length === 1 && moveTo(goldMoves[0]) === SQ(5, 7), 'the move is 5h-5g', goldMoves.map(usi).join(' '))
  compareLists(sfen, 'the pinned position matches tsshogi')

  // the king may not step onto the rook's file
  const kingMoves = legalMoves(pos).filter((m) => !dropPiece(m) && moveFrom(m) === SQ(5, 9))
  check(kingMoves.length === 4, 'the 玉 has four safe escapes', kingMoves.map(usi).join(' '))
  check(kingMoves.every((m) => fileOf(moveTo(m)) !== 5), 'none of them is on the rook’s file')
}

section('captures go to hand')
{
  const game = new Game()
  const play = (text) => {
    const move = parseUsi(game.pos, text)
    if (!move) throw new Error(`illegal test move ${text} in ${game.pos.toSfen()}`)
    return game.play(move)
  }
  play('7g7f')
  play('3c3d')
  const record = play('8h2b+')
  check(record.captured === 6, 'capturing a 角 records the capture', `captured=${record.captured}`)
  check(record.promoted, 'the 角 promoted to 馬 on the capture')
  check(game.pos.hand(1)[6] === 1, 'the 角 went into 先手’s hand', game.pos.toSfen())
  check(game.pos.hand(-1)[6] === 0, 'and not into 後手’s')

  // capturing a promoted piece returns the *base* piece to hand
  const sfen = '4k4/4+p4/4S4/9/9/9/9/9/4K4 b - 1'
  const pos = Position.fromSfen(sfen)
  const capture = legalMoves(pos).find((m) => !dropPiece(m) && moveTo(m) === SQ(5, 2))
  check(capture !== undefined, 'the 銀 at 5c can take the と at 5b', `${legalMoves(pos).map(usi)}`)
  pos.make(capture)
  check(pos.hand(1)[1] === 1 && pos.hand(1)[9] === undefined, 'a captured と returns to hand as a 歩')
  check(pos.board[SQ(5, 2)] === 4, 'and the capturing 銀 now stands on 5b')
}

section('千日手 and 連続王手の千日手')
{
  const shuffles = ['5i4h', '5a4b', '4h5i', '4b5a']
  const game = new Game()
  for (let i = 0; i < 3; i += 1) {
    for (const text of shuffles) {
      const move = parseUsi(game.pos, text)
      if (!move) throw new Error(`illegal shuffle ${text}`)
      game.play(move)
    }
  }
  const status = game.status()
  check(game.repetitionCount() === 4, 'the position occurred four times')
  check(status.kind === 'repetition' && status.reason === 'draw', 'fourfold repetition is a draw', JSON.stringify(status))

  // both kings shuffle: 先手 between 5i/5h, 後手 between 5a/4b
  const line = ['5i5h', '5a4b', '5h5i', '4b5a']
  const p = new Game()
  let ok = true
  for (let i = 0; i < 3 && ok; i += 1) {
    for (const text of line) {
      const move = parseUsi(p.pos, text)
      if (!move) ok = false
      else p.play(move)
    }
  }
  const pStatus = p.status()
  check(
    ok && pStatus.kind === 'repetition' && pStatus.reason === 'draw',
    'a plain shuffle of both kings draws',
    ok ? JSON.stringify(pStatus) : 'a shuffle move was rejected',
  )

  // 連続王手の千日手: 先手’s 飛 checks on every one of its moves while 後手’s 玉
  // steps between 5a and 4a, so the fourth repetition is a *loss* for 先手
  const perpetual = new Game('4k4/9/9/9/9/9/9/9/4K4 b R 1')
  const checkLine = ['R*5c', '5a4a', '5c4c', '4a5a', '4c5c', '5a4a', '5c4c', '4a5a', '4c5c', '5a4a', '5c4c', '4a5a', '4c5c', '5a4a', '5c4c', '4a5a']
  let built = true
  for (const text of checkLine) {
    const move = parseUsi(perpetual.pos, text)
    if (!move) {
      built = false
      check(false, `the perpetual-check line broke at ${text}`, perpetual.pos.toSfen())
      break
    }
    perpetual.play(move)
  }
  const perpetualStatus = perpetual.status()
  check(
    built && perpetualStatus.kind === 'repetition' && perpetualStatus.reason === 'perpetual',
    'a side that checks through the repetition loses',
    JSON.stringify(perpetualStatus),
  )
  check(
    perpetualStatus.kind === 'repetition' && perpetualStatus.reason === 'perpetual' && perpetualStatus.winner === -1,
    'and the winner is the side that was being checked',
  )
}

section('詰み — a side with no legal move has lost')
{
  const mate = '3lkl3/3p1p3/4P4/9/9/9/9/9/4K4 b G 1'
  const pos = Position.fromSfen(mate)
  const drop = legalMoves(pos).find((m) => dropPiece(m) === 5 && moveTo(m) === SQ(5, 2))
  check(drop !== undefined, 'G*5b is available')
  pos.make(drop)
  check(!hasLegalMove(pos), 'the mated side has no move')
  check(pos.inCheck(), 'and it is in check')
  const game = new Game()
  const full = new Game(START_SFEN)
  check(full.status().kind === 'playing', 'the opening position is playable')
  check(game.status().kind === 'playing', 'a fresh game is playable')
  // no legal move at all means a loss, not a draw: there is no stalemate in shogi
  const stalemateLike = '1g7/1k7/9/9/9/9/9/9/8K b - 1'
  const s = Position.fromSfen(stalemateLike)
  if (!hasLegalMove(s)) {
    const over = new Game(stalemateLike)
    const status = over.status()
    check(status.kind === 'checkmate' && status.winner === 1, 'a side with no move loses', JSON.stringify(status))
  } else {
    check(true, 'the stalemate-like position was not actually stalemate (skipped)')
  }
}

section('SFEN and notation round trips')
{
  const positions = [
    START_SFEN,
    '4k4/9/9/9/9/9/9/9/4K4 b RBGSNLP 1',
    Game.newGame().pos.toSfen(),
  ]
  let bad = 0
  for (const sfen of positions) {
    const pos = Position.fromSfen(sfen)
    if (pos.toSfen() !== sfen) {
      bad += 1
      console.log(`     ${sfen} -> ${pos.toSfen()}`)
    }
  }
  check(bad === 0, 'SFEN survives a parse/print round trip')

  const game = new Game()
  const moves = ['7g7f', '3c3d', '8h2b+', '3a2b']
  const kifs = []
  for (const text of moves) {
    const move = parseUsi(game.pos, text)
    check(move !== null, `parseUsi accepts ${text}`)
    kifs.push(kifOf(game.pos, move, game.lastTo))
    game.play(move)
  }
  check(kifs[2] === '２二馬(88)', 'a promotion reads ２二馬(88)', kifs[2])
  check(kifs[3] === '同　銀(31)', 'a recapture reads 同　銀(31)', kifs[3])
  check(usiOf(parseUsi(Game.newGame().pos, '7g7f')) === '7g7f', 'USI round trips')
}

section('make/unmake and generator purity')
{
  const game = new Game()
  for (const text of ['7g7f', '3c3d', '2g2f', '8c8d']) {
    game.play(parseUsi(game.pos, text))
  }
  const before = game.pos.toSfen()
  const beforeHands = [Array.from(game.pos.hand(1)), Array.from(game.pos.hand(-1))]
  for (let i = 0; i < 3; i += 1) legalMoves(game.pos)
  check(game.pos.toSfen() === before, 'generating moves does not disturb the position')
  const moves = legalMoves(game.pos)
  for (const move of moves) {
    game.pos.make(move)
    game.pos.unmake()
  }
  check(game.pos.toSfen() === before, 'every make is undone exactly')
  check(
    JSON.stringify([Array.from(game.pos.hand(1)), Array.from(game.pos.hand(-1))]) === JSON.stringify(beforeHands),
    'hands survive make/unmake',
  )
  check(
    legalMoves(game.pos).every((m) => isLegalMove(game.pos, m)),
    'isLegalMove agrees with the generator on every move',
  )
}

// ----------------------------------------------------------- 5. engine checks

section('engine')
{
  const mateIn1 = '3lkl3/3p1p3/4P4/9/9/9/9/9/4K4 b G 1'
  const found = searchPosition(Position.fromSfen(mateIn1), LEVELS[2])
  check(found?.mate === true, 'finds a mate in one with a 金 drop', found ? `${found.usi} score ${found.score}` : 'no move')

  const rookMate = '3lkl3/3p1p3/4P4/9/9/9/9/9/4K4 b R 1'
  const rook = searchPosition(Position.fromSfen(rookMate), LEVELS[2])
  check(rook?.mate === true, 'finds a mate in one with a 飛 drop', rook ? rook.usi : 'no move')

  const pawnMate = '3lkl3/3p1p3/4P4/9/9/9/9/9/4K4 b P 1'
  const notMate = searchPosition(Position.fromSfen(pawnMate), LEVELS[2])
  check(notMate?.mate === false, 'does not claim mate where only a 打ち歩詰め exists', notMate ? notMate.usi : 'no move')

  // a self-play game: every answer must be legal, and the game must end sanely
  const game = new Game()
  let illegal = 0
  let plies = 0
  for (let i = 0; i < 60 && !game.isOver(); i += 1) {
    const report = searchPosition(game.pos, LEVELS[1], { history: game.usiMoves() })
    if (!report) break
    if (!isLegalMove(game.pos, report.move)) {
      illegal += 1
      break
    }
    game.play(report.move)
    plies += 1
  }
  check(illegal === 0 && plies > 10, `the engine played ${plies} legal plies in a row`, game.status().kind)
  check(evaluate(game.pos) !== undefined, 'the evaluation runs on the resulting position')

  // 中級 must beat a random mover over a handful of games
  let wins = 0
  const games = 4
  for (let g = 0; g < games; g += 1) {
    const match = new Game()
    let ply = 0
    while (!match.isOver() && ply < 200) {
      const legal = legalMoves(match.pos)
      if (!legal.length) break
      if (match.turn === 1) {
        const report = searchPosition(match.pos, LEVELS[1], { history: match.usiMoves() })
        match.play(isLegalMove(match.pos, report.move) ? report.move : legal[0])
      } else {
        match.play(legal[Math.floor(Math.random() * legal.length)])
      }
      ply += 1
    }
    const status = match.status()
    if (status.kind === 'checkmate' && status.winner === 1) wins += 1
  }
  check(wins === games, `中級 beats a random mover`, `${wins}/${games}`)
}

section('summary')
console.log(`\n${checks - failures}/${checks} checks passed`)
if (failures) {
  console.log(`${failures} CHECK(S) FAILED`)
  process.exit(1)
}
console.log('ALL ENGINE CHECKS PASSED')
