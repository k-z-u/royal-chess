/**
 * The game's state, and the only place that talks to the engine worker.
 *
 * The rules live in `Game`; this store holds that game, a React-friendly
 * snapshot of the board (with stable piece ids so the 3D layer can animate),
 * and whatever the player is currently pointing at.
 */
import { create } from 'zustand'
import {
  BLACK,
  dropPiece,
  moveFrom,
  movePromotes,
  moveTo,
  WHITE,
  type Color,
  type Move,
} from './position.ts'
import { Game, type GameStatus, type MoveRecord } from './rules.ts'
import { legalMoves } from './movegen.ts'
import { usiOf } from './notation.ts'
import { materialBalance } from '../engine/evaluate.ts'
import type { EngineReply } from '../engine/engine.ts'

export type Difficulty = 1 | 2 | 3
export type GameMode = 'human' | 'cpu'
export type BoardTheme = 'kaya' | 'hinoki' | 'sumi'
export type PieceFinish = 'tsuge' | 'kaba' | 'sumi'

export interface PieceOnBoard {
  /** stable across moves, so an animation can follow one piece */
  id: number
  /** packed piece code: base + colour + promotion */
  code: number
  square: number
}

export interface MoveEntry {
  kif: string
  usi: string
  color: Color
  from: number
  to: number
  check: boolean
  captured: number
  dropped: number
  promoted: boolean
}

export interface Settings {
  sound: boolean
  coordinates: boolean
  hints: boolean
  help: boolean
  board: BoardTheme
  finish: PieceFinish
  speed: number
  quality: 'high' | 'medium'
}

const DEFAULT_SETTINGS: Settings = {
  sound: true,
  coordinates: true,
  hints: true,
  help: true,
  board: 'kaya',
  finish: 'tsuge',
  speed: 1,
  quality: 'high',
}

export interface PromotionRequest {
  from: number
  to: number
  color: Color
}

export interface HandPick {
  color: Color
  type: number
}

interface GameState {
  /** the engine-side game; mutated in place, snapshotted below */
  game: Game
  pieces: PieceOnBoard[]
  hands: [ReturnType<Game['hand']>, ReturnType<Game['hand']>]
  history: MoveEntry[]
  status: GameStatus
  turn: Color
  /** the side the human plays when mode is 'cpu' */
  playerSide: Color
  mode: GameMode
  difficulty: Difficulty
  thinking: boolean
  /** which way the camera is looking */
  viewSide: Color
  /** board material balance in 歩, for the readout */
  balance: number

  selected: number | null
  targets: Move[]
  hand: HandPick | null
  dropTargets: Move[]
  promotion: PromotionRequest | null
  lastMove: MoveRecord | null
  /** the engine's suggestion, drawn by the highlight layer */
  hint: Move | null
  evalScore: number | null
  anim: { id: number; from: number; to: number; n: number } | null
  pendingSound: string | null
  settings: Settings

  setSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void
  newGame: (opts?: { side?: Color; mode?: GameMode; difficulty?: Difficulty }) => void
  setMode: (mode: GameMode) => void
  setDifficulty: (d: Difficulty) => void
  selectSquare: (sq: number) => void
  selectHand: (pick: HandPick | null) => void
  attemptMove: (from: number, to: number) => void
  choosePromotion: (promote: boolean) => void
  cancelPromotion: () => void
  undo: () => void
  resign: () => void
  askHint: () => void
  toggleView: () => void
  runCpuIfNeeded: () => void
  setThinking: (v: boolean) => void
  consumeSound: () => void
}

let nextPieceId = 1

function snapshotPieces(game: Game): PieceOnBoard[] {
  const out: PieceOnBoard[] = []
  for (let sq = 0; sq < 81; sq++) {
    const code = game.pos.board[sq]
    if (code) out.push({ id: nextPieceId++, code, square: sq })
  }
  return out
}

function snapshotHands(game: Game): GameState['hands'] {
  return [game.hand(BLACK), game.hand(WHITE)]
}

