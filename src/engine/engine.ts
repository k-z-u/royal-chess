/*
 * A compact alpha-beta chess engine.
 * Board representation: 64 entries, 0 = empty.
 *   1..6  = white P N B R Q K
 *   7..12 = black P N B R Q K
 * Moves are packed integers.
 */

export const WHITE = 0
export const BLACK = 1

const EMPTY = 0
const wP = 1
const wN = 2
const wB = 3
const wR = 4
const wQ = 5
const wK = 6
const bP = 7
const bN = 8
const bB = 9
const bR = 10
const bQ = 11
const bK = 12

export const PAWN = 1
export const KNIGHT = 2
export const BISHOP = 3
export const ROOK = 4
export const QUEEN = 5
export const KING = 6

const FLAG_CAPTURE = 1
const FLAG_EP = 2
const FLAG_CASTLE = 4
const FLAG_DPP = 8
const FLAG_PROMO = 16

/** promotion codes 2..5 map to n,b,r,q */
const PROMO_CHARS = ['n', 'b', 'r', 'q']

const MATE = 30000
const INF = 40000

export interface EngineMove {
  from: number
  to: number
  promo: number
  flag: number
}

export function packMove(from: number, to: number, promo = 0, flag = 0) {
  return from | (to << 6) | (promo << 12) | (flag << 15)
}
const mFrom = (m: number) => m & 63
const mTo = (m: number) => (m >> 6) & 63
const mPromo = (m: number) => (m >> 12) & 7
const mFlag = (m: number) => (m >> 15) & 31

export function moveToString(m: number) {
  const files = 'abcdefgh'
  const from = mFrom(m)
  const to = mTo(m)
  const p = mPromo(m)
  const promo = p ? PROMO_CHARS[p - 2] : ''
  return `${files[from & 7]}${(from >> 3) + 1}${files[to & 7]}${(to >> 3) + 1}${promo}`
}

export function stringToSq(s: string) {
  return (s.charCodeAt(1) - 49) * 8 + (s.charCodeAt(0) - 97)
}

interface State {
  board: Int8Array
  side: number
  castling: number
  ep: number
  halfmove: number
  fullmove: number
  kings: [number, number]
}

function pieceColor(pc: number) {
  return pc <= wK ? WHITE : BLACK
}
function pieceType(pc: number) {
  return pc <= wK ? pc : pc - 6
}
function makePiece(color: number, type: number) {
  return color === WHITE ? type : type + 6
}

const CASTLE_WK = 1
const CASTLE_WQ = 2
const CASTLE_BK = 4
const CASTLE_BQ = 8

const KNIGHT_DELTAS = [17, 15, 10, 6, -6, -10, -15, -17]
const BISHOP_DIRS = [9, 7, -7, -9]
const ROOK_DIRS = [8, -8, 1, -1]
const KING_DIRS = [8, -8, 1, -1, 9, 7, -7, -9]

function fileOf(s: number) {
  return s & 7
}
function rankOf(s: number) {
  return s >> 3
}

function onBoard(s: number) {
  return s >= 0 && s < 64
}

export function boardFromFen(fen: string): State {
  const parts = fen.trim().split(/\s+/)
  const board = new Int8Array(64)
  let sq = 56
  const map: Record<string, number> = {
    P: wP, N: wN, B: wB, R: wR, Q: wQ, K: wK,
    p: bP, n: bN, b: bB, r: bR, q: bQ, k: bK,
  }
  for (const ch of parts[0]) {
    if (ch === '/') {
      sq -= 16
    } else if (ch >= '1' && ch <= '8') {
      sq += Number(ch)
    } else {
      board[sq] = map[ch]
      sq++
    }
  }
  let castling = 0
  if (parts[2]?.includes('K')) castling |= CASTLE_WK
  if (parts[2]?.includes('Q')) castling |= CASTLE_WQ
  if (parts[2]?.includes('k')) castling |= CASTLE_BK
  if (parts[2]?.includes('q')) castling |= CASTLE_BQ
  const kings: [number, number] = [0, 0]
  for (let i = 0; i < 64; i++) {
    if (board[i] === wK) kings[0] = i
    else if (board[i] === bK) kings[1] = i
  }
  return {
    board,
    side: parts[1] === 'b' ? BLACK : WHITE,
    castling,
    ep: parts[3] && parts[3] !== '-' ? stringToSq(parts[3]) : -1,
    halfmove: parts[4] ? Number(parts[4]) : 0,
    fullmove: parts[5] ? Number(parts[5]) : 1,
    kings,
  }
}

