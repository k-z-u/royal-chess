/**
 * A shogi engine: iterative-deepening alpha-beta with a quiescence search.
 *
 * The parts, in the order a move travels through them:
 *
 *   run()          iterative deepening — depth 1, 2, 3 … until the depth or the
 *                  clock runs out, keeping the best move from the last
 *                  *completed* iteration so an abort never loses the work
 *   searchRoot()   one full-window pass over the root moves, so every root move
 *                  ends with a real score rather than a bound
 *   negamax()      alpha-beta with a 王手 extension, killer moves and the
 *                  history heuristic for ordering
 *   quiescence()   only captures, promotions and big drops, so the static
 *                  evaluation is never consulted in the middle of a capture
 *                  sequence
 *
 * Two shogi-specific things shape the search:
 *
 *   - a side with no legal move has *lost* (there is no stalemate), so a node
 *     with no moves returns a mate score, not a draw
 *   - repetition must be avoided by the side that is ahead, so a root move that
 *     lands on a position the game has already seen twice is capped at 0
 */  import { baseOf,
  BISHOP,
  dropPiece,
  GOLD,
  moveFrom,
  movePromotes,
  moveTo,
  PAWN,
  Position,
  ROOK,
  type Move,
} from '../game/position.ts'
import { isLegalMove, legalMovesScratch, pseudoMovesScratch } from '../game/movegen.ts'
import { parseUsi, usiOf } from '../game/notation.ts'
import { evaluate, MATE, PIECE_VALUE, PROMOTED_VALUE } from './evaluate.ts'

export interface Level {
  /** the deepest iteration the engine will start */
  depth: number
  /** wall-clock budget for the whole search, in milliseconds */
  timeMs: number
  /** probability of choosing a near-best move instead of the best one */
  randomness: number
  /** how far behind the best a move may be and still be chosen */
  window: number
}

/** 入門・中級・上級 — indexed by difficulty number (1-based) in the UI. */
export const LEVELS: Level[] = [
  { depth: 2, timeMs: 260, randomness: 0.55, window: 140 },
  { depth: 5, timeMs: 900, randomness: 0.14, window: 70 },
  { depth: 9, timeMs: 2200, randomness: 0.03, window: 30 },
]

export interface SearchReport {
  move: Move
  usi: string
  /** score in centipawns, from the mover's point of view */
  score: number
  depth: number
  nodes: number
  ms: number
  /** is the score a forced mate? (positive = we mate, negative = we are mated) */
  mate: boolean
  /** the best line the search found, in USI */
  pv: string[]
}

const MAX_PLY = 64
/** how deep the capture-only dive may go */
const MAX_Q_PLY = 10
/** moves per ply in the search's own stack — the widest legal list is ~600 */
const WIDTH = 1024
const MATE_BOUND = MATE - 1000

class Searcher {
  pos: Position
  private deadline: number
  private stopped = false
  private nodes = 0

  /** per-ply move lists and their ordering scores, plus two killers per ply */
  private moves = new Int32Array(MAX_PLY * WIDTH)
  private scores = new Int32Array(MAX_PLY * WIDTH)
  private killers = new Int32Array(MAX_PLY * 2).fill(-1)
  /** the history heuristic, indexed from * 81 + to */
  private history = new Int32Array(81 * 81)
  /** positions already seen in the game, for repetition avoidance at the root */
  private seen = new Map<string, number>()
  /** the root scores of the last completed iteration */
  rootScores: { move: Move; score: number }[] = []

  constructor(pos: Position, timeMs: number, history?: string[]) {
    this.pos = pos
    this.deadline = Date.now() + timeMs
    if (history?.length) {
      const replay = Position.fromSfen(
        'lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1',
      )
      this.countSeen(replay)
      for (const usi of history) {
        const move = parseUsi(replay, usi)
        if (!move) break
        replay.make(move)
        this.countSeen(replay)
      }
    }
  }

  private countSeen(pos: Position): void {
    const key = pos.key()
    this.seen.set(key, (this.seen.get(key) ?? 0) + 1)
  }

  get nodeCount(): number {
    return this.nodes
  }

  /** Has the clock run out? Sampled every 1024 nodes so it stays cheap. */
  private outOfTime(): boolean {
    if (this.stopped) return true
    if ((this.nodes & 1023) === 0 && Date.now() > this.deadline) this.stopped = true
    return this.stopped
  }

  /**
   * Copy the *pseudo-legal* moves for `ply` onto the search's own stack.
   *
   * Legality is settled later, per move, with `isLegalMove` — alpha-beta only
   * visits a handful of the moves it is offered, so proving all eighty of them
   * legal up front would be wasted work.
   */
  private gather(ply: number): number {
    const found = pseudoMovesScratch(this.pos)
    const count = found.length
    const base = ply * WIDTH
    for (let i = 0; i < count; i++) this.moves[base + i] = found[i]
    return count
  }

