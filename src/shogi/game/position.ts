/**
 * The shogi board itself: piece codes, square maths, make/unmake, attack
 * detection and SFEN.
 *
 * Everything here is deliberately numeric. The rules engine is the part of the
 * game that has to be provably right, so the representation is a flat 81-slot
 * mailbox plus two small hands, and a move packs into one integer.
 */

/** Base piece codes, in the order they appear in SFEN. */
export const EMPTY = 0
export const PAWN = 1
export const LANCE = 2
export const KNIGHT = 3
export const SILVER = 4
export const GOLD = 5
export const BISHOP = 6
export const ROOK = 7
export const KING = 8

/**
 * Promoted pieces are the base code plus this offset, which keeps every lookup
 * a subtraction: と = 9 (PAWN + 8), 馬 = 14 (BISHOP + 8), 龍 = 15 (ROOK + 8).
 * 金 (5 + 8 = 13) and 玉 (8 + 8 = 16) never occur, because neither promotes.
 */
export const PROMOTED = 8

/** 先手 is +1, 後手 is -1, so a piece code carries its colour in its sign. */
export type Color = 1 | -1
export const BLACK: Color = 1
export const WHITE: Color = -1

export function other(color: Color): Color {
  return -color as Color
}

/** SFEN letters, indexed by base piece code. */
const LETTERS = ['', 'P', 'L', 'N', 'S', 'G', 'B', 'R', 'K']

export function baseOf(code: number): number {
  const a = code < 0 ? -code : code
  return a > PROMOTED ? a - PROMOTED : a
}

export function isPromoted(code: number): boolean {
  const a = code < 0 ? -code : code
  return a > PROMOTED
}

export function colorOf(code: number): Color {
  return code > 0 ? BLACK : WHITE
}

export function makeCode(base: number, color: Color, promoted = false): number {
  return (promoted ? base + PROMOTED : base) * color
}

export function pieceLetter(code: number): string {
  return LETTERS[baseOf(code)]
}

/** 金 and 玉 are the only pieces that can never promote. */
export function canPromoteBase(base: number): boolean {
  return base !== GOLD && base !== KING
}

/** A captured 龍 returns to hand as a 飛, so hands only ever hold these. */
export const HAND_TYPES = [ROOK, BISHOP, GOLD, SILVER, KNIGHT, LANCE, PAWN] as const

// ---------------------------------------------------------------------------
// squares
// ---------------------------------------------------------------------------

export const FILES = 9
export const RANKS = 9
export const SQUARES = 81

/**
 * Square index, `row * 9 + col`.
 *
 * Files run 9..1 across the board from 先手's point of view — file 9 is the
 * leftmost column — and ranks run 1..9 from the far side to 先手's side, so a
 * square is `(rank - 1) * 9 + (9 - file)`. 先手 therefore moves towards row 0
 * and 後手 towards row 8.
 */
export function square(file: number, rank: number): number {
  return (rank - 1) * 9 + (9 - file)
}

export function fileOf(sq: number): number {
  return 9 - (sq % 9)
}

export function rankOf(sq: number): number {
  return Math.floor(sq / 9) + 1
}

export function rowOf(sq: number): number {
  return Math.floor(sq / 9)
}

export function colOf(sq: number): number {
  return sq % 9
}

/** "76" for ７六, the way squares are written in Japanese. */
export function squareName(sq: number): string {
  return `${fileOf(sq)}${rankOf(sq)}`
}

/** 先手 promotes in ranks 1-3, 後手 in ranks 7-9. */
export function inPromotionZone(sq: number, color: Color): boolean {
  const row = rowOf(sq)
  return color === BLACK ? row <= 2 : row >= 6
}

/**
 * The last rank for a 歩/香, and the last two for a 桂, where the piece would
 * have no legal move at all (行き所のない駒). Such a drop is illegal, and a
 * move there must promote.
 */
