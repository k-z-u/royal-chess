import type { Color, PieceType } from './types'

export const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const

/** file index 0..7 for a..h */
export function fileIndex(sq: string) {
  return sq.charCodeAt(0) - 97
}
/** rank index 0..7 for 1..8 */
export function rankIndex(sq: string) {
  return sq.charCodeAt(1) - 49
}

export function squareAt(file: number, rank: number) {
  return `${FILES[file]}${rank + 1}`
}

export const BOARD_SIZE = 8
/** world size of one square */
export const SQ = 1
export const BOARD_HALF = (BOARD_SIZE * SQ) / 2

/** centre of a square in board-local coordinates (origin at board centre, y up) */
export function squareToWorld(sq: string): [number, number, number] {
  const f = fileIndex(sq)
  const r = rankIndex(sq)
  return [(f + 0.5) * SQ - BOARD_HALF, 0, BOARD_HALF - (r + 0.5) * SQ]
}

export function isLightSquare(sq: string) {
  return (fileIndex(sq) + rankIndex(sq)) % 2 === 0
}

export const OPPOSITE: Record<Color, Color> = { w: 'b', b: 'w' }

export const PIECE_GLYPH: Record<PieceType, string> = {
  k: '\u265A',
  q: '\u265B',
  r: '\u265C',
  b: '\u265D',
  n: '\u265E',
  p: '\u265F',
}

export const PIECE_NAME: Record<PieceType, string> = {
  k: 'King',
  q: 'Queen',
  r: 'Rook',
  b: 'Bishop',
  n: 'Knight',
  p: 'Pawn',
}

export const PIECE_VALUE: Record<PieceType, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0,
}