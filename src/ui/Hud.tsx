import { useEffect, useMemo, useRef } from 'react'
import { useGame, type MoveEntry } from '../game/store'
import { OPPOSITE, PIECE_GLYPH, PIECE_VALUE } from '../game/squares'
import type { Color, PieceType } from '../game/types'
import {
  IconCrown,
  IconFlip,
  IconList,
  IconMute,
  IconNew,
  IconSettings,
  IconSound,
  IconUndo,
} from './Icons'

const INITIAL_COUNT: Record<PieceType, number> = { p: 8, n: 2, b: 2, r: 2, q: 1, k: 1 }

export interface CapturedInfo {
  pieces: PieceType[]
  advantage: number
}

function useCaptured() {
  const pieces = useGame((s) => s.pieces)
  return useMemo(() => {
    const alive: Record<Color, Record<string, number>> = {
      w: { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 },
      b: { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 },
    }
    for (const p of pieces) alive[p.color][p.type] = (alive[p.color][p.type] ?? 0) + 1
    const captured: Record<Color, PieceType[]> = { w: [], b: [] }
    const score: Record<Color, number> = { w: 0, b: 0 }
    for (const color of ['w', 'b'] as Color[]) {
      for (const t of ['q', 'r', 'b', 'n', 'p'] as PieceType[]) {
        const missing = INITIAL_COUNT[t] - (alive[color][t] ?? 0)
        for (let i = 0; i < missing; i++) {
          captured[color].push(t)
          score[color] += PIECE_VALUE[t]
        }
      }
    }
    return { captured, score }
  }, [pieces])
}

function StatusText() {
  const status = useGame((s) => s.status)
  const turn = useGame((s) => s.turn)
  const thinking = useGame((s) => s.thinking)
  const mode = useGame((s) => s.mode)

  if (status.kind === 'checkmate') {
    return (
      <span className="status-strong">
        Checkmate · {status.winner === 'w' ? 'White' : 'Black'} wins
      </span>
    )
  }
  if (status.kind === 'stalemate') {
    return <span className="status-strong">Stalemate · Draw</span>
  }
  if (status.kind === 'draw') {
    const reason =
      status.reason === 'threefold'
        ? 'threefold repetition'
        : status.reason === 'fifty'
          ? 'fifty-move rule'
          : 'insufficient material'
    return <span className="status-strong">Draw · {reason}</span>
  }
  const side = turn === 'w' ? 'White' : 'Black'
  const isCpu = mode === 'cpu' && thinking
  return (
    <span>
      <span className={`turn-dot ${turn}`} />
      {isCpu ? (
        <>
          Computer is thinking<span className="dots" />
        </>
      ) : (
        <>
          {side} to move
          {status.check ? <em className="check-flag"> · Check</em> : null}
        </>
      )}
    </span>
  )
}

function LastMoveChip() {
  const lastMove = useGame((s) => s.lastMove)
  const history = useGame((s) => s.history)
  if (!lastMove) return <span className="muted">No moves yet</span>
  const san = history.length ? history[history.length - 1].san : ''
  return (
    <span className="lastmove">
      <span className={`glyph ${lastMove.movedColor}`}>{PIECE_GLYPH[lastMove.moved]}</span>
      <span className="lastmove-san">{san}</span>
      <span className="muted">
        {lastMove.from}–{lastMove.to}
        {lastMove.captured ? ' ×' : ''}
      </span>
    </span>
  )
}

function CapturedRow({ pieces, color }: { pieces: PieceType[]; color: Color }) {
  if (!pieces.length) return <span className="captured-empty" />
  const sorted = [...pieces].sort((a, b) => PIECE_VALUE[b] - PIECE_VALUE[a])
  return (
    <span className="captured-row">
      {sorted.map((t, i) => (
        <span key={i} className={`glyph small ${color}`}>
          {PIECE_GLYPH[t]}
        </span>
      ))}
    </span>
  )
}