export function wouldHaveNoMove(piece: number, sq: number, color: Color): boolean {
  const row = rowOf(sq)
  if (color === BLACK) {
    if (piece === PAWN || piece === LANCE) return row === 0
    if (piece === KNIGHT) return row <= 1
  } else {
    if (piece === PAWN || piece === LANCE) return row === 8
    if (piece === KNIGHT) return row >= 7
  }
  return false
}

// ---------------------------------------------------------------------------
// movement tables
// ---------------------------------------------------------------------------

/** 0-7 as (row, col) steps, starting up-left and going clockwise. */
const DR = [-1, -1, -1, 0, 0, 1, 1, 1]
const DC = [-1, 0, 1, -1, 1, -1, 0, 1]
const OPPOSITE = [7, 6, 5, 4, 3, 2, 1, 0]

function dirs(...list: number[]): number {
  let mask = 0
  for (const d of list) mask |= 1 << d
  return mask
}

/** `masks(base, promoted)` gives 先手's step and slide masks for a piece. */
function masks(base: number, promoted: boolean): { step: number; slide: number } {
  if (promoted) {
    if (base === BISHOP) return { step: dirs(1, 3, 4, 6), slide: dirs(0, 2, 5, 7) } // 馬: 角 + 玉の縦横
    if (base === ROOK) return { step: dirs(0, 2, 5, 7), slide: dirs(1, 3, 4, 6) } // 龍: 飛 + 玉の斜め
    // と・成香・成桂・成銀 all move exactly as a 金
    return { step: dirs(0, 1, 2, 3, 4, 6), slide: 0 }
  }
  switch (base) {
    case PAWN:
      return { step: dirs(1), slide: 0 }
    case LANCE:
      return { step: 0, slide: dirs(1) }
    case KNIGHT:
      return { step: 0, slide: 0 } // two-square jumps, handled separately
    case SILVER:
      return { step: dirs(0, 1, 2, 5, 7), slide: 0 }
    case GOLD:
      return { step: dirs(0, 1, 2, 3, 4, 6), slide: 0 }
    case BISHOP:
      return { step: 0, slide: dirs(0, 2, 5, 7) }
    case ROOK:
      return { step: 0, slide: dirs(1, 3, 4, 6) }
    default: // 玉
      return { step: dirs(0, 1, 2, 3, 4, 5, 6, 7), slide: 0 }
  }
}

const STEP: number[][] = [[], []]
const SLIDE: number[][] = [[], []]
for (let promoted = 0; promoted < 2; promoted++) {
  for (let base = 0; base <= KING; base++) {
    const m = masks(base, promoted === 1)
    STEP[promoted][base] = m.step
    SLIDE[promoted][base] = m.slide
  }
}

/** Mirror a direction mask vertically — that is all it takes to flip sides. */
const MIRROR = [5, 6, 7, 3, 4, 0, 1, 2]
function mirrorMask(mask: number): number {
  let out = 0
  for (let d = 0; d < 8; d++) if (mask & (1 << d)) out |= 1 << MIRROR[d]
  return out
}

function stepMask(code: number, color: Color): number {
  const mask = STEP[isPromoted(code) ? 1 : 0][baseOf(code)]
  return color === WHITE ? mirrorMask(mask) : mask
}

function slideMask(code: number, color: Color): number {
  const mask = SLIDE[isPromoted(code) ? 1 : 0][baseOf(code)]
  return color === WHITE ? mirrorMask(mask) : mask
}

// ---------------------------------------------------------------------------
// moves
// ---------------------------------------------------------------------------

/**
 * A move packed into one integer:
 *
 *   bits  0-6   from square (0-80), unused for drops
 *   bits  7-13  to square
 *   bit     14  promote, or "this is a drop"
 *   bits 15-17  dropped piece base type (1-7) for drops
 */
export type Move = number

export function packMove(from: number, to: number, promote: boolean): Move {
  return from | (to << 7) | (promote ? 1 << 14 : 0)
}

export function packDrop(piece: number, to: number): Move {
  return (1 << 14) | (piece << 15) | (to << 7)
}

export function moveFrom(move: Move): number {
  return move & 0x7f
}

export function moveTo(move: Move): number {
  return (move >> 7) & 0x7f
}