function isAttacked(st: State, sq: number, by: number): boolean {
  const b = st.board
  // pawns
  if (by === WHITE) {
    if (onBoard(sq - 7) && fileOf(sq - 7) === fileOf(sq) + 1 && b[sq - 7] === wP) return true
    if (onBoard(sq - 9) && fileOf(sq - 9) === fileOf(sq) - 1 && b[sq - 9] === wP) return true
  } else {
    if (onBoard(sq + 7) && fileOf(sq + 7) === fileOf(sq) - 1 && b[sq + 7] === bP) return true
    if (onBoard(sq + 9) && fileOf(sq + 9) === fileOf(sq) + 1 && b[sq + 9] === bP) return true
  }
  const knight = makePiece(by, KNIGHT)
  for (const d of KNIGHT_DELTAS) {
    const t = sq + d
    if (!onBoard(t)) continue
    const df = Math.abs(fileOf(t) - fileOf(sq))
    const dr = Math.abs(rankOf(t) - rankOf(sq))
    if (df * dr === 2 && b[t] === knight) return true
  }
  const bishop = makePiece(by, BISHOP)
  const queen = makePiece(by, QUEEN)
  for (const d of BISHOP_DIRS) {
    let t = sq + d
    let prev = sq
    while (onBoard(t) && Math.abs(fileOf(t) - fileOf(prev)) <= 1) {
      const pc = b[t]
      if (pc) {
        if ((pc === bishop || pc === queen) && pieceColor(pc) === by) return true
        break
      }
      prev = t
      t += d
    }
  }
  const rook = makePiece(by, ROOK)
  for (const d of ROOK_DIRS) {
    let t = sq + d
    let prev = sq
    while (onBoard(t) && Math.abs(fileOf(t) - fileOf(prev)) <= 1) {
      const pc = b[t]
      if (pc) {
        if ((pc === rook || pc === queen) && pieceColor(pc) === by) return true
        break
      }
      prev = t
      t += d
    }
  }
  const king = makePiece(by, KING)
  for (const d of KING_DIRS) {
    const t = sq + d
    if (onBoard(t) && Math.abs(fileOf(t) - fileOf(sq)) <= 1 && b[t] === king) return true
  }
  return false
}

function addPawnMoves(st: State, from: number, out: number[]) {
  const b = st.board
  const color = st.side
  const dir = color === WHITE ? 8 : -8
  const startRank = color === WHITE ? 1 : 6
  const promoRank = color === WHITE ? 7 : 0
  const one = from + dir
  const epSq = st.ep
  for (const df of [-1, 1]) {
    const t = from + dir + df
    if (!onBoard(t)) continue
    if (Math.abs(fileOf(t) - fileOf(from)) !== 1) continue
    const pc = b[t]
    if (pc && pieceColor(pc) !== color) {
      if (rankOf(t) === promoRank) {
        for (let p = 2; p <= 5; p++) out.push(packMove(from, t, p, FLAG_CAPTURE | FLAG_PROMO))
      } else {
        out.push(packMove(from, t, 0, FLAG_CAPTURE))
      }
    } else if (!pc && t === epSq) {
      out.push(packMove(from, t, 0, FLAG_CAPTURE | FLAG_EP))
    }
  }
  if (!b[one]) {
    if (rankOf(one) === promoRank) {
      for (let p = 2; p <= 5; p++) out.push(packMove(from, one, p, FLAG_PROMO))
    } else {
      out.push(packMove(from, one))
      const two = from + dir * 2
      if (rankOf(from) === startRank && !b[two]) out.push(packMove(from, two, 0, FLAG_DPP))
    }
  }
}

function addJumpMoves(st: State, from: number, deltas: number[], out: number[]) {
  const b = st.board
  const color = st.side
  for (const d of deltas) {
    const t = from + d
    if (!onBoard(t)) continue
    const df = Math.abs(fileOf(t) - fileOf(from))
    const dr = Math.abs(rankOf(t) - rankOf(from))
    const knightStep = df * dr === 2
    const kingStep = df <= 1 && dr <= 1 && df + dr >= 1
    if (knightStep || kingStep) {
      const pc = b[t]
      if (!pc) out.push(packMove(from, t))
      else if (pieceColor(pc) !== color) out.push(packMove(from, t, 0, FLAG_CAPTURE))
    }
  }
}