  /**
   * Give every move a selection score: captures by MVV-LVA, then promotions and
   * big drops, then killers, then whatever the history heuristic remembers.
   * `pick()` uses these lazily, so nothing is sorted until it is needed.
   */
  private scoreMoves(ply: number, count: number, ttMove: Move): void {
    const base = ply * WIDTH
    const board = this.pos.board
    const killer1 = this.killers[ply * 2]
    const killer2 = this.killers[ply * 2 + 1]

    for (let i = 0; i < count; i++) {
      const move = this.moves[base + i]
      if (move === ttMove) {
        this.scores[base + i] = 1 << 20
        continue
      }
      const drop = dropPiece(move)
      if (drop) {
        this.scores[base + i] = 500 + PIECE_VALUE[drop]
        continue
      }
      const from = moveFrom(move)
      const to = moveTo(move)
      const victim = board[to]
      let score = 0
      if (victim) {
        score = 100_000 + PIECE_VALUE[baseOf(victim)] * 8 - PIECE_VALUE[baseOf(board[from])]
      }
      if (movePromotes(move)) {
        const base0 = baseOf(board[from])
        score += 50_000 + PROMOTED_VALUE[base0] - PIECE_VALUE[base0]
      }
      if (score === 0) {
        if (move === killer1 || move === killer2) score = 40_000
        else score = this.history[from * 81 + to]
      }
      this.scores[base + i] = score
    }
  }

  /** Selection sort step: swap the highest-scoring remaining move into `i`. */
  private pick(ply: number, i: number, count: number): Move {
    const base = ply * WIDTH
    let best = i
    let bestScore = this.scores[base + i]
    for (let j = i + 1; j < count; j++) {
      if (this.scores[base + j] > bestScore) {
        bestScore = this.scores[base + j]
        best = j
      }
    }
    if (best !== i) {
      const move = this.moves[base + i]
      const score = this.scores[base + i]
      this.moves[base + i] = this.moves[base + best]
      this.scores[base + i] = this.scores[base + best]
      this.moves[base + best] = move
      this.scores[base + best] = score
    }
    return this.moves[base + i]
  }

  /** Does `move` give check? Only used to spot 歩 drops that are forcing. */
  private givesCheck(move: Move): boolean {
    this.pos.make(move)
    const check = this.pos.inCheck()
    this.pos.unmake()
    return check
  }

  /**
   * The capture dive at the horizon.
   *
   * `stand pat` is the score of not moving at all, which is what keeps alpha-beta
   * sound here: if standing pat already beats beta, the opponent would never
   * allow this position in the first place.
   */
  private quiescence(alpha: number, beta: number, ply: number): number {
    this.nodes += 1
    if (this.outOfTime()) return 0

    const stand = evaluate(this.pos)
    if (ply >= MAX_Q_PLY) return stand
    if (stand >= beta) return stand
    if (stand > alpha) alpha = stand

    const count = this.gather(ply)
    this.scoreMoves(ply, count, -1)

    for (let i = 0; i < count; i++) {
      const move = this.pick(ply, i, count)
      const drop = dropPiece(move)
      const victim = drop ? 0 : this.pos.board[moveTo(move)]
      const loud = drop
        ? drop === ROOK || drop === BISHOP || drop === GOLD || (drop === PAWN && this.givesCheck(move))
        : victim !== 0 || movePromotes(move)
      if (!loud) continue
      // delta pruning: even winning the captured piece outright could not reach
      // alpha, so this capture cannot change the score
      if (!drop && !movePromotes(move) && stand + PIECE_VALUE[baseOf(victim)] + 200 <= alpha) {
        continue
      }
      if (!isLegalMove(this.pos, move)) continue

      this.pos.make(move)
      const score = -this.quiescence(-beta, -alpha, ply + 1)
      this.pos.unmake()
      if (this.stopped) return 0
      if (score >= beta) return score
      if (score > alpha) alpha = score
    }
    return alpha
  }