function PlayerCard({ side }: { side: Color }) {
  const playerColor = useGame((s) => s.playerColor)
  const mode = useGame((s) => s.mode)
  const turn = useGame((s) => s.turn)
  const status = useGame((s) => s.status)
  const thinking = useGame((s) => s.thinking)
  const { captured, score } = useCaptured()

  const isHuman = mode === 'human' || playerColor === side
  const name = mode === 'human' ? (side === 'w' ? 'White' : 'Black') : isHuman ? 'You' : 'Computer'
  const diff = score[side] - score[OPPOSITE[side]]
  const active = status.kind === 'playing' && turn === side

  return (
    <div className={`player-card ${active ? 'active' : ''}`}>
      <div className="player-avatar">
        <span className={`glyph ${side}`}>{PIECE_GLYPH.k}</span>
      </div>
      <div className="player-body">
        <div className="player-line">
          <span className="player-name">{name}</span>
          {mode === 'cpu' && (
            <span className="player-side">{side === 'w' ? 'White' : 'Black'}</span>
          )}
          {diff > 0 && <span className="player-adv">+{diff}</span>}
          {mode === 'cpu' && !isHuman && thinking && active && (
            <span className="player-thinking">thinking<span className="dots" /></span>
          )}
        </div>
        <CapturedRow pieces={captured[OPPOSITE[side]]} color={OPPOSITE[side]} />
      </div>
    </div>
  )
}

function MoveList() {
  const history = useGame((s) => s.history)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [history.length])

  const rows = useMemo(() => {
    const out: { n: number; w?: MoveEntry; b?: MoveEntry }[] = []
    for (let i = 0; i < history.length; i += 2) {
      out.push({ n: i / 2 + 1, w: history[i], b: history[i + 1] })
    }
    return out
  }, [history])

  const lastIndex = history.length - 1

  return (
    <div className="movelist" ref={scrollRef}>
      {rows.length === 0 && <div className="movelist-empty">Moves will appear here</div>}
      {rows.map((row) => (
        <div className="move-row" key={row.n}>
          <span className="move-no">{row.n}</span>
          <span className={`move-san ${lastIndex === (row.n - 1) * 2 ? 'current' : ''}`}>
            {row.w?.san ?? ''}
          </span>
          <span className={`move-san ${lastIndex === (row.n - 1) * 2 + 1 ? 'current' : ''}`}>
            {row.b?.san ?? ''}
          </span>
        </div>
      ))}
    </div>
  )
}

export function Hud({
  onNewGame,
  onSettings,
  showMoveList,
  onToggleMoveList,
}: {
  onNewGame: () => void
  onSettings: () => void
  showMoveList: boolean
  onToggleMoveList: () => void
}) {
  const undo = useGame((s) => s.undo)
  const toggleView = useGame((s) => s.toggleView)
  const history = useGame((s) => s.history)
  const thinking = useGame((s) => s.thinking)
  const sound = useGame((s) => s.settings.sound)
  const setSetting = useGame((s) => s.setSetting)
  const playerColor = useGame((s) => s.playerColor)
  const mode = useGame((s) => s.mode)

  const canUndo = history.length > 0 && !thinking

  return (
    <>
      <header className="topbar">
        <div className="brand">
          <IconCrown size={17} className="brand-icon" />
          <span className="brand-text">
            Royal <span className="brand-thin">Chess</span>
          </span>
        </div>
        <div className="topbar-actions">
          <button className="tbtn" onClick={onNewGame} title="New game">
            <IconNew />
            <span>New</span>
          </button>
          <button className="tbtn" onClick={undo} disabled={!canUndo} title="Undo move">
            <IconUndo />
            <span>Undo</span>
          </button>
          <button className="tbtn" onClick={toggleView} title="Flip board">
            <IconFlip />
            <span>Flip</span>
          </button>
          <button
            className="tbtn icon-only mobile-only"
            onClick={onToggleMoveList}
            title="Moves"
          >
            <IconList />
          </button>
          <button
            className="tbtn icon-only"
            onClick={() => setSetting('sound', !sound)}
            title={sound ? 'Mute' : 'Unmute'}
          >
            {sound ? <IconSound /> : <IconMute />}
          </button>
          <button className="tbtn icon-only" onClick={onSettings} title="Settings">
            <IconSettings />
          </button>
        </div>
      </header>

      <aside className={`panel ${showMoveList ? 'open' : ''}`}>
        <PlayerCard side={mode === 'cpu' ? OPPOSITE[playerColor] : 'b'} />
        <div className="panel-divider" />
        <MoveList />
        <div className="panel-divider" />
        <PlayerCard side={mode === 'cpu' ? playerColor : 'w'} />
      </aside>

      <div className="statusbar">
        <div className="status-pill">
          <StatusText />
        </div>
        <div className="status-sub">
          <span className="status-label">Last move</span>
          <LastMoveChip />
        </div>
      </div>
    </>
  )
}