function addSlideMoves(st: State, from: number, dirs: number[], out: number[]) {
  const b = st.board
  const color = st.side
  for (const d of dirs) {
    let t = from + d
    let prev = from
    while (onBoard(t) && Math.abs(fileOf(t) - fileOf(prev)) <= 1) {
      const pc = b[t]
      if (!pc) {
        out.push(packMove(from, t))
      } else {
        if (pieceColor(pc) !== color) out.push(packMove(from, t, 0, FLAG_CAPTURE))
        break
      }
      prev = t
      t += d
    }
  }
}

function addCastles(st: State, out: number[]) {
  const b = st.board
  const color = st.side
  const kingSq = st.kings[color]
  const enemy = color === WHITE ? BLACK : WHITE
  if (color === WHITE) {
    if (kingSq !== 4) return
    if (st.castling & CASTLE_WK && !b[5] && !b[6] && b[7] === wR) {
      if (!isAttacked(st, 4, enemy) && !isAttacked(st, 5, enemy) && !isAttacked(st, 6, enemy))
        out.push(packMove(4, 6, 0, FLAG_CASTLE))
    }
    if (st.castling & CASTLE_WQ && !b[3] && !b[2] && !b[1] && b[0] === wR) {
      if (!isAttacked(st, 4, enemy) && !isAttacked(st, 3, enemy) && !isAttacked(st, 2, enemy))
        out.push(packMove(4, 2, 0, FLAG_CASTLE))
    }
  } else {
    if (kingSq !== 60) return
    if (st.castling & CASTLE_BK && !b[61] && !b[62] && b[63] === bR) {
      if (!isAttacked(st, 60, enemy) && !isAttacked(st, 61, enemy) && !isAttacked(st, 62, enemy))
        out.push(packMove(60, 62, 0, FLAG_CASTLE))
    }
    if (st.castling & CASTLE_BQ && !b[59] && !b[58] && !b[57] && b[56] === bR) {
      if (!isAttacked(st, 60, enemy) && !isAttacked(st, 59, enemy) && !isAttacked(st, 58, enemy))
        out.push(packMove(60, 58, 0, FLAG_CASTLE))
    }
  }
}

function genPseudo(st: State, capturesOnly: boolean): number[] {
  const b = st.board
  const color = st.side
  const out: number[] = []
  for (let s = 0; s < 64; s++) {
    const pc = b[s]
    if (!pc || pieceColor(pc) !== color) continue
    const type = pieceType(pc)
    switch (type) {
      case PAWN:
        addPawnMoves(st, s, out)
        break
      case KNIGHT:
        addJumpMoves(st, s, KNIGHT_DELTAS, out)
        break
      case BISHOP:
        addSlideMoves(st, s, BISHOP_DIRS, out)
        break
      case ROOK:
        addSlideMoves(st, s, ROOK_DIRS, out)
        break
      case QUEEN:
        addSlideMoves(st, s, [...BISHOP_DIRS, ...ROOK_DIRS], out)
        break
      case KING:
        addJumpMoves(st, s, KING_DIRS, out)
        break
    }
  }
  if (!capturesOnly) {
    addCastles(st, out)
    return out
  }
  // quiescence must only look at forcing moves, otherwise the tree explodes
  return out.filter((m) => (mFlag(m) & (FLAG_CAPTURE | FLAG_PROMO)) !== 0)
}

interface Undo {
  move: number
  captured: number
  capturedSq: number
  castling: number
  ep: number
  halfmove: number
  kings: [number, number]
}

