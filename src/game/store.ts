import { create } from 'zustand'
import { Chess, type Square } from 'chess.js'
import type {
  Color,
  Difficulty,
  GameMode,
  GameStatus,
  LastMove,
  PromotionRequest,
} from './types'
import { OPPOSITE, squareToWorld } from './squares'
import type { SearchResult } from '../engine/engine'

export interface MoveEntry {
  san: string
  color: Color
  from: string
  to: string
}

export interface Settings {
  sound: boolean
  coordinates: boolean
  hints: boolean
  theme: 'walnut' | 'charcoal' | 'marble'
  finish: 'classic' | 'stone' | 'brass'
  speed: number
  quality: 'high' | 'medium'
}

const DEFAULT_SETTINGS: Settings = {
  sound: true,
  coordinates: true,
  hints: true,
  theme: 'walnut',
  finish: 'classic',
  speed: 1,
  quality: 'high',
}

/** identity of a live piece on the board */
export interface PieceOnBoard {
  id: number
  type: string
  color: Color
  square: string
}

interface GameState {
  chess: Chess
  pieces: PieceOnBoard[]
  turn: Color
  selected: string | null
  legalTargets: string[]
  lastMove: LastMove | null
  history: MoveEntry[]
  status: GameStatus
  mode: GameMode
  playerColor: Color
  difficulty: Difficulty
  thinking: boolean
  promotion: PromotionRequest | null
  viewFrom: Color
  /** bumped to trigger animation for a specific piece */
  anim: { pieceId: number; from: string; to: string; n: number } | null
  capturedFx: { at: [number, number, number]; color: Color; type: string; n: number } | null
  pendingSound: string | null
  settings: Settings

  setSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void
  newGame: (opts?: { color?: Color; mode?: GameMode; difficulty?: Difficulty }) => void
  setMode: (mode: GameMode) => void
  setDifficulty: (d: Difficulty) => void
  selectSquare: (sq: string) => void
  attemptMove: (from: string, to: string) => void
  choosePromotion: (t: 'q' | 'r' | 'b' | 'n') => void
  cancelPromotion: () => void
  undo: () => void
  runCpuIfNeeded: () => void
  setThinking: (v: boolean) => void
  consumeSound: () => void
  toggleView: () => void
}

let nextId = 1
function buildPieces(chess: Chess): PieceOnBoard[] {
  const out: PieceOnBoard[] = []
  for (const row of chess.board()) {
    for (const cell of row) {
      if (!cell) continue
      out.push({ id: nextId++, type: cell.type, color: cell.color, square: cell.square })
    }
  }
  return out
}

function computeStatus(chess: Chess): GameStatus {
  if (chess.isCheckmate()) {
    const loser = chess.turn()
    return { kind: 'checkmate', winner: OPPOSITE[loser], loser }
  }
  if (chess.isStalemate()) return { kind: 'stalemate', turn: chess.turn() }
  if (chess.isThreefoldRepetition())
    return { kind: 'draw', turn: chess.turn(), reason: 'threefold' }
  if (chess.isDrawByFiftyMoves()) return { kind: 'draw', turn: chess.turn(), reason: 'fifty' }
  if (chess.isInsufficientMaterial())
    return { kind: 'draw', turn: chess.turn(), reason: 'material' }
  return { kind: 'playing', check: chess.isCheck() ? chess.turn() : null }
}

function describeLastMove(chess: Chess): LastMove | null {
  const h = chess.history({ verbose: true }) as unknown as Array<{
    from: string
    to: string
    piece: string
    color: Color
    captured?: string
    flags: string
    promotion?: string
  }>
  if (!h.length) return null
  const m = h[h.length - 1]
  const boardBefore = chess.board()
  void boardBefore
  return {
    from: m.from,
    to: m.to,
    moved: m.piece as LastMove['moved'],
    movedColor: m.color,
    captured: m.captured as LastMove['captured'],
    capturedColor: m.captured ? (m.flags.includes('e') ? OPPOSITE[m.color] : OPPOSITE[m.color]) : undefined,
    enPassant: m.flags.includes('e'),
    castle: m.flags.includes('k') ? 'k' : m.flags.includes('q') ? 'q' : undefined,
    promoted: m.promotion as LastMove['promoted'],
  }
}