function snapshotHistory(game: Game): MoveEntry[] {
  return game.records.map((r) => ({
    kif: r.kif,
    usi: r.usi,
    color: r.color,
    from: r.from,
    to: r.to,
    check: r.check,
    captured: r.captured,
    dropped: r.dropped,
    promoted: r.promoted,
  }))
}

interface Snapshot {
  game: Game
  pieces: PieceOnBoard[]
  hands: GameState['hands']
  history: MoveEntry[]
  status: GameStatus
  turn: Color
  balance: number
  lastMove: MoveRecord | null
}

function snapshot(game: Game, pieces: PieceOnBoard[]): Snapshot {
  return {
    game,
    pieces,
    hands: snapshotHands(game),
    history: snapshotHistory(game),
    status: game.status(),
    turn: game.turn,
    balance: materialBalance(game.pos),
    lastMove: game.records.length ? game.records[game.records.length - 1] : null,
  }
}

function freshState() {
  const game = Game.newGame()
  const pieces = snapshotPieces(game)
  return { ...snapshot(game, pieces), selected: null, targets: [], hand: null, dropTargets: [], promotion: null, hint: null, anim: null, evalScore: null }
}

/** Move the piece identities along with the rules, so the 3D layer can animate. */
function advancePieces(pieces: PieceOnBoard[], record: MoveRecord): { pieces: PieceOnBoard[]; movedId: number } {
  const next = pieces.filter((p) => p.square !== record.to || record.from === record.to)
  if (record.dropped) {
    const id = nextPieceId++
    next.push({ id, code: record.dropped * record.color, square: record.to })
    return { pieces: next, movedId: id }
  }
  const mover = next.find((p) => p.square === record.from)
  if (!mover) return { pieces: next, movedId: -1 }
  mover.square = record.to
  // promotion adds the +8 offset the rules use, keeping the colour's sign
  if (record.promoted) mover.code = (Math.abs(mover.code) + 8) * record.color
  return { pieces: next, movedId: mover.id }
}

function soundFor(record: MoveRecord, status: GameStatus): string {
  if (status.kind !== 'playing') return 'end'
  if (record.check) return 'check'
  if (record.captured) return 'capture'
  if (record.dropped) return 'drop'
  return 'move'
}

