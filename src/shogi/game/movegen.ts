/**
 * Move generation — the heart of the rules.
 *
 * `generateMoves` produces pseudo-legal moves; `legalMoves` filters them down
 * to what the rules actually allow:
 *
 *   - a move may not leave your own 玉 in check
 *   - 二歩: no 歩 may be dropped on a file that already has your unpromoted 歩
 *   - 行き所のない駒: a 歩/香 may not be dropped on the last rank, nor a 桂 on
 *     the last two
 *   - 打ち歩詰め: dropping a 歩 to give immediate mate is illegal
 *   - 歩/香/桂 must promote when the landing square would strand them
 */
import {
  attacksFrom,
  baseOf,
  BLACK,
  canPromoteBase,
  dropPiece,
  fileOf,
  HAND_TYPES,
  inPromotionZone,
  isPromoted,
  other,
  PAWN,
  packDrop,
  packMove,
  Position,
  SQUARES,
  wouldHaveNoMove,
  type Move,
} from './position.ts'

/**
 * How deep the 打ち歩詰め test may recurse.
 *
 * The chain can only continue when a side's *only* escape is a 歩 drop that
 * itself gives mate, which is a vanishingly rare shape; the cap exists purely
 * so the recursion is provably finite, and treating a drop as legal at the cap
 * is the conservative choice.
 */
const MAX_MATE_DEPTH = 8

const targets: number[] = []

/** Does `color` have an unpromoted 歩 on this file? (二歩) */
function hasPawnOnFile(pos: Position, color: number, file: number): boolean {
  for (let row = 0; row < 9; row++) {
    const code = pos.board[row * 9 + (9 - file)]
    if (code === PAWN * color) return true
  }
  return false
}

/** Every pseudo-legal move for the side to move, appended to `out`. */
export function generateMoves(pos: Position, out: Move[]): Move[] {
  out.length = 0
  const color = pos.turn
  const board = pos.board

  for (let from = 0; from < SQUARES; from++) {
    const code = board[from]
    if (!code || code * color <= 0) continue

    const base = baseOf(code)
    const promoted = isPromoted(code)
    const promotable = !promoted && canPromoteBase(base)
    const fromInZone = promotable && inPromotionZone(from, color)

    targets.length = 0
    attacksFrom(pos, from, targets)
    for (let i = 0; i < targets.length; i++) {
      const to = targets[i]
      if (!promotable) {
        out.push(packMove(from, to, false))
        continue
      }
      if (fromInZone || inPromotionZone(to, color)) {
        if (wouldHaveNoMove(base, to, color)) {
          // 歩/香/桂 on a square with no future move: promotion is compulsory
          out.push(packMove(from, to, true))
        } else {
          out.push(packMove(from, to, false))
          out.push(packMove(from, to, true))
        }
      } else {
        out.push(packMove(from, to, false))
      }
    }
  }

  // drops
  const hand = pos.hand(color)
  for (let h = 0; h < HAND_TYPES.length; h++) {
    const type = HAND_TYPES[h]
    if (!hand[type]) continue
    for (let to = 0; to < SQUARES; to++) {
      if (board[to]) continue
      if (wouldHaveNoMove(type, to, color)) continue
      if (type === PAWN && hasPawnOnFile(pos, color, fileOf(to))) continue
      out.push(packDrop(type, to))
    }
  }

  return out
}

/**
 * Does the side to move have at least one legal move?
 *
 * Used both for mate detection and for the 打ち歩詰め test. Returns as soon as a
 * legal move is found, which makes it much cheaper than building the full list.
 */
export function hasLegalMove(pos: Position, depth = 0): boolean {
  // a fresh buffer per call: the 打ち歩詰め test recurses through here, and a
  // shared scratch array would be overwritten mid-iteration
  const moves = generateMoves(pos, [])
  const mover = pos.turn
  const enemy = other(mover)
  const kingIndex = mover === BLACK ? 0 : 1
  const count = moves.length

  for (let i = 0; i < count; i++) {
    const move = moves[i]
    pos.make(move)
    if (!pos.isAttacked(pos.kingSquare[kingIndex], enemy)) {
      if (dropPiece(move) === PAWN && depth < MAX_MATE_DEPTH && pos.inCheck(enemy)) {
        const mates = !hasLegalMove(pos, depth + 1)
        pos.unmake()
        if (mates) continue // 打ち歩詰め — not a legal move
        return true
      }
      pos.unmake()
      return true
    }
    pos.unmake()
  }
  return false
}