/**
 * Drops reuse bit 14 as their own flag, so a drop never counts as promoting.
 */
export function movePromotes(move: Move): boolean {
  return dropPiece(move) === 0 && (move & (1 << 14)) !== 0
}

export function dropPiece(move: Move): number {
  return (move >> 15) & 0x7
}

export function isDrop(move: Move): boolean {
  return ((move >> 15) & 0x7) !== 0
}

// ---------------------------------------------------------------------------
// position
// ---------------------------------------------------------------------------

/**
 * A mutable shogi position with make/unmake.
 *
 * Make and unmake are symmetrical through an internal stack, so `unmake()`
 * takes no arguments: it can never disagree with the move that was made.
 */
export class Position {
  board = new Int8Array(SQUARES)
  /** hands[0] is 先手's, hands[1] is 後手's; index by base piece code. */
  hands: [Int8Array, Int8Array] = [new Int8Array(PROMOTED), new Int8Array(PROMOTED)]
  turn: Color = BLACK
  moveNumber = 1
  /** 玉 squares, so a check test never has to scan the board. */
  kingSquare: [number, number] = [-1, -1]

  private undoFrom = new Int32Array(1024)
  private undoTo = new Int32Array(1024)
  private undoCaptured = new Int32Array(1024)
  private undoFlags = new Int32Array(1024)
  private undoKing = new Int32Array(2048)
  private plyCount = 0

  get ply(): number {
    return this.plyCount
  }

  clone(): Position {
    const p = new Position()
    p.board.set(this.board)
    p.hands[0].set(this.hands[0])
    p.hands[1].set(this.hands[1])
    p.turn = this.turn
    p.moveNumber = this.moveNumber
    p.kingSquare = [this.kingSquare[0], this.kingSquare[1]]
    return p
  }

  hand(color: Color): Int8Array {
    return this.hands[color === BLACK ? 0 : 1]
  }

  pieceAt(sq: number): number {
    return this.board[sq]
  }

  king(color: Color): number {
    return this.kingSquare[color === BLACK ? 0 : 1]
  }

  /** True when `sq` holds a piece belonging to `color`. */
  ownAt(sq: number, color: Color): boolean {
    return this.board[sq] * color > 0
  }

  make(move: Move): void {
    const ply = this.plyCount++
    const from = moveFrom(move)
    const to = moveTo(move)
    const promote = movePromotes(move)
    const drop = dropPiece(move)
    const mover = this.turn

    this.undoFrom[ply] = from
    this.undoTo[ply] = to
    this.undoCaptured[ply] = drop ? 0 : this.board[to]
    this.undoFlags[ply] = (promote ? 1 : 0) | (drop << 1) | (mover === BLACK ? 0 : 1 << 8)
    this.undoKing[ply * 2] = this.kingSquare[0]
    this.undoKing[ply * 2 + 1] = this.kingSquare[1]

    if (drop) {
      this.board[to] = drop * mover
      this.hand(mover)[drop] -= 1
    } else {
      const code = this.board[from]
      const captured = this.board[to]
      if (captured) this.hand(mover)[baseOf(captured)] += 1
      this.board[to] = promote ? (baseOf(code) + PROMOTED) * mover : code
      this.board[from] = 0
      if (baseOf(code) === KING) this.kingSquare[mover === BLACK ? 0 : 1] = to
    }

    this.turn = other(mover)
    this.moveNumber += 1
  }

  unmake(): void {
    const ply = --this.plyCount
    const from = this.undoFrom[ply]
    const to = this.undoTo[ply]
    const flags = this.undoFlags[ply]
    const promote = (flags & 1) !== 0
    const drop = (flags >> 1) & 0x7
    const mover: Color = flags & (1 << 8) ? WHITE : BLACK

    if (drop) {
      this.board[to] = 0
      this.hand(mover)[drop] += 1
    } else {
      // `baseOf` already strips the promotion, so this must not strip it again
      const code = this.board[to]
      this.board[from] = promote ? baseOf(code) * mover : code
      const captured = this.undoCaptured[ply]
      this.board[to] = captured
      if (captured) this.hand(mover)[baseOf(captured)] -= 1
    }

    this.kingSquare[0] = this.undoKing[ply * 2]
    this.kingSquare[1] = this.undoKing[ply * 2 + 1]
    this.turn = mover
    this.moveNumber -= 1
  }