const START_HISTORY: MoveEntry[] = []

function initState(partial?: Partial<GameState>) {
  const chess = new Chess()
  return {
    chess,
    pieces: buildPieces(chess),
    turn: 'w' as Color,
    selected: null,
    legalTargets: [],
    lastMove: null,
    history: START_HISTORY,
    status: computeStatus(chess),
    promotion: null,
    anim: null,
    capturedFx: null,
    ...partial,
  }
}

export const useGame = create<GameState>((set, get) => ({
  ...initState(),
  mode: 'cpu',
  playerColor: 'w',
  difficulty: 2,
  thinking: false,
  viewFrom: 'w',
  pendingSound: null,
  settings: DEFAULT_SETTINGS,

  setSetting: (key, value) =>
    set((s) => ({ settings: { ...s.settings, [key]: value } })),

  newGame: (opts) => {
    engineGeneration++
    const mode = opts?.mode ?? get().mode
    const playerColor = opts?.color ?? get().playerColor
    const difficulty = opts?.difficulty ?? get().difficulty
    set({
      ...initState(),
      mode,
      playerColor,
      difficulty,
      viewFrom: playerColor,
      thinking: false,
    })
    if (mode === 'cpu' && playerColor === 'b') {
      setTimeout(() => get().runCpuIfNeeded(), 350)
    }
  },

  setMode: (mode) => {
    set({ mode })
    if (mode === 'cpu') get().runCpuIfNeeded()
  },

  setDifficulty: (difficulty) => set({ difficulty }),

  toggleView: () => set((s) => ({ viewFrom: OPPOSITE[s.viewFrom] })),

  selectSquare: (sq) => {
    const { chess, selected, thinking, mode, playerColor, turn, status } = get()
    if (status.kind !== 'playing') return
    if (thinking) return
    if (mode === 'cpu' && turn !== playerColor) return
    const piece = chess.get(sq as Square)

    if (selected) {
      if (sq === selected) {
        set({ selected: null, legalTargets: [] })
        return
      }
      const moves = chess.moves({ square: selected as Square, verbose: true }) as unknown as Array<{
        to: string
        promotion?: string
      }>
      const target = moves.find((m) => m.to === sq)
      if (target) {
        get().attemptMove(selected, sq)
        return
      }
      if (piece && piece.color === turn) {
        const targets = (
          chess.moves({ square: sq as Square, verbose: true }) as unknown as Array<{ to: string }>
        ).map((m) => m.to)
        set({ selected: sq, legalTargets: targets })
        return
      }
      set({ selected: null, legalTargets: [] })
      return
    }

    if (piece && piece.color === turn) {
      const targets = (
        chess.moves({ square: sq as Square, verbose: true }) as unknown as Array<{ to: string }>
      ).map((m) => m.to)
      set({ selected: sq, legalTargets: targets })
    }
  },

  attemptMove: (from, to) => {
    const { chess, pieces, promotion } = get()
    if (promotion) return
    const probes = chess.moves({ square: from as Square, verbose: true }) as unknown as Array<{
      to: string
      promotion?: string
    }>
    const match = probes.find((m) => m.to === to)
    if (!match) return
    if (match.promotion) {
      set({ promotion: { from, to, color: chess.turn() }, selected: null, legalTargets: [] })
      return
    }
    applyMove(get, set, { from, to })
    void pieces
  },

  choosePromotion: (t) => {
    const req = get().promotion
    if (!req) return
    set({ promotion: null })
    applyMove(get, set, { from: req.from, to: req.to, promotion: t })
  },

  cancelPromotion: () => set({ promotion: null }),

  setThinking: (v) => set({ thinking: v }),

  runCpuIfNeeded: () => {
    const { chess, mode, playerColor, status, thinking } = get()
    if (mode !== 'cpu') return
    if (status.kind !== 'playing') return
    if (thinking) return
    if (chess.turn() === playerColor) return
    requestEngine(get, set)
  },

  consumeSound: () => set({ pendingSound: null }),

  undo: () => {
    engineGeneration++
    const { chess, mode, playerColor } = get()
    if (get().thinking) return
    const target = mode === 'cpu' ? playerColor : null
    // undo until it is the human's turn again (and at least one ply removed)
    let removed = 0
    while (chess.history().length > 0) {
      chess.undo()
      removed++
      if (target === null) break
      if (chess.turn() === target) break
      if (chess.history().length === 0) break
    }
    if (!removed) return
    set({
      pieces: buildPieces(chess),
      turn: chess.turn(),
      selected: null,
      legalTargets: [],
      lastMove: describeLastMove(chess),
      history: historyEntries(chess),
      status: computeStatus(chess),
      promotion: null,
      anim: null,
      capturedFx: null,
      thinking: false,
    })
  },
}))

