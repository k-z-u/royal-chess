/**
 * Where a square lives in the 3D scene.
 *
 * The board is a 9×9 grid of 1-unit squares centred on the origin, lying in the
 * x/z plane with y up:
 *
 *   - files run 9…1 from left to right for 先手, so file 9 is at x = -4 and
 *     file 1 at x = +4 — the same way a real board reads from 先手's seat
 *   - ranks run 1…9 from the far side to 先手, so rank 1 sits at z = -4 and
 *     rank 9 at z = +4, leaving 先手 at +z looking across the board
 *
 * Pieces stand on `PIECE_BASE_Y`, the top face of the board slab.
 */
import { fileOf, rankOf, type Move } from './position.ts'

/** One square, in world units. */
export const CELL = 1
/** The board's span, edge to edge: 9 cells. */
export const SPAN = CELL * 9
/** Half the span, used for framing and for the slab. */
export const HALF = SPAN / 2

/** Top surface of the board slab — every piece rests here. */
export const PIECE_BASE_Y = 0
/** How thick the board slab is, below the surface. */
export const BOARD_THICKNESS = 0.62

export function squareToWorld(sq: number): [number, number, number] {
  const x = (fileOf(sq) - 5) * CELL
  const z = (rankOf(sq) - 5) * CELL
  return [x, PIECE_BASE_Y, z]
}

/** File and rank from a world x/z, if the point is on the board. */
export function worldToSquare(x: number, z: number): number | null {
  // the inverse of squareToWorld: col 0 is file 9 (x = -4), row 0 is rank 1
  const col = Math.round((4 * CELL - x) / CELL)
  const row = Math.round(z / CELL + 4)
  if (col < 0 || col > 8 || row < 0 || row > 8) return null
  return row * 9 + col
}

/** The white side sits at -z and 先手 at +z; used for the stands and the camera. */
export function sideZ(black: boolean): number {
  return black ? HALF + 1.55 : -HALF - 1.55
}

/** A 先手's piece points towards -z, a 後手's towards +z. */
export function facingYaw(black: boolean): number {
  return black ? 0 : Math.PI
}

/** Is `move` a drop *or* a normal move — handy for the tap layer. */
export function isBoardSquare(sq: number): boolean {
  return sq >= 0 && sq < 81
}

/** The centre of the board, where the orbit target sits. */
export const BOARD_CENTRE: [number, number, number] = [0, 0.1, 0]

export type { Move }
