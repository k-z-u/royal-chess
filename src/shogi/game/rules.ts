/**
 * The game — a position plus everything that has happened to it.
 *
 * `Position` knows the rules of a single move; `Game` knows the rules across
 * moves: 千日手 (fourfold repetition, including 連続王手の千日手), 詰み, and the
 * record of moves that the move list and the 棋譜 export are built from.
 */
import {
  baseOf,
  BISHOP,
  BLACK,
  dropPiece,
  GOLD,
  KING,
  KNIGHT,
  LANCE,
  moveFrom,
  movePromotes,
  moveTo,
  PAWN,
  Position,
  ROOK,
  SILVER,
  type Color,
  type Move,
} from './position.ts'
import { hasLegalMove, legalMoves } from './movegen.ts'
import { kifOf, sideName, usiOf } from './notation.ts'

/** One played move, with everything the UI needs to show and animate it. */
export interface MoveRecord {
  move: Move
  color: Color
  /** -1 for a drop */
  from: number
  to: number
  /** base code of the piece that moved — for a promotion this is the *unpromoted* form */
  piece: number
  /** base code captured on the destination square, or 0 */
  captured: number
  /** base code dropped, or 0 */
  dropped: number
  promoted: boolean
  /** did this move give check? */
  check: boolean
  usi: string
  kif: string
}

export type GameStatus =
  | { kind: 'playing'; check: Color | null }
  | { kind: 'checkmate'; winner: Color; loser: Color }
  | { kind: 'repetition'; reason: 'draw' }
  /** 連続王手の千日手: the side that kept checking loses */
  | { kind: 'repetition'; reason: 'perpetual'; winner: Color; loser: Color }
  | { kind: 'resign'; winner: Color; loser: Color }

export const START_SFEN = 'lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1'

/** How many of each piece a side holds in hand. */
export interface HandCounts {
  pawn: number
  lance: number
  knight: number
  silver: number
  gold: number
  bishop: number
  rook: number
}

/** The fourfold repetition rule needs the positions, not just the moves. */
const REPETITION_LIMIT = 4

export class Game {
  pos: Position
  readonly records: MoveRecord[] = []
  /** position keys, one per position reached — `keys[0]` is the start position */
  private keys: string[] = []
  private resigned: Color | null = null

  constructor(sfen = START_SFEN) {
    this.pos = Position.fromSfen(sfen)
    this.keys = [this.pos.key()]
  }

  /** A fresh game from the standard opening position. */
  static newGame(): Game {
    return new Game(START_SFEN)
  }

  get turn(): Color {
    return this.pos.turn
  }

  get ply(): number {
    return this.records.length
  }

  get lastTo(): number {
    return this.records.length ? this.records[this.records.length - 1].to : -1
  }

  legalMoves(): Move[] {
    return legalMoves(this.pos)
  }

  /** Can the side to move play at all? A side that cannot has lost. */
  hasMove(): boolean {
    return hasLegalMove(this.pos)
  }

  /**
   * Play `move`, which must be legal in the current position.
   *
   * The move is not re-validated: callers get their moves from `legalMoves()`,
   * the engine's own search, or `parseUsi` after a legality check, and a debug
   * check in the tests keeps that honest.
   */
  play(move: Move): MoveRecord {
    const color = this.pos.turn
    const from = moveFrom(move)
    const to = moveTo(move)
    const dropped = dropPiece(move)
    const code = dropped ? 0 : this.pos.board[from]
    const captured = dropped ? 0 : this.pos.board[to]
    const piece = dropped ? dropped : baseOf(code)
    const promoted = movePromotes(move)
    const previousTo = this.lastTo

    const kif = kifOf(this.pos, move, previousTo)
    const usi = usiOf(move)

    this.pos.make(move)
    const check = this.pos.inCheck()

    const record: MoveRecord = {
      move,
      color,
      from: dropped ? -1 : from,
      to,
      piece,
      captured: captured ? baseOf(captured) : 0,
      dropped,
      promoted,
      check,
      usi,
      kif,
    }
    this.records.push(record)
    this.keys.push(this.pos.key())
    return record
  }

  undo(): MoveRecord | null {
    if (!this.records.length) return null
    this.resigned = null
    this.pos.unmake()
    this.keys.pop()
    return this.records.pop() ?? null
  }