function makeMove(st: State, m: number): Undo {
  const b = st.board
  const from = mFrom(m)
  const to = mTo(m)
  const flag = mFlag(m)
  const piece = b[from]
  const color = st.side
  const undo: Undo = {
    move: m,
    captured: EMPTY,
    capturedSq: to,
    castling: st.castling,
    ep: st.ep,
    halfmove: st.halfmove,
    kings: [st.kings[0], st.kings[1]],
  }

  if (flag & FLAG_EP) {
    const capSq = color === WHITE ? to - 8 : to + 8
    undo.captured = b[capSq]
    undo.capturedSq = capSq
    b[capSq] = EMPTY
  } else if (b[to]) {
    undo.captured = b[to]
  }

  b[from] = EMPTY
  b[to] = flag & FLAG_PROMO ? makePiece(color, mPromo(m)) : piece

  if (pieceType(piece) === KING) {
    st.kings[color] = to
    st.castling &= color === WHITE ? ~(CASTLE_WK | CASTLE_WQ) : ~(CASTLE_BK | CASTLE_BQ)
    if (flag & FLAG_CASTLE) {
      if (to === 6) { b[7] = EMPTY; b[5] = wR }
      else if (to === 2) { b[0] = EMPTY; b[3] = wR }
      else if (to === 62) { b[63] = EMPTY; b[61] = bR }
      else if (to === 58) { b[56] = EMPTY; b[59] = bR }
    }
  }
  if (from === 0 || to === 0) st.castling &= ~CASTLE_WQ
  if (from === 7 || to === 7) st.castling &= ~CASTLE_WK
  if (from === 56 || to === 56) st.castling &= ~CASTLE_BQ
  if (from === 63 || to === 63) st.castling &= ~CASTLE_BK

  st.ep = -1
  if (flag & FLAG_DPP) {
    st.ep = color === WHITE ? from + 8 : from - 8
  }
  st.halfmove = undo.captured || pieceType(piece) === PAWN ? 0 : st.halfmove + 1
  if (color === BLACK) st.fullmove++
  st.side = color === WHITE ? BLACK : WHITE
  return undo
}

function unmakeMove(st: State, u: Undo) {
  const b = st.board
  const m = u.move
  const from = mFrom(m)
  const to = mTo(m)
  const flag = mFlag(m)
  const color = st.side === WHITE ? BLACK : WHITE

  st.side = color
  if (color === BLACK) st.fullmove--
  st.castling = u.castling
  st.ep = u.ep
  st.halfmove = u.halfmove
  st.kings[0] = u.kings[0]
  st.kings[1] = u.kings[1]

  if (flag & FLAG_PROMO) {
    b[from] = makePiece(color, PAWN)
  } else {
    b[from] = b[to]
  }
  b[to] = EMPTY
  if (u.captured) {
    b[u.capturedSq] = u.captured
  }
  if (flag & FLAG_CASTLE) {
    if (to === 6) { b[5] = EMPTY; b[7] = wR }
    else if (to === 2) { b[3] = EMPTY; b[0] = wR }
    else if (to === 62) { b[61] = EMPTY; b[63] = bR }
    else if (to === 58) { b[59] = EMPTY; b[56] = bR }
  }
}

function inCheck(st: State, color: number) {
  return isAttacked(st, st.kings[color], color === WHITE ? BLACK : WHITE)
}

export function legalMoves(st: State): number[] {
  const out: number[] = []
  const color = st.side
  for (const m of genPseudo(st, false)) {
    const u = makeMove(st, m)
    if (!inCheck(st, color)) out.push(m)
    unmakeMove(st, u)
  }
  return out
}

/** Move-generator self-check: node count for a fixed depth. */
export function perft(fen: string, depth: number): number {
  const st = boardFromFen(fen)
  function rec(d: number): number {
    if (d === 0) return 1
    const color = st.side
    let n = 0
    for (const m of genPseudo(st, false)) {
      const u = makeMove(st, m)
      if (!inCheck(st, color)) n += rec(d - 1)
      unmakeMove(st, u)
    }
    return n
  }
  return rec(depth)
}

/* ------------------------------------------------------------------ */
/* Evaluation                                                          */
/* ------------------------------------------------------------------ */

const MG_VALUE = [0, 82, 337, 365, 477, 1025, 0]
const EG_VALUE = [0, 94, 281, 297, 512, 936, 0]