  // -------------------------------------------------------------------------

  /**
   * Is `sq` attacked by any piece of `byColor`?
   *
   * Walks outwards from the square rather than over the board: two 桂 jumps,
   * the eight neighbours, then the eight rays for sliders.
   */
  isAttacked(sq: number, byColor: Color): boolean {
    const board = this.board
    const r = (sq / 9) | 0
    const c = sq % 9

    // a 桂 attacks from two rows behind it, in the attacker's own direction
    const kr = byColor === BLACK ? r + 2 : r - 2
    if (kr >= 0 && kr < 9) {
      for (let d = -1; d <= 1; d += 2) {
        const cc = c + d
        if (cc < 0 || cc > 8) continue
        const code = board[kr * 9 + cc]
        if (code && colorOf(code) === byColor && baseOf(code) === KNIGHT && !isPromoted(code)) {
          return true
        }
      }
    }

    for (let d = 0; d < 8; d++) {
      const bit = 1 << OPPOSITE[d]
      let rr = r + DR[d]
      let cc = c + DC[d]
      let dist = 1

      // Walk the ray outwards. The *first* piece along it is the only one that
      // can attack `sq`, so stop there — a blocker shields everything behind it.
      while (rr >= 0 && rr <= 8 && cc >= 0 && cc <= 8) {
        const code = board[rr * 9 + cc]
        if (code) {
          if (colorOf(code) === byColor) {
            // a step attacker only reaches one square; a slider reaches any
            if (dist === 1 && stepMask(code, byColor) & bit) return true
            if (slideMask(code, byColor) & bit) return true
          }
          break
        }
        rr += DR[d]
        cc += DC[d]
        dist += 1
      }
    }
    return false
  }

  inCheck(color: Color = this.turn): boolean {
    const king = this.king(color)
    return king >= 0 && this.isAttacked(king, other(color))
  }

  // -------------------------------------------------------------------------
  // SFEN
  // -------------------------------------------------------------------------

  toSfen(): string {
    const rows: string[] = []
    for (let r = 0; r < 9; r++) {
      let row = ''
      let empty = 0
      for (let c = 0; c < 9; c++) {
        const code = this.board[r * 9 + c]
        if (!code) {
          empty += 1
          continue
        }
        if (empty) {
          row += String(empty)
          empty = 0
        }
        const letter = pieceLetter(code)
        row += (isPromoted(code) ? '+' : '') + (colorOf(code) === WHITE ? letter.toLowerCase() : letter)
      }
      if (empty) row += String(empty)
      rows.push(row)
    }

    // both hands are listed: 先手 in upper case, 後手 in lower, most valuable first
    let handText = ''
    for (const type of HAND_TYPES) {
      for (const color of [BLACK, WHITE] as Color[]) {
        const n = this.hand(color)[type]
        if (!n) continue
        handText += (n > 1 ? String(n) : '') +
          (color === BLACK ? pieceLetter(type) : pieceLetter(type).toLowerCase())
      }
    }

    return `${rows.join('/')} ${this.turn === BLACK ? 'b' : 'w'} ${handText || '-'} ${this.moveNumber}`
  }