  /** Resign on behalf of the side to move. */
  resign(): void {
    this.resigned = this.turn
  }

  /** How many times the current position has occurred, including now. */
  repetitionCount(): number {
    const key = this.keys[this.keys.length - 1]
    let n = 0
    for (const k of this.keys) if (k === key) n += 1
    return n
  }

  /**
   * 連続王手の千日手 — was the repetition forced by one side checking on every
   * one of its moves through the cycle?
   *
   * The cycle is the span between the last two occurrences of the current
   * position. Returns the side that never stopped checking, or null.
   */
  private perpetualChecker(): Color | null {
    const last = this.keys.length - 1
    let previous = -1
    for (let i = last - 1; i >= 0; i--) {
      if (this.keys[i] === this.keys[last]) {
        previous = i
        break
      }
    }
    if (previous < 0) return null
    // moves between `previous` and `last`: records[previous] .. records[last - 1]
    for (const color of [BLACK, -BLACK] as Color[]) {
      let all = true
      let any = false
      for (let i = previous; i < last; i++) {
        const record = this.records[i]
        if (record.color !== color) continue
        any = true
        if (!record.check) all = false
      }
      if (any && all) return color
    }
    return null
  }

  status(): GameStatus {
    if (this.resigned !== null) {
      return { kind: 'resign', winner: -this.resigned as Color, loser: this.resigned }
    }
    if (!this.hasMove()) {
      const loser = this.turn
      return { kind: 'checkmate', winner: -loser as Color, loser }
    }
    if (this.repetitionCount() >= REPETITION_LIMIT) {
      const checker = this.perpetualChecker()
      if (checker) {
        return { kind: 'repetition', reason: 'perpetual', winner: -checker as Color, loser: checker }
      }
      return { kind: 'repetition', reason: 'draw' }
    }
    return { kind: 'playing', check: this.pos.inCheck() ? this.turn : null }
  }

  /** True when the game is over and no further move may be played. */
  isOver(): boolean {
    const status = this.status()
    return status.kind !== 'playing'
  }

  /** `先手 ７六歩` for every move played so far — used by the CLI and the log. */
  describe(): string[] {
    const replay = new Game()
    const out: string[] = []
    for (const record of this.records) {
      out.push(`${sideName(record.color)} ${kifOf(replay.pos, record.move, replay.lastTo)}`)
      replay.play(record.move)
    }
    return out
  }

  /** The moves so far in USI, the way a 棋譜 file stores them. */
  usiMoves(): string[] {
    return this.records.map((r) => r.usi)
  }

  /** What a side holds in hand — what the stands show. */
  hand(color: Color): HandCounts {
    const h = this.pos.hand(color)
    return {
      pawn: h[PAWN],
      lance: h[LANCE],
      knight: h[KNIGHT],
      silver: h[SILVER],
      gold: h[GOLD],
      bishop: h[BISHOP],
      rook: h[ROOK],
    }
  }

  /** A copy that can be searched without disturbing this game. */
  clone(): Game {
    const copy = new Game(START_SFEN)
    copy.pos = this.pos.clone()
    copy.keys = [...this.keys]
    copy.resigned = this.resigned
    for (const record of this.records) copy.records.push(record)
    return copy
  }

  /** Does `color`'s 玉 sit in the enemy camp? (for the 入玉 declaration) */
  kingInEnemyCamp(color: Color): boolean {
    const king = this.pos.king(color)
    if (king < 0) return false
    const rank = Math.floor(king / 9) + 1
    return color === BLACK ? rank <= 3 : rank >= 7
  }

  /** Material points for the 27-point 入玉 declaration. */
  declarationPoints(color: Color): number {
    let points = 0
    for (let sq = 0; sq < 81; sq++) {
      const code = this.pos.board[sq]
      if (code * color <= 0) continue
      const base = baseOf(code)
      if (base === KING) continue
      points += base === 6 || base === 7 ? 5 : 1
    }
    const hand = this.pos.hand(color)
    for (let type = PAWN; type <= 7; type++) points += hand[type] * (type === 6 || type === 7 ? 5 : 1)
    return points
  }
}