  private negamax(depth: number, alpha: number, beta: number, ply: number): number {
    this.nodes += 1
    if (this.outOfTime()) return 0
    if (ply >= MAX_PLY - 2) return evaluate(this.pos)

    // 王手 extension: being checked is forcing, so look one ply further
    const inCheck = this.pos.inCheck()
    const remaining = inCheck ? depth + 1 : depth
    if (remaining <= 0) return this.quiescence(alpha, beta, ply)

    const count = this.gather(ply)
    if (count === 0) return -MATE + ply
    this.scoreMoves(ply, count, -1)

    let best = -MATE * 2
    let anyLegal = false
    for (let i = 0; i < count; i++) {
      const move = this.pick(ply, i, count)
      const captured = dropPiece(move) ? 0 : this.pos.board[moveTo(move)]
      // a pseudo-legal move that leaves our own 玉 in check is simply skipped
      if (!isLegalMove(this.pos, move)) continue
      anyLegal = true
      this.pos.make(move)
      const score = -this.negamax(remaining - 1, -beta, -alpha, ply + 1)
      this.pos.unmake()
      if (this.stopped) return 0

      if (score > best) best = score
      if (score > alpha) alpha = score
      if (alpha >= beta) {
        if (!captured && !dropPiece(move)) {
          // a quiet move that refuted the others: remember it for the sibling
          // nodes, both as a killer and in the history table
          this.killers[ply * 2 + 1] = this.killers[ply * 2]
          this.killers[ply * 2] = move
          this.history[moveFrom(move) * 81 + moveTo(move)] += remaining * remaining
        }
        return alpha
      }
    }
    // every pseudo-legal move was illegal: the side to move has no move at all
    if (!anyLegal) return -MATE + ply
    return best
  }

  /** One full-width pass over the root moves. */
  private searchRoot(depth: number, order: Move[]): { move: Move; score: number } | null {
    const root = this.pos
    const base = 0
    for (let i = 0; i < order.length; i++) this.moves[base + i] = order[i]
    this.scoreMoves(0, order.length, order[0])

    let bestMove: Move = -1
    let bestScore = -MATE * 2
    const scored: { move: Move; score: number }[] = []

    for (let i = 0; i < order.length; i++) {
      const move = this.pick(0, i, order.length)
      root.make(move)
      let score = -this.negamax(depth - 1, -MATE * 2, MATE * 2, 1)
      // a position the game has already seen twice can be drawn, and the side
      // that is ahead must not walk into it
      if (!this.stopped && score > 0 && (this.seen.get(root.key()) ?? 0) >= 2) score = 0
      root.unmake()
      if (this.stopped) break
      scored.push({ move, score })
      if (score > bestScore) {
        bestScore = score
        bestMove = move
      }
    }

    if (bestMove < 0) return null
    // leave the parent's list in best-first order for the next iteration
    scored.sort((a, b) => b.score - a.score)
    for (let i = 0; i < scored.length; i++) order[i] = scored[i].move
    this.rootScores = scored
    return { move: bestMove, score: bestScore }
  }

  run(maxDepth: number): { move: Move; score: number; depth: number; pv: Move[] } | null {
    const order = legalMovesScratch(this.pos).slice()
    if (!order.length) return null

    let result: { move: Move; score: number; depth: number; pv: Move[] } | null = null
    for (let depth = 1; depth <= maxDepth; depth++) {
      const pass = this.searchRoot(depth, order)
      if (!pass) break
      if (this.stopped) {
        // the pass ran out of time: its move is still the best guess, but the
        // score belongs to an unfinished iteration, so keep the previous report
        if (!result) result = { move: pass.move, score: pass.score, depth, pv: [pass.move] }
        break
      }
      result = { move: pass.move, score: pass.score, depth, pv: order.slice(0, 6) }
      if (Math.abs(pass.score) > MATE_BOUND) break
      if (Date.now() > this.deadline) break
    }
    return result
  }
}

/** How much worse than the best move a move may be and still be picked. */
function pickFromPool(scores: { move: Move; score: number }[], level: Level): Move {
  if (scores.length < 2 || level.randomness <= 0) return scores[0].move
  if (Math.random() >= level.randomness) return scores[0].move
  const pool = scores.filter((s) => scores[0].score - s.score <= level.window)
  return pool[Math.floor(Math.random() * pool.length)].move
}

export interface SearchOptions {
  /** USI move list of the game so far, for repetition avoidance */
  history?: string[]
  /** allow the sub-optimal picks that make the weaker levels feel human */
  allowRandomness?: boolean
}

/** Search `pos` and report the move to play. */
export function searchPosition(
  pos: Position,
  level: Level,
  options: SearchOptions = {},
): SearchReport | null {
  const searcher = new Searcher(pos.clone(), level.timeMs, options.history)
  const started = Date.now()
  const result = searcher.run(level.depth)
  if (!result) return null

  const allowRandomness = options.allowRandomness ?? false
  const move =
    allowRandomness && searcher.rootScores.length > 1
      ? pickFromPool(searcher.rootScores, level)
      : result.move

  return {
    move,
    usi: usiOf(move),
    score: result.score,
    depth: result.depth,
    nodes: searcher.nodeCount,
    ms: Date.now() - started,
    mate: Math.abs(result.score) > MATE_BOUND,
    pv: result.pv.map(usiOf),
  }
}