/** Every legal move for the side to move. */
export function legalMoves(pos: Position): Move[] {
  const legal: Move[] = []
  generateLegalMoves(pos, legal)
  return legal
}

/**
 * A reusable buffer for `generateLegalMoves`.
 *
 * The search visits millions of nodes and must not allocate a list at each one.
 * The returned array is the *same* array every call, so copy what you need out
 * of it before recursing.
 */
export function legalMovesScratch(pos: Position): Move[] {
  scratch.length = 0
  generateLegalMoves(pos, scratch)
  return scratch
}
const scratch: Move[] = []
const pseudoScratch: Move[] = []

/**
 * A reusable buffer of pseudo-legal moves.
 *
 * The search filters these with `isLegalMove` only for the moves it actually
 * visits, which is far cheaper than proving all ~80 of them legal at every
 * node. As with `legalMovesScratch`, copy what you need before recursing.
 */
export function pseudoMovesScratch(pos: Position): Move[] {
  return generateMoves(pos, pseudoScratch)
}

/**
 * The same list, appended to `out` and counted instead of allocated.
 *
 * `out` is the caller's buffer; the moves land at `out[0] … out[count - 1]`.
 */
export function generateLegalMoves(pos: Position, out: Move[]): number {
  const pseudo = generateMoves(pos, [])
  const mover = pos.turn
  const enemy = other(mover)
  const kingIndex = mover === BLACK ? 0 : 1
  let count = 0

  for (let i = 0; i < pseudo.length; i++) {
    const move = pseudo[i]
    pos.make(move)
    let ok = !pos.isAttacked(pos.kingSquare[kingIndex], enemy)
    if (ok && dropPiece(move) === PAWN && pos.inCheck(enemy)) {
      // 打ち歩詰め: a 歩 drop that gives immediate mate is illegal
      ok = hasLegalMove(pos)
    }
    pos.unmake()
    if (ok) out[count++] = move
  }
  return count
}

/** Is `move` legal in `pos`? Cheaper than building the whole list. */
export function isLegalMove(pos: Position, move: Move): boolean {
  const mover = pos.turn
  const enemy = other(mover)
  const kingIndex = mover === BLACK ? 0 : 1
  pos.make(move)
  let ok = !pos.isAttacked(pos.kingSquare[kingIndex], enemy)
  if (ok && dropPiece(move) === PAWN && pos.inCheck(enemy)) ok = hasLegalMove(pos)
  pos.unmake()
  return ok
}

/** Legal moves that give check. */
export function checkingMoves(pos: Position, legal?: Move[]): Move[] {
  const moves = legal ?? legalMoves(pos)
  const out: Move[] = []
  const enemy = other(pos.turn)
  for (const move of moves) {
    pos.make(move)
    const check = pos.inCheck(enemy)
    pos.unmake()
    if (check) out.push(move)
  }
  return out
}

/** Is the side to move mated? (In shogi there is no stalemate: no move = loss.) */
export function isMated(pos: Position): boolean {
  return !hasLegalMove(pos)
}

/**
 * Perft: the number of leaf nodes at `depth`. Counts are bulk-counted at
 * depth 1, which is sound because `legalMoves` never returns an illegal move.
 */
export function perft(pos: Position, depth: number): number {
  if (depth <= 0) return 1
  const moves = legalMoves(pos)
  if (depth === 1) return moves.length
  let nodes = 0
  for (const move of moves) {
    pos.make(move)
    nodes += perft(pos, depth - 1)
    pos.unmake()
  }
  return nodes
}

/** Per-root-move perft, for pinpointing a generation bug. */
export function perftDivide(pos: Position, depth: number): { move: Move; nodes: number }[] {
  const moves = legalMoves(pos)
  return moves.map((move) => {
    pos.make(move)
    const nodes = depth <= 1 ? 1 : perft(pos, depth - 1)
    pos.unmake()
    return { move, nodes }
  })
}
