export type Color = 'w' | 'b'
export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k'
export type GameMode = 'human' | 'cpu'
export type Difficulty = 1 | 2 | 3

export interface LastMove {
  from: string
  to: string
  moved: PieceType
  movedColor: Color
  captured?: PieceType
  capturedColor?: Color
  enPassant?: boolean
  castle?: 'k' | 'q'
  promoted?: PieceType
}

export interface PromotionRequest {
  from: string
  to: string
  color: Color
}

export interface AnimSpec {
  /** unique id for the animation instance */
  id: number
  /** capture fx */
  origin: [number, number, number]
  kind: 'move' | 'promotion'
}

export interface MoveNode {
  san: string
  fen: string
  lastMove: LastMove | null
}

export type GameStatus =
  | { kind: 'playing'; check: Color | null }
  | { kind: 'checkmate'; winner: Color; loser: Color }
  | { kind: 'stalemate'; turn: Color }
  | { kind: 'draw'; turn: Color; reason: 'threefold' | 'fifty' | 'material' }