const MG_PAWN = [
  0, 0, 0, 0, 0, 0, 0, 0,
  98, 134, 61, 95, 68, 126, 34, -11,
  -6, 7, 26, 31, 65, 56, 25, -20,
  -14, 13, 6, 21, 23, 12, 17, -23,
  -27, -2, -5, 12, 17, 6, 10, -25,
  -26, -4, -4, -10, 3, 3, 33, -12,
  -35, -1, -20, -23, -15, 24, 38, -22,
  0, 0, 0, 0, 0, 0, 0, 0,
]
const EG_PAWN = [
  0, 0, 0, 0, 0, 0, 0, 0,
  178, 173, 158, 134, 147, 132, 165, 187,
  94, 100, 85, 67, 56, 53, 82, 84,
  32, 24, 13, 5, -2, 4, 17, 17,
  13, 9, -3, -7, -7, -8, 3, -1,
  4, 7, -6, 1, 0, -5, -1, -8,
  13, 8, 8, 10, 13, 0, 2, -7,
  0, 0, 0, 0, 0, 0, 0, 0,
]
const MG_KNIGHT = [
  -167, -89, -34, -49, 61, -97, -15, -107,
  -73, -41, 72, 36, 23, 62, 7, -17,
  -47, 60, 37, 65, 84, 129, 73, 44,
  -9, 17, 19, 53, 37, 69, 18, 22,
  -13, 4, 16, 13, 28, 19, 21, -8,
  -23, -9, 12, 10, 19, 17, 25, -16,
  -29, -53, -12, -3, -1, 18, -14, -19,
  -105, -21, -58, -33, -17, -28, -19, -23,
]
const EG_KNIGHT = [
  -58, -38, -13, -28, -31, -27, -63, -99,
  -25, -8, -25, -2, -9, -25, -24, -52,
  -24, -20, 10, 9, -1, -9, -19, -41,
  -17, 3, 22, 22, 22, 11, 8, -18,
  -18, -6, 16, 25, 16, 17, 4, -18,
  -23, -3, -1, 15, 10, -3, -20, -22,
  -42, -20, -10, -5, -2, -20, -23, -44,
  -29, -51, -23, -15, -22, -18, -50, -64,
]
const MG_BISHOP = [
  -29, 4, -82, -37, -25, -42, 7, -8,
  -26, 16, -18, -13, 30, 59, 18, -47,
  -16, 37, 43, 40, 35, 50, 37, -2,
  -4, 5, 19, 50, 37, 37, 7, -2,
  -6, 13, 13, 26, 34, 12, 10, 4,
  0, 15, 15, 15, 14, 27, 18, 10,
  4, 15, 16, 0, 7, 21, 33, 1,
  -33, -3, -14, -21, -13, -12, -39, -21,
]
const EG_BISHOP = [
  -14, -21, -11, -8, -7, -9, -17, -24,
  -8, -4, 7, -12, -3, -13, -4, -14,
  2, -8, 0, -1, -2, 6, 0, 4,
  -3, 9, 12, 9, 14, 10, 3, 2,
  -6, 3, 13, 19, 7, 10, -3, -9,
  -12, -3, 8, 10, 13, 3, -7, -15,
  -14, -18, -7, -1, 4, -9, -15, -27,
  -23, -9, -23, -5, -9, -16, -5, -17,
]
const MG_ROOK = [
  32, 42, 32, 51, 63, 9, 31, 43,
  27, 32, 58, 62, 80, 67, 26, 44,
  -5, 19, 26, 36, 17, 45, 61, 16,
  -24, -11, 7, 26, 24, 35, -8, -20,
  -36, -26, -12, -1, 9, -7, 6, -23,
  -45, -25, -16, -17, 3, 0, -5, -33,
  -44, -16, -20, -9, -1, 11, -6, -71,
  -19, -13, 1, 17, 16, 7, -37, -26,
]
const EG_ROOK = [
  13, 10, 18, 15, 12, 12, 8, 5,
  11, 13, 13, 11, -3, 3, 8, 3,
  7, 7, 7, 5, 4, -3, -5, -3,
  4, 3, 13, 1, 2, 1, -1, 2,
  3, 5, 8, 4, -5, -6, -8, -11,
  -4, 0, -5, -1, -7, -12, -8, -16,
  -6, -6, 0, 2, -9, -9, -11, -3,
  -9, 2, 3, -1, -5, -13, 4, -20,
]
const MG_QUEEN = [
  -28, 0, 29, 12, 59, 44, 43, 45,
  -24, -39, -5, 1, -16, 57, 28, 54,
  -13, -17, 7, 8, 29, 56, 47, 57,
  -27, -27, -16, -16, -1, 17, -2, 1,
  -9, -26, -9, -10, -2, -4, 3, -3,
  -14, 2, -11, -2, -5, 2, 14, 5,
  -35, -8, 11, 2, 8, 15, -3, 1,
  -1, -18, -9, 10, -15, -25, -31, -50,
]
const EG_QUEEN = [
  -9, 22, 22, 27, 27, 19, 10, 20,
  -17, 20, 32, 41, 58, 25, 30, 0,
  -20, 6, 9, 49, 47, 35, 19, 9,
  3, 22, 24, 45, 57, 40, 57, 36,
  -18, 28, 19, 47, 31, 34, 39, 23,
  -16, -27, 15, 6, 9, 17, 10, 5,
  -22, -23, -30, -16, -16, -23, -36, -32,
  -33, -28, -22, -43, -5, -32, -20, -41,
]
const MG_KING = [
  -65, 23, 16, -15, -56, -34, 2, 13,
  29, -1, -20, -7, -8, -4, -38, -29,
  -9, 24, 2, -16, -20, 6, 22, -22,
  -17, -20, -12, -27, -30, -25, -14, -36,
  -49, -1, -27, -39, -46, -44, -33, -51,
  -14, -14, -22, -46, -44, -30, -15, -27,
  1, 7, -8, -64, -43, -16, 9, 8,
  -15, 36, 12, -54, 8, -28, 24, 14,
]
const EG_KING = [
  -74, -35, -18, -18, -11, 15, 4, -17,
  -12, 17, 14, 17, 17, 38, 23, 11,
  10, 17, 23, 15, 20, 45, 44, 13,
  -8, 22, 24, 27, 26, 33, 26, 3,
  -18, -4, 21, 24, 27, 23, 9, -11,
  -19, -3, 11, 21, 23, 16, 7, -9,
  -27, -11, 4, 13, 14, 4, -5, -17,
  -53, -34, -21, -11, -28, -14, -24, -43,
]

