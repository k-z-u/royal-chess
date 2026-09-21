/**
 * Evaluation — how good does the position look to the side to move?
 *
 * The score is in centipawn-ish units where a 歩 is worth 90. Everything is
 * accumulated with 先手 positive and then flipped for the side to move, which is
 * what a negamax search wants.
 *
 * Three terms, in the order they matter:
 *
 *   1. material — board pieces at their promoted or plain value, plus pieces in
 *      hand. Hand pieces are worth slightly more than the same piece on the
 *      board, because a drop can be placed wherever it hurts.
 *   2. placement — a 9×9 table per piece type. The tables are generated from a
 *      handful of named tendencies rather than typed out as magic numbers, so
 *      the "why" of every bonus is visible and tunable in one place.
 *   3. the attack on the 玉 — pieces near the enemy king score, which is what
 *      makes the engine prefer opening lines rather than only hoarding material.
 */
import {
  baseOf,
  BLACK,
  BISHOP,
  GOLD,
  isPromoted,
  KING,
  KNIGHT,
  LANCE,
  PAWN,
  Position,
  ROOK,
  SILVER,
  WHITE,
  type Color,
} from '../game/position.ts'

/** Plain piece values, indexed by base piece code. 玉 is never counted. */
export const PIECE_VALUE = [0, 90, 315, 405, 495, 540, 855, 990, 0]

/** A promoted piece is stronger than its base but usually not by the full extra. */
export const PROMOTED_VALUE = [0, 560, 500, 500, 520, 540, 1180, 1270, 0]

/** The same pieces, in hand — worth a little more because a drop always lands well. */
export const HAND_VALUE = [0, 105, 350, 450, 550, 600, 950, 1080, 0]

export const MATE = 30000
/** Scores above this are mate scores, so they must never be treated as material. */
export const MATE_THRESHOLD = MATE - 1000

function pieceValue(code: number): number {
  const base = baseOf(code)
  return isPromoted(code) ? PROMOTED_VALUE[base] : PIECE_VALUE[base]
}

/** How central a square is on the file axis: 4 in the middle, 0 at the edges. */
function centrality(col: number): number {
  return 4 - Math.abs(col - 4)
}

/**
 * Placement bonus for one piece, from that piece's own point of view.
 *
 * `row`/`col` are the array indices (row 0 is 後手's back rank), and the tables
 * are written for 先手; the caller mirrors them for 後手.
 */
function positionBonus(base: number, promoted: boolean, row: number, col: number): number {
  const up = 8 - row // 先手 advances towards row 0
  const center = centrality(col)

  if (promoted) {
    switch (base) {
      // 馬・龍 are happiest in the middle, but a 龍 also likes the enemy's 2nd rank
      case BISHOP:
        return 6 * center + 3 * up
      case ROOK:
        return 5 * center + 4 * up + (row === 1 ? 40 : 0)
      // と・成香・成桂・成銀 all move as a 金: push them at the enemy camp
      default:
        return 4 * up + 2 * center
    }
  }

  switch (base) {
    // a 歩 is worth more the further it has marched; the 5th rank especially
    case PAWN:
      return 7 * up + (row === 4 ? 12 : 0)
    case LANCE:
      return 4 * up + (up >= 5 ? 10 : 0)
    case KNIGHT:
      return 5 * up + 3 * center
    case SILVER:
      return 4 * up + 3 * center
    case GOLD:
      return 3 * up + 2 * center
    case BISHOP:
      return 5 * center + 2 * up
    case ROOK:
      return 4 * center + 3 * up + (row === 7 ? 25 : 0) + (row === 6 ? 12 : 0)
    // 玉: stay home, and prefer the files next to the edge where the wall of
    // pieces still shields it — an exposed king in the middle is a liability
    case KING: {
      const home = row >= 6 ? (row - 6) * 30 : -60
      const shield = col <= 1 || col >= 7 ? 25 : col === 4 ? -20 : 0
      const forward = row <= 2 ? -40 : 0
      return home + shield + forward
    }
    default:
      return 0
  }
}

/** How far a square is from another, in king moves. */
function kingDistance(a: number, b: number): number {
  const dr = Math.abs(((a / 9) | 0) - ((b / 9) | 0))
  const dc = Math.abs((a % 9) - (b % 9))
  return Math.max(dr, dc)
}

/**
 * How threatening each side looks around the enemy 玉.
 *
 * A piece within two squares of the enemy king is "attacking" it, and a 飛/角/金
 * near the king counts for more than a 歩. This is deliberately crude — the
 * search does the real work — but without it the engine happily trades off every
 * attacking piece it has.
 */
const ATTACK_WEIGHT_BY_PIECE = [0, 8, 10, 14, 20, 26, 34, 38, 0]

/**
 * The static evaluation of `pos`, in centipawns, from 先手's point of view.
 * Use `evaluate()` when you want it from the side to move's point of view.
 */
export function evaluateBlack(pos: Position): number {
  const board = pos.board
  let score = 0
  let blackAttackers = 0
  let whiteAttackers = 0
  const blackKing = pos.king(BLACK)
  const whiteKing = pos.king(WHITE)
  // kings of both colours are on the board in any legal position; if a search
  // ever evaluates a kingless position (a test), skip the attack term
  const kingsOk = blackKing >= 0 && whiteKing >= 0

  for (let sq = 0; sq < 81; sq++) {
    const code = board[sq]
    if (!code) continue
    const base = baseOf(code)
    const opponentKing = code > 0 ? whiteKing : blackKing
    if (kingsOk && base !== KING && kingDistance(sq, opponentKing) <= 2) {
      const weight = ATTACK_WEIGHT_BY_PIECE[base]
      if (code > 0) blackAttackers += weight
      else whiteAttackers += weight
    }
    if (base === KING) continue

    const value = pieceValue(code)
    const row = (sq / 9) | 0
    const col = sq % 9
    const placement =
      code > 0
        ? positionBonus(base, isPromoted(code), row, col)
        : positionBonus(base, isPromoted(code), 8 - row, 8 - col)

    score += code > 0 ? value + placement : -(value + placement)
  }

  // pieces in hand — for both sides, and 大駒 a little extra for the threat
  for (const color of [BLACK, WHITE] as Color[]) {
    const hand = pos.hand(color)
    let handScore = 0
    for (let type = PAWN; type <= ROOK; type++) {
      if (!hand[type]) continue
      handScore += hand[type] * HAND_VALUE[type]
      if (type === ROOK || type === BISHOP) handScore += 25
    }
    score += color === BLACK ? handScore : -handScore
  }

  // the attack term is deliberately capped: a pile of pieces next to the enemy
  // king matters, but it must never swamp real material
  const attack = Math.min(220, blackAttackers) - Math.min(220, whiteAttackers)
  score += attack

  return score
}

/** The evaluation from the side to move's point of view, with a small tempo bonus. */
export function evaluate(pos: Position): number {
  const score = evaluateBlack(pos)
  const tempo = 10
  return pos.turn === BLACK ? score + tempo : -score + tempo
}

/** For the UI's "who is ahead" readout: material balance in whole 歩. */
export function materialBalance(pos: Position): number {
  return Math.round(evaluateBlack(pos) / 90)
}