function historyEntries(chess: Chess): MoveEntry[] {
  const h = chess.history({ verbose: true }) as unknown as Array<{
    san: string
    color: Color
    from: string
    to: string
  }>
  return h.map((m) => ({ san: m.san, color: m.color, from: m.from, to: m.to }))
}

type Get = () => GameState
type Set = (partial: Partial<GameState> | ((s: GameState) => Partial<GameState>)) => void

function findPieceId(pieces: PieceOnBoard[], square: string) {
  const p = pieces.find((x) => x.square === square)
  return p?.id ?? -1
}

function applyMove(
  get: Get,
  set: Set,
  mv: { from: string; to: string; promotion?: string },
) {
  const state = get()
  const chess = state.chess
  const prev = {
    from: mv.from,
    to: mv.to,
    piece: chess.get(mv.from as Square)?.type,
    color: chess.turn(),
  }
  const isEp = (() => {
    const moves = chess.moves({ square: mv.from as Square, verbose: true }) as unknown as Array<{
      to: string
      flags: string
    }>
    const m = moves.find((x) => x.to === mv.to)
    return m?.flags.includes('e') ?? false
  })()

  let result
  try {
    result = chess.move({
      from: mv.from,
      to: mv.to,
      promotion: mv.promotion ?? 'q',
    }) as unknown as {
      from: string
      to: string
      flags: string
      san: string
      captured?: string
      color: Color
      piece: string
      promotion?: string
    }
  } catch {
    return
  }
  if (!result) return

  const pieces = state.pieces.map((p) => ({ ...p }))
  const moverId = findPieceId(pieces, result.from)
  const capturedPiece = pieces.find((p) => p.square === result.to)

  const anim = {
    pieceId: moverId,
    from: result.from,
    to: result.to,
    n: (state.anim?.n ?? 0) + 1,
  }

  let capturedFx: GameState['capturedFx'] = null
  if (result.captured) {
    let capSquare = result.to
    if (isEp) {
      // a white en-passant capture removes a black pawn that sits one rank
      // behind the destination, and vice versa
      capSquare = result.color === 'w' ? `${result.to[0]}5` : `${result.to[0]}4`
    }
    const wp = squareToWorld(capSquare)
    capturedFx = {
      at: [wp[0], 0.55, wp[2]],
      color: OPPOSITE[result.color],
      type: result.captured,
      n: (state.capturedFx?.n ?? 0) + 1,
    }
  }

  // update piece identities
  const removed: number[] = []
  for (const p of pieces) {
    if (p.square === result.from) {
      p.square = result.to
    } else if (isEp && result.captured) {
      const capSquare = result.color === 'w' ? `${result.to[0]}5` : `${result.to[0]}4`
      if (p.square === capSquare) removed.push(p.id)
    } else if (result.captured && p.square === result.to && p.id !== moverId) {
      removed.push(p.id)
    }
  }
  let next = pieces.filter((p) => !removed.includes(p.id))
  // if a capture happened where mover landed, make sure the captured is gone
  if (capturedPiece && capturedPiece.id !== moverId) {
    next = next.filter((p) => p.id !== capturedPiece.id)
  }

  if (result.flags.includes('k')) {
    const rank = result.color === 'w' ? '1' : '8'
    const rook = next.find((p) => p.square === `h${rank}`)
    if (rook) rook.square = `f${rank}`
  } else if (result.flags.includes('q')) {
    const rank = result.color === 'w' ? '1' : '8'
    const rook = next.find((p) => p.square === `a${rank}`)
    if (rook) rook.square = `d${rank}`
  }

  if (result.promotion && moverId !== -1) {
    for (const p of next) {
      if (p.id === moverId) {
        p.type = result.promotion
      }
    }
  }

  const history = historyEntries(chess)
  const status = computeStatus(chess)

  set({
    pieces: next,
    turn: chess.turn(),
    selected: null,
    legalTargets: [],
    lastMove: {
      from: result.from,
      to: result.to,
      moved: result.piece as LastMove['moved'],
      movedColor: result.color,
      captured: result.captured as LastMove['captured'],
      capturedColor: result.captured ? OPPOSITE[result.color] : undefined,
      enPassant: result.flags.includes('e'),
      castle: result.flags.includes('k') ? 'k' : result.flags.includes('q') ? 'q' : undefined,
      promoted: result.promotion as LastMove['promoted'],
    },
    history,
    status,
    anim,
    capturedFx,
    thinking: false,
    pendingSound: result.captured
      ? 'capture'
      : status.kind !== 'playing'
        ? 'end'
        : status.check
          ? 'check'
          : 'move',
  })

  void prev

  if (status.kind === 'playing') {
    const s = get()
    if (s.mode === 'cpu' && s.turn !== s.playerColor) {
      set({ thinking: true })
      requestEngine(get, set)
    }
  }
}