const MG_TABLE = [null, MG_PAWN, MG_KNIGHT, MG_BISHOP, MG_ROOK, MG_QUEEN, MG_KING] as const
const EG_TABLE = [null, EG_PAWN, EG_KNIGHT, EG_BISHOP, EG_ROOK, EG_QUEEN, EG_KING] as const

const PHASE = [0, 0, 1, 1, 2, 4, 0]
const PASSED_BONUS = [0, 12, 18, 30, 55, 95, 140, 0]

function evaluate(st: State): number {
  const b = st.board
  let mg = 0
  let eg = 0
  let phase = 0
  let wBishops = 0
  let bBishops = 0

  for (let s = 0; s < 64; s++) {
    const pc = b[s]
    if (!pc) continue
    const color = pieceColor(pc)
    const type = pieceType(pc)
    phase += PHASE[type]
    const idx = color === WHITE ? s ^ 56 : s
    const mgv = MG_VALUE[type] + MG_TABLE[type]![idx]
    const egv = EG_VALUE[type] + EG_TABLE[type]![idx]
    if (color === WHITE) {
      mg += mgv
      eg += egv
      if (type === BISHOP) wBishops++
    } else {
      mg -= mgv
      eg -= egv
      if (type === BISHOP) bBishops++
    }
  }

  if (wBishops >= 2) { mg += 24; eg += 40 }
  if (bBishops >= 2) { mg -= 24; eg -= 40 }

  // passed pawn probe (cheap, rank based)
  for (let s = 0; s < 64; s++) {
    const pc = b[s]
    if (pc !== wP && pc !== bP) continue
    const file = fileOf(s)
    const rank = rankOf(s)
    const isWhite = pc === wP
    let blocked = false
    for (let r = rank + (isWhite ? 1 : -1); r >= 0 && r < 8 && !blocked; r += isWhite ? 1 : -1) {
      for (let f = Math.max(0, file - 1); f <= Math.min(7, file + 1); f++) {
        const pc2 = b[r * 8 + f]
        if (pc2 === (isWhite ? bP : wP)) { blocked = true; break }
      }
    }
    if (!blocked) {
      const rFromHome = isWhite ? rank : 7 - rank
      if (isWhite) { mg += PASSED_BONUS[rFromHome]; eg += PASSED_BONUS[rFromHome] * 1.5 }
      else { mg -= PASSED_BONUS[rFromHome]; eg -= PASSED_BONUS[rFromHome] * 1.5 }
    }
  }

  const totalPhase = 24
  const ph = Math.min(phase, totalPhase) / totalPhase
  const score = (mg * ph + eg * (1 - ph)) | 0
  return st.side === WHITE ? score : -score
}

/* ------------------------------------------------------------------ */
/* Search                                                              */
/* ------------------------------------------------------------------ */

