/**
 * Names and notations.
 *
 * A shogi move has four useful spellings and each one is needed somewhere:
 *
 *   - USI       `7g7f` / `8h2b+` / `P*5e` — the engine's and the tests' lingua franca
 *   - KIF       ７六歩(77) / 同 銀 — what the move list shows a player
 *   - kanji     `歩` `香` `桂` … — what the pieces and the stands are labelled with
 *   - Japanese squares `７六` — the board's coordinates
 *
 * Everything in this file is a pure function of a position plus a move, so the
 * move list can be rebuilt from the game record without storing extra state.
 */
import {
  baseOf,
  BISHOP,
  BLACK,
  dropPiece,
  fileOf,
  GOLD,
  isPromoted,
  KING,
  KNIGHT,
  LANCE,
  moveFrom,
  movePromotes,
  moveTo,
  PAWN,
  Position,
  rankOf,
  ROOK,
  SILVER,
  type Color,
  type Move,
} from './position.ts'
import { isLegalMove } from './movegen.ts'

/** 歩 香 桂 銀 金 角 飛 玉, indexed by base piece code. */
export const PIECE_KANJI = ['', '歩', '香', '桂', '銀', '金', '角', '飛', '玉'] as const

/** と 成香 成桂 成銀 馬 龍 — a promoted 金/玉 does not exist. */
export const PROMOTED_KANJI = ['', 'と', '成香', '成桂', '成銀', '成金', '馬', '龍', '成玉'] as const

/** 一 二 三 … 九, for the ranks. */
export const KANJI_RANKS = ['一', '二', '三', '四', '五', '六', '七', '八', '九'] as const

/** １ ２ ３ … ９, full width, for the files. */
export const FULLWIDTH_FILES = ['１', '２', '３', '４', '５', '６', '７', '８', '９'] as const

/** The name shown for a piece in the UI — 玉 for 先手, 王 for 後手, as on a real set. */
export function pieceName(code: number): string {
  const base = baseOf(code)
  const promoted = isPromoted(code)
  if (base === KING) return code > 0 ? '玉' : '王'
  return promoted ? PROMOTED_KANJI[base] : PIECE_KANJI[base]
}

/** The same, for a piece in hand (never promoted, and colourless). */
export function handPieceName(base: number): string {
  return PIECE_KANJI[base]
}

/** How many points a piece is worth for the 27-point 入玉 declaration. */
export const DECLARATION_POINTS: Record<number, number> = {
  [ROOK]: 5,
  [BISHOP]: 5,
  [GOLD]: 1,
  [SILVER]: 1,
  [KNIGHT]: 1,
  [LANCE]: 1,
  [PAWN]: 1,
}

/** `７六` — the way a square is written on a board. */
export function squareName(sq: number): string {
  return `${FULLWIDTH_FILES[fileOf(sq) - 1]}${KANJI_RANKS[rankOf(sq) - 1]}`
}

/** `76` — the file and rank in half width, as KIF writes it in parentheses. */
export function squareNumber(sq: number): string {
  return `${fileOf(sq)}${rankOf(sq)}`
}

/** `7g` — the USI spelling of a square. */
export function usiSquare(sq: number): string {
  return `${fileOf(sq)}${'abcdefghi'[rankOf(sq) - 1]}`
}

const FILE_INDEX: Record<string, number> = { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9 }
const RANK_INDEX: Record<string, number> = {
  a: 1, b: 2, c: 3, d: 4, e: 5, f: 6, g: 7, h: 8, i: 9,
}

const DROP_LETTERS: Record<string, number> = {
  P: PAWN, L: LANCE, N: KNIGHT, S: SILVER, G: GOLD, B: BISHOP, R: ROOK,
}

/** `7g7f`, `8h2b+`, `P*5e` — the canonical text of a packed move. */
export function usiOf(move: Move): string {
  const drop = dropPiece(move)
  if (drop) {
    const letter = Object.keys(DROP_LETTERS).find((k) => DROP_LETTERS[k] === drop) ?? '?'
    return `${letter}*${usiSquare(moveTo(move))}`
  }
  return `${usiSquare(moveFrom(move))}${usiSquare(moveTo(move))}${movePromotes(move) ? '+' : ''}`
}