export const useGame = create<GameState>((set, get) => ({
  ...freshState(),
  playerSide: BLACK,
  mode: 'cpu',
  difficulty: 2,
  thinking: false,
  viewSide: BLACK,
  pendingSound: null,
  settings: DEFAULT_SETTINGS,

  setSetting: (key, value) => set((s) => ({ settings: { ...s.settings, [key]: value } })),

  newGame: (opts) => {
    engineGeneration += 1
    const mode = opts?.mode ?? get().mode
    const playerSide = opts?.side ?? get().playerSide
    const difficulty = opts?.difficulty ?? get().difficulty
    set({
      ...freshState(),
      mode,
      playerSide,
      difficulty,
      viewSide: playerSide,
      thinking: false,
      pendingSound: null,
    })
    if (mode === 'cpu' && playerSide !== BLACK) setTimeout(() => get().runCpuIfNeeded(), 380)
  },

  setMode: (mode) => {
    set({ mode })
    if (mode === 'cpu') get().runCpuIfNeeded()
  },

  setDifficulty: (difficulty) => {
    set({ difficulty })
    runCpuIfNeeded(get, set)
  },

  toggleView: () =>
    set((s) => ({ viewSide: s.viewSide === BLACK ? WHITE : BLACK })),

  selectSquare: (sq) => {
    const state = get()
    if (state.status.kind !== 'playing' || state.thinking || state.promotion) return
    if (state.mode === 'cpu' && state.turn !== state.playerSide) return

    // a piece in hand is waiting to be dropped
    if (state.hand) {
      const drop = state.dropTargets.find((m) => moveTo(m) === sq)
      if (drop) {
        applyMove(get, set, drop)
        return
      }
      set({ hand: null, dropTargets: [] })
      if (!state.targets.length) return
    }

    if (state.selected !== null) {
      const hit = state.targets.filter((m) => moveTo(m) === sq)
      if (hit.length) {
        resolveMove(get, set, state.selected, sq, hit)
        return
      }
    }

    const code = state.game.pos.board[sq]
    if (code && Math.sign(code) === state.turn) {
      const targets = legalMoves(state.game.pos).filter((m) => !dropPiece(m) && moveFrom(m) === sq)
      set({ selected: sq, targets, hand: null, dropTargets: [] })
      return
    }
    set({ selected: null, targets: [] })
  },

  selectHand: (pick) => {
    const state = get()
    if (!pick) {
      set({ hand: null, dropTargets: [] })
      return
    }
    if (state.status.kind !== 'playing' || state.thinking) return
    if (pick.color !== state.turn) return
    if (state.mode === 'cpu' && state.turn !== state.playerSide) return
    const drops = legalMoves(state.game.pos).filter((m) => dropPiece(m) === pick.type)
    set({ hand: pick, dropTargets: drops, selected: null, targets: [] })
  },

  attemptMove: (from, to) => {
    const state = get()
    if (state.status.kind !== 'playing' || state.thinking || state.promotion) return
    const hit = legalMoves(state.game.pos).filter((m) => !dropPiece(m) && moveFrom(m) === from && moveTo(m) === to)
    if (!hit.length) return
    resolveMove(get, set, from, to, hit)
  },

  choosePromotion: (promote) => {
    const request = get().promotion
    if (!request) return
    set({ promotion: null })
    applyPromotionChoice(get, set, request.from, request.to, promote)
  },

  cancelPromotion: () => set({ promotion: null }),

  setThinking: (v) => set({ thinking: v }),

  consumeSound: () => set({ pendingSound: null }),

  resign: () => {
    engineGeneration += 1
    const state = get()
    if (state.status.kind !== 'playing') return
    state.game.resign()
    set({ ...snapshot(state.game, state.pieces), thinking: false, pendingSound: 'end' })
  },

  askHint: () => {
    const state = get()
    if (state.mode === 'cpu' && state.turn !== state.playerSide) return
    if (state.status.kind !== 'playing' || state.thinking) return
    requestEngine(get, set, 'hint')
  },

  undo: () => {
    engineGeneration += 1
    const state = get()
    if (state.thinking) return
    const game = state.game
    if (!game.records.length) return
    game.undo()
    // in a game against the computer, step back to the human's turn
    if (state.mode === 'cpu' && game.records.length && game.turn !== state.playerSide) game.undo()
    const pieces = snapshotPieces(game)
    set({
      ...snapshot(game, pieces),
      selected: null,
      targets: [],
      hand: null,
      dropTargets: [],
      promotion: null,
      hint: null,
      anim: null,
      thinking: false,
    })
  },

  runCpuIfNeeded: () => runCpuIfNeeded(get, set),
}))

/** Which of the (at most two) moves matching from/to the player actually meant. */
function resolveMove(get: Get, set: Set, from: number, to: number, hit: Move[]) {
  if (hit.length > 1) {
    set({ promotion: { from, to, color: get().turn }, selected: null, targets: [], hand: null, dropTargets: [] })
    return
  }
  applyMove(get, set, hit[0])
}

/** Play the move the player just chose in the promotion dialog. */
function applyPromotionChoice(get: Get, set: Set, from: number, to: number, promote: boolean) {
  const hit = legalMoves(get().game.pos).filter(
    (m) => !dropPiece(m) && moveFrom(m) === from && moveTo(m) === to && movePromotes(m) === promote,
  )
  if (hit.length) applyMove(get, set, hit[0])
}

function applyMove(get: Get, set: Set, move: Move) {
  const state = get()
  const game = state.game
  const record = game.play(move)
  const { pieces, movedId } = advancePieces(state.pieces, record)
  const snap = snapshot(game, pieces)
  set({
    ...snap,
    selected: null,
    targets: [],
    hand: null,
    dropTargets: [],
    promotion: null,
    hint: null,
    anim: { id: movedId, from: record.from < 0 ? record.to : record.from, to: record.to, n: (state.anim?.n ?? 0) + 1 },
    thinking: false,
    pendingSound: soundFor(record, snap.status),
  })
  runCpuIfNeeded(get, set)
}