const MVV = [0, 100, 320, 330, 500, 900, 20000]

class Searcher {
  st: State
  nodes = 0
  stopAt = Infinity
  stopped = false
  killers: number[][] = Array.from({ length: 64 }, () => [0, 0])
  history: Int32Array = new Int32Array(64 * 64)
  tt: Map<number, { depth: number; score: number; flag: number; move: number }> = new Map()
  ttLimit = 300000

  constructor(fen: string, timeMs: number) {
    this.st = boardFromFen(fen)
    this.stopAt = Date.now() + timeMs
  }

  private timeUp() {
    if (this.stopped) return true
    if ((this.nodes & 1023) === 0 && Date.now() > this.stopAt) {
      this.stopped = true
    }
    return this.stopped
  }

  private scoreMoves(moves: number[], ttMove: number, ply: number): number[] {
    const b = this.st.board
    return moves
      .map((m) => {
        let score = 0
        if (m === ttMove) score = 1e7
        else if (mFlag(m) & FLAG_CAPTURE) {
          const victim = b[mTo(m)] ? pieceType(b[mTo(m)]) : PAWN
          score = 1e6 + MVV[victim] - MVV[pieceType(b[mFrom(m)])]
        } else if (mFlag(m) & FLAG_PROMO) {
          score = 9e5 + MVV[mPromo(m)]
        } else {
          if (this.killers[ply][0] === m) score = 8e5
          else if (this.killers[ply][1] === m) score = 7.9e5
          else score = this.history[(mFrom(m) << 6) | mTo(m)]
        }
        return score
      })
      .map((score, i) => [score, moves[i]] as const)
      .sort((a, x) => x[0] - a[0])
      .map((x) => x[1])
  }

  private quiesce(alpha: number, beta: number, ply: number): number {
    this.nodes++
    if (this.timeUp()) return alpha
    if (ply > 48) return evaluate(this.st)
    const stand = evaluate(this.st)
    if (stand >= beta) return beta
    if (stand > alpha) alpha = stand

    const color = this.st.side
    const moves = genPseudo(this.st, true)
    const ordered = this.scoreMoves(moves, 0, Math.min(ply, 63))
    for (const m of ordered) {
      const u = makeMove(this.st, m)
      if (inCheck(this.st, color)) { unmakeMove(this.st, u); continue }
      const score = -this.quiesce(-beta, -alpha, ply + 1)
      unmakeMove(this.st, u)
      if (this.stopped) return alpha
      if (score >= beta) return beta
      if (score > alpha) alpha = score
    }
    return alpha
  }

  private negamax(depth: number, alpha: number, beta: number, ply: number): number {
    if (this.timeUp()) return alpha
    if (depth <= 0) return this.quiesce(alpha, beta, ply)
    this.nodes++

    const color = this.st.side
    const checked = inCheck(this.st, color)
    if (checked) depth++

    const key = this.hashKey()
    const entry = this.tt.get(key)
    let ttMove = 0
    if (entry && entry.depth >= depth) {
      ttMove = entry.move
      if (entry.flag === 0) return entry.score
      if (entry.flag === 1 && entry.score <= alpha) return alpha
      if (entry.flag === 2 && entry.score >= beta) return beta
    } else if (entry) {
      ttMove = entry.move
    }

    const moves = genPseudo(this.st, false)
    const ordered = this.scoreMoves(moves, ttMove, Math.min(ply, 63))
    let legal = 0
    let best = -INF
    let bestMove = 0

    for (const m of ordered) {
      const u = makeMove(this.st, m)
      if (inCheck(this.st, color)) { unmakeMove(this.st, u); continue }
      legal++
      let score: number
      const isQuiet = !(mFlag(m) & (FLAG_CAPTURE | FLAG_PROMO))
      if (legal === 1) {
        score = -this.negamax(depth - 1, -beta, -alpha, ply + 1)
      } else {
        let reduction = 0
        if (isQuiet && depth >= 3 && legal > 3 && !checked) reduction = 1
        score = -this.negamax(depth - 1 - reduction, -alpha - 1, -alpha, ply + 1)
        if (score > alpha && score < beta) {
          score = -this.negamax(depth - 1, -beta, -alpha, ply + 1)
        }
      }
      unmakeMove(this.st, u)
      if (this.stopped) return best > -INF ? best : alpha

      if (score > best) {
        best = score
        bestMove = m
      }
      if (score > alpha) {
        alpha = score
        if (isQuiet) this.history[(mFrom(m) << 6) | mTo(m)] += depth * depth
      }
      if (alpha >= beta) {
        if (isQuiet) {
          if (this.killers[Math.min(ply, 63)][0] !== m) {
            this.killers[Math.min(ply, 63)][1] = this.killers[Math.min(ply, 63)][0]
            this.killers[Math.min(ply, 63)][0] = m
          }
        }
        break
      }
    }

    if (legal === 0) {
      return checked ? -MATE + ply : 0
    }

    if (this.tt.size < this.ttLimit) {
      const flag = best <= alpha ? 1 : best >= beta ? 2 : 0
      this.tt.set(key, { depth, score: best, flag, move: bestMove })
    }
    return best
  }