/**
 * Parse a USI move in the context of `pos` — `null` when the text does not name
 * a move that is legal in that position.
 *
 * Going through the legality test is what makes this safe to hand a game record
 * or a worker message: a string that has been tampered with, or that came from a
 * different position, can never drive `Position.make`.
 */
export function parseUsi(pos: Position, usi: string): Move | null {
  const text = usi.trim()
  if (!text) return null
  const from = text.slice(0, 2)
  const to = text.slice(2, 4)
  const promotes = text.endsWith('+')

  const toFile = FILE_INDEX[to[0]]
  const toRank = RANK_INDEX[to[1]]
  if (!toFile || !toRank) return null
  const toSq = (toRank - 1) * 9 + (9 - toFile)

  if (text[1] === '*') {
    const type = DROP_LETTERS[text[0].toUpperCase()]
    if (!type) return null
    const drop = packDropRaw(type, toSq)
    return isLegalMove(pos, drop) ? drop : null
  }

  const fromFile = FILE_INDEX[from[0]]
  const fromRank = RANK_INDEX[from[1]]
  if (!fromFile || !fromRank) return null
  const fromSq = (fromRank - 1) * 9 + (9 - fromFile)
  const move = fromSq | (toSq << 7) | (promotes ? 1 << 14 : 0)
  return isLegalMove(pos, move) ? move : null
}

/** Local copy of the drop packing, so this module need not import the codes. */
function packDropRaw(type: number, to: number): Move {
  return (1 << 14) | (type << 15) | (to << 7)
}

/**
 * The KIF text of `move` — such as ７六歩, 同 銀, or ５五角打.
 *
 * `previous` is the square the previous move landed on, which KIF abbreviates
 * to 同 rather than naming again; pass -1 at the start of a game.
 */
export function kifOf(pos: Position, move: Move, previousTo: number): string {
  const drop = dropPiece(move)
  const to = moveTo(move)
  const head = to === previousTo ? '同　' : squareName(to)

  if (drop) {
    const suffix = '打'
    return `${head}${PIECE_KANJI[drop]}${suffix}`
  }

  const code = pos.board[moveFrom(move)]
  const base = baseOf(code)
  const wasPromoted = isPromoted(code)
  const nowPromoted = movePromotes(move)

  // a piece that was already promoted keeps its promoted name; one that promotes
  // on this move gets it too; otherwise it is the plain piece. KIF shows the
  // origin square in parentheses for every board move: ２二角成(88)
  const name = wasPromoted || nowPromoted ? PROMOTED_KANJI[base] : PIECE_KANJI[base]
  return `${head}${name}(${squareNumber(moveFrom(move))})`
}

/** The 先手/後手 label a player sees. */
export function sideName(color: Color): string {
  return color === BLACK ? '先手' : '後手'
}

/** Which side a colour's pieces face: 先手 at the bottom, 後手 at the top. */
export function sideFacing(color: Color): 1 | -1 {
  return color === BLACK ? 1 : -1
}

/** `先手 7六歩` style description used by the CLI and the tests. */
export function describeMove(pos: Position, move: Move, previousTo: number): string {
  return `${sideName(pos.turn)} ${kifOf(pos, move, previousTo)}`
}

/**
 * The material points a side holds, for the 27-point 入玉 rule.
 *
 * 大駒 (飛・角, promoted or not) count 5, every other piece 1, and pieces in
 * hand count the same as pieces on the board.
 */
export function declarationPoints(pos: Position, color: Color): number {
  let points = 0
  for (let sq = 0; sq < 81; sq++) {
    const code = pos.board[sq]
    if (code * color <= 0) continue
    const base = baseOf(code)
    if (base === KING) continue
    points += base === ROOK || base === BISHOP ? 5 : 1
  }
  const hand = pos.hand(color)
  for (let type = PAWN; type <= ROOK; type++) {
    points += hand[type] * (type === ROOK || type === BISHOP ? 5 : 1)
  }
  return points
}

/** Is `color`'s 玉 in the enemy camp (ranks 1-3 for 先手, 7-9 for 後手)? */
export function kingInEnemyCamp(pos: Position, color: Color): boolean {
  const king = pos.king(color)
  if (king < 0) return false
  const rank = rankOf(king)
  return color === BLACK ? rank <= 3 : rank >= 7
}