function runCpuIfNeeded(get: Get, set: Set) {
  const state = get()
  if (state.mode !== 'cpu') return
  if (state.status.kind !== 'playing') return
  if (state.thinking) return
  if (state.turn === state.playerSide) return
  set({ thinking: true })
  requestEngine(get, set, 'move')
}

type Get = () => GameState
type Set = (partial: Partial<GameState> | ((s: GameState) => Partial<GameState>)) => void

let worker: Worker | null = null
let requestId = 0
let engineGeneration = 0

function getWorker(): Worker | null {
  if (typeof Worker === 'undefined') return null
  if (!worker) {
    worker = new Worker(new URL('../engine/worker.ts', import.meta.url), { type: 'module' })
    worker.onerror = (e) => console.error('[shogi-3d] engine worker failed:', e.message ?? e)
  }
  return worker
}

/** Start the worker and let it warm up while the player is still reading the board. */
export function warmUpEngine(): void {
  const w = getWorker()
  w?.postMessage({
    id: 0,
    sfen: 'lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1',
    moves: [],
    difficulty: 1,
  })
}

/** how long a reply should take to feel deliberate rather than instant */
function minThinkMs(difficulty: number): number {
  return difficulty >= 3 ? 520 : difficulty === 2 ? 400 : 300
}

function requestEngine(get: Get, set: Set, purpose: 'move' | 'hint') {
  const state = get()
  const worker = getWorker()
  if (!worker) return
  const id = ++requestId
  const generation = engineGeneration
  const startedAt = performance.now()
  // a hint always thinks like 中級, even in an easy game
  const difficulty = purpose === 'hint' ? Math.max(2, state.difficulty) : state.difficulty

  const finish = (reply: EngineReply | null) => {
    if (generation !== engineGeneration) return
    const now = get()
    if (purpose === 'move' && !now.thinking) return
    if (!reply?.usi) {
      if (purpose === 'move') set({ thinking: false })
      return
    }
    const wait = (purpose === 'hint' ? 0 : minThinkMs(difficulty)) - (performance.now() - startedAt)
    if (wait > 0) {
      setTimeout(() => finish(reply), wait)
      return
    }
    if (purpose === 'hint') {
      // announce the suggestion instead of playing it
      const moves = legalMoves(now.game.pos)
      const suggested = moves.find((m) => usiOf(m) === reply.usi)
      if (!suggested) return
      set({ hint: suggested, evalScore: reply.score, selected: null, targets: [] })
      return
    }
    const moves = legalMoves(now.game.pos)
    const chosen = moves.find((m) => usiOf(m) === reply.usi)
    set({ evalScore: reply.score })
    if (!chosen) {
      // the engine's move is not legal here: fall back to a random legal move
      if (moves.length) applyMove(get, set, moves[Math.floor(Math.random() * moves.length)])
      else set({ thinking: false })
      return
    }
    applyMove(get, set, chosen)
  }

  const handler = (e: MessageEvent<EngineReply>) => {
    if (e.data.id !== id) return
    worker.removeEventListener('message', handler)
    finish(e.data)
  }
  worker.addEventListener('message', handler)
  worker.postMessage({
    id,
    sfen: state.game.pos.toSfen(),
    moves: state.game.usiMoves(),
    difficulty,
  })

  // last resort: never leave the game stuck on "thinking"
  setTimeout(() => {
    worker.removeEventListener('message', handler)
    if (generation !== engineGeneration) return
    const now = get()
    if (purpose === 'move' && !now.thinking) return
    const moves = legalMoves(now.game.pos)
    if (purpose === 'move' && moves.length) applyMove(get, set, moves[Math.floor(Math.random() * moves.length)])
    else if (purpose === 'move') set({ thinking: false })
  }, 15000)
}