  private hashKey(): number {
    let h = 0
    const b = this.st.board
    for (let i = 0; i < 64; i++) {
      if (b[i]) h = (h * 31 + b[i] * (i + 1)) | 0
    }
    h = (h * 31 + this.st.side) | 0
    h = (h * 31 + this.st.castling) | 0
    h = (h * 31 + this.st.ep) | 0
    return h
  }

  search(maxDepth: number, randomness: number, window = 90): { move: number; score: number } {
    let bestMove = 0
    let bestScore = 0
    let rootMoves: number[] = []
    const scored: { move: number; score: number; order: number }[] = []

    for (let depth = 1; depth <= maxDepth; depth++) {
      const moves = legalMoves(this.st)
      if (moves.length === 0) return { move: 0, score: 0 }
      const ordered = this.scoreMoves(moves, bestMove, 0)
      let alpha = -INF
      const iterationScores: { move: number; score: number; order: number }[] = []
      let localBest = 0
      let localBestScore = -INF

      for (let i = 0; i < ordered.length; i++) {
        const m = ordered[i]
        const u = makeMove(this.st, m)
        const score = -this.negamax(depth - 1, -INF, -alpha, 1)
        unmakeMove(this.st, u)
        if (this.stopped) break
        iterationScores.push({ move: m, score, order: i })
        if (score > localBestScore) {
          localBestScore = score
          localBest = m
        }
        if (score > alpha) alpha = score
      }

      if (this.stopped) break
      if (iterationScores.length) {
        scored.length = 0
        scored.push(...iterationScores.sort((a, b) => b.score - a.score))
        rootMoves = scored.map((s) => s.move)
        bestMove = localBest
        bestScore = localBestScore
      }
      if (Math.abs(bestScore) > MATE - 100) break
      if (Date.now() > this.stopAt) break
    }

    if (!bestMove) {
      const moves = legalMoves(this.st)
      return { move: moves.length ? moves[0] : 0, score: 0 }
    }

    // human-like imperfection: sometimes pick a slightly worse move
    if (randomness > 0 && scored.length > 1) {
      const pool: number[] = []
      for (const s of scored) {
        // keep moves within a window of the best score
        if (bestScore - s.score < window) pool.push(s.move)
        if (pool.length >= 4) break
      }
      if (pool.length > 1 && Math.random() < randomness) {
        const pick = pool[1 + Math.floor(Math.random() * (pool.length - 1))]
        if (pick) bestMove = pick
      }
    }

    void rootMoves
    return { move: bestMove, score: bestScore }
  }
}

export interface SearchResult {
  from: string
  to: string
  promotion?: string
}

export function findBestMove(
  fen: string,
  difficulty: number,
): SearchResult | null {
  const config =
    difficulty >= 3
      ? { depth: 8, time: 2200, randomness: 0.05, window: 25 }
      : difficulty === 2
        ? { depth: 5, time: 900, randomness: 0.15, window: 60 }
        : { depth: 2, time: 300, randomness: 0.55, window: 110 }

  const searcher = new Searcher(fen, config.time)
  const { move } = searcher.search(config.depth, config.randomness, config.window)
  if (!move) return null
  const promo = mPromo(move)
  return {
    from: idToString(mFrom(move)),
    to: idToString(mTo(move)),
    promotion: promo ? PROMO_CHARS[promo - 2] : undefined,
  }
}

export function idToString(id: number) {
  const files = 'abcdefgh'
  return `${files[id & 7]}${(id >> 3) + 1}`
}