  static fromSfen(sfen: string): Position {
    const parts = sfen.trim().split(/\s+/)
    const rows = parts[0].split('/')
    if (rows.length !== 9) throw new Error(`bad SFEN board field: ${parts[0]}`)

    const pos = new Position()
    for (let r = 0; r < 9; r++) {
      let c = 0
      let promoted = false
      for (const ch of rows[r]) {
        if (ch === '+') {
          promoted = true
          continue
        }
        if (ch >= '1' && ch <= '9') {
          c += Number(ch)
          promoted = false
          continue
        }
        const base = LETTERS.indexOf(ch.toUpperCase())
        if (!base) throw new Error(`bad SFEN piece: ${ch}`)
        const color: Color = ch === ch.toUpperCase() ? BLACK : WHITE
        const code = makeCode(base, color, promoted)
        pos.board[r * 9 + c] = code
        if (base === KING) pos.kingSquare[color === BLACK ? 0 : 1] = r * 9 + c
        c += 1
        promoted = false
      }
      if (c !== 9) throw new Error(`SFEN rank ${r + 1} covers ${c} files`)
    }

    pos.turn = parts[1] === 'w' ? WHITE : BLACK

    const handText = parts[2] ?? '-'
    if (handText !== '-') {
      let count = 0
      for (const ch of handText) {
        if (ch >= '0' && ch <= '9') {
          count = count * 10 + Number(ch)
          continue
        }
        const base = LETTERS.indexOf(ch.toUpperCase())
        if (!base) throw new Error(`bad SFEN hand piece: ${ch}`)
        const color: Color = ch === ch.toUpperCase() ? BLACK : WHITE
        pos.hand(color)[base] += count || 1
        count = 0
      }
    }

    pos.moveNumber = Number(parts[3] ?? '1') || 1
    return pos
  }

  /**
   * A repetition key — board, both hands and the side to move. Two positions
   * are the same for 千日手 purposes exactly when these strings match.
   */
  key(): string {
    let out = ''
    for (let i = 0; i < SQUARES; i++) out += String.fromCharCode(this.board[i] + 24)
    out += '|'
    for (const color of [BLACK, WHITE] as Color[]) {
      const hand = this.hand(color)
      for (const type of HAND_TYPES) out += String.fromCharCode(hand[type] + 34)
      out += ':'
    }
    return out + (this.turn === BLACK ? 'b' : 'w')
  }
}

/** Every square a piece on `sq` attacks, appended to `out`. Returns the count. */
export function attacksFrom(pos: Position, sq: number, out: number[]): number {
  const code = pos.board[sq]
  const start = out.length
  if (!code) return 0
  const color = colorOf(code)
  const r = (sq / 9) | 0
  const c = sq % 9
  const board = pos.board
  const base = baseOf(code)

  if (base === KNIGHT && !isPromoted(code)) {
    const dr = color === BLACK ? -2 : 2
    for (let d = -1; d <= 1; d += 2) {
      const rr = r + dr
      const cc = c + d
      if (rr < 0 || rr > 8 || cc < 0 || cc > 8) continue
      if (board[rr * 9 + cc] * color <= 0) out.push(rr * 9 + cc)
    }
    return out.length - start
  }

  const step = stepMask(code, color)
  for (let d = 0; d < 8; d++) {
    if (!(step & (1 << d))) continue
    const rr = r + DR[d]
    const cc = c + DC[d]
    if (rr < 0 || rr > 8 || cc < 0 || cc > 8) continue
    if (board[rr * 9 + cc] * color <= 0) out.push(rr * 9 + cc)
  }

  const slide = slideMask(code, color)
  for (let d = 0; d < 8; d++) {
    if (!(slide & (1 << d))) continue
    let rr = r + DR[d]
    let cc = c + DC[d]
    while (rr >= 0 && rr <= 8 && cc >= 0 && cc <= 8) {
      const target = board[rr * 9 + cc]
      if (target * color <= 0) out.push(rr * 9 + cc)
      if (target) break
      rr += DR[d]
      cc += DC[d]
    }
  }
  return out.length - start
}

/** 先手's 桂 jumps, used by the move generator. */
export function knightTargets(sq: number, color: Color): number[] {
  const r = (sq / 9) | 0
  const c = sq % 9
  const dr = color === BLACK ? -2 : 2
  const out: number[] = []
  for (let d = -1; d <= 1; d += 2) {
    const rr = r + dr
    const cc = c + d
    if (rr < 0 || rr > 8 || cc < 0 || cc > 8) continue
    out.push(rr * 9 + cc)
  }
  return out
}