let engineWorker: Worker | null = null
let engineReqId = 0
/** bumped whenever the position changes underneath a pending search */
let engineGeneration = 0

function getWorker() {
  if (!engineWorker) {
    engineWorker = new Worker(new URL('../engine/worker.ts', import.meta.url), {
      type: 'module',
    })
    engineWorker.onerror = (e) => {
      console.error('[royal-chess] engine worker failed:', e.message ?? e)
    }
  }
  return engineWorker
}

/**
 * Spawn the worker and let it compile while the player is still thinking about
 * their first move, so the first reply is not delayed by startup.
 */
export function warmUpEngine() {
  const worker = getWorker()
  worker.postMessage({ id: 0, fen: '7k/5Q2/6K1/8/8/8/8/8 b - - 0 1', difficulty: 1 })
}

/** how long a reply should take to feel deliberate rather than instant */
function minThinkMs(difficulty: number) {
  return difficulty >= 3 ? 620 : difficulty === 2 ? 450 : 340
}

function requestEngine(get: Get, set: Set) {
  const { chess, difficulty } = get()
  const id = ++engineReqId
  const generation = engineGeneration
  const worker = getWorker()
  const startedAt = performance.now()

  const finish = (mv: SearchResult | null) => {
    if (generation !== engineGeneration) return
    const st = get()
    if (!st.thinking) return
    if (!mv) {
      set({ thinking: false })
      return
    }
    const wait = minThinkMs(difficulty) - (performance.now() - startedAt)
    if (wait > 0) setTimeout(() => finish(mv), wait)
    else applyMove(get, set, mv)
  }

  const handler = (e: MessageEvent<{ id: number; move: SearchResult | null }>) => {
    if (e.data.id !== id) return
    worker.removeEventListener('message', handler)
    finish(e.data.move)
  }

  worker.addEventListener('message', handler)
  worker.postMessage({ id, fen: chess.fen(), difficulty })

  // last resort: never leave the game stuck on "thinking"
  setTimeout(() => {
    worker.removeEventListener('message', handler)
    if (generation !== engineGeneration) return
    const st = get()
    if (!st.thinking) return
    const moves = st.chess.moves({ verbose: true }) as unknown as Array<{
      from: string
      to: string
      promotion?: string
    }>
    if (moves.length) {
      const m = moves[Math.floor(Math.random() * moves.length)]
      applyMove(get, set, { from: m.from, to: m.to, promotion: m.promotion })
    } else {
      set({ thinking: false })
    }
  }, 12000)
}
