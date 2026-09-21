import { useEffect, useMemo, useRef } from 'react'
import { useGame, type MoveEntry } from '../game/store'
import { BLACK, WHITE, type Color } from '../game/position.ts'
import { handPieceName, sideName } from '../game/notation.ts'
import type { HandCounts } from '../game/rules.ts'
import {
  IconFlag,
  IconFlip,
  IconHint,
  IconKoma,
  IconList,
  IconMute,
  IconNew,
  IconSettings,
  IconSound,
  IconUndo,
} from './Icons'
import { VariantSwitch } from '../../VariantSwitch'

/** 歩 香 桂 銀 金 角 飛 — the order a stand reads in, and the keys for it. */
const HAND_ORDER: { type: number; key: keyof HandCounts }[] = [
  { type: 1, key: 'pawn' },
  { type: 2, key: 'lance' },
  { type: 3, key: 'knight' },
  { type: 4, key: 'silver' },
  { type: 5, key: 'gold' },
  { type: 6, key: 'bishop' },
  { type: 7, key: 'rook' },
]

function HandRow({ counts, color }: { counts: HandCounts; color: Color }) {
  const cells = useMemo(() => {
    const out: { type: number; n: number }[] = []
    for (const { type, key } of HAND_ORDER) {
      const n = counts[key] ?? 0
      if (n > 0) out.push({ type, n })
    }
    return out
  }, [counts])

  if (!cells.length) return <span className="hand-empty">持ち駒なし</span>

  return (
    <span className="hand-row">
      {cells.map(({ type, n }) => (
        <span key={type} className={`hand-piece ${color === BLACK ? 'sente' : 'gote'}`}>
          <span className="hand-kanji">{handPieceName(type)}</span>
          {n > 1 && <span className="hand-count">{n}</span>}
        </span>
      ))}
    </span>
  )
}

function StatusText() {
  const status = useGame((s) => s.status)
  const turn = useGame((s) => s.turn)
  const thinking = useGame((s) => s.thinking)
  const mode = useGame((s) => s.mode)

  if (status.kind === 'checkmate') {
    return (
      <span className="status-strong">
        詰み · {sideName(status.winner)}の勝ち
      </span>
    )
  }
  if (status.kind === 'resign') {
    return (
      <span className="status-strong">
        投了 · {sideName(status.winner)}の勝ち
      </span>
    )
  }
  if (status.kind === 'repetition') {
    return status.reason === 'perpetual' ? (
      <span className="status-strong">
        連続王手の千日手 · {sideName(status.winner)}の勝ち
      </span>
    ) : (
      <span className="status-strong">千日手 · 引き分け</span>
    )
  }
  const isCpu = mode === 'cpu' && thinking
  return (
    <span>
      <span className={`turn-dot ${turn === BLACK ? 'sente' : 'gote'}`} />
      {isCpu ? (
        <>
          コンピューターが考えています<span className="dots" />
        </>
      ) : (
        <>
          {sideName(turn)}の手番
          {status.check ? <em className="check-flag"> · 王手</em> : null}
        </>
      )}
    </span>
  )
}

function LastMoveChip() {
  const lastMove = useGame((s) => s.lastMove)
  if (!lastMove) return <span className="muted">まだ着手はありません</span>
  return (
    <span className="lastmove">
      <span className="lastmove-san">{lastMove.kif}</span>
      {lastMove.check && <span className="check-flag">王手</span>}
      {lastMove.captured !== 0 && <span className="lastmove-tag">駒を取った</span>}
      {lastMove.dropped !== 0 && <span className="lastmove-tag">打った</span>}
    </span>
  )
}

function EvalReadout() {
  const score = useGame((s) => s.evalScore)
  const thinking = useGame((s) => s.thinking)
  const viewSide = useGame((s) => s.viewSide)
  if (score === null && !thinking) return null
  if (score === null) {
    return (
      <span className="eval-readout">
        <span className="status-label">形勢</span>
        <span className="muted">—</span>
      </span>
    )
  }
  // the engine speaks from the mover's point of view; show it from 先手's
  const senteScore = viewSide === BLACK ? score : -score
  const pawns = senteScore / 90
  const label = Math.abs(pawns) < 0.6 ? '互角' : pawns > 0 ? '先手良し' : '後手良し'
  return (
    <span className="eval-readout">
      <span className="status-label">形勢</span>
      <span className="eval-value">
        {pawns > 0 ? '+' : ''}
        {pawns.toFixed(1)}
      </span>
      <span className="muted">{label}</span>
    </span>
  )
}

function PlayerCard({ side }: { side: Color }) {
  const playerSide = useGame((s) => s.playerSide)
  const mode = useGame((s) => s.mode)
  const turn = useGame((s) => s.turn)
  const status = useGame((s) => s.status)
  const thinking = useGame((s) => s.thinking)
  const hands = useGame((s) => s.hands)
  const difficulty = useGame((s) => s.difficulty)

  const isHuman = mode === 'human' || playerSide === side
  const name =
    mode === 'human' ? sideName(side) : isHuman ? 'あなた' : `コンピューター（${['入門', '中級', '上級'][difficulty - 1]}）`
  const active = status.kind === 'playing' && turn === side
  const counts = hands[side === BLACK ? 0 : 1]

  return (
    <div className={`player-card ${active ? 'active' : ''}`}>
      <div className={`player-avatar ${side === BLACK ? 'sente' : 'gote'}`}>
        <span className="avatar-kanji">{side === BLACK ? '玉' : '王'}</span>
      </div>
      <div className="player-body">
        <div className="player-line">
          <span className="player-name">{name}</span>
          <span className="player-side">{sideName(side)}</span>
          {mode === 'cpu' && !isHuman && thinking && active && (
            <span className="player-thinking">
              思考中<span className="dots" />
            </span>
          )}
        </div>
        <HandRow counts={counts} color={side} />
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
    const out: { n: number; sente?: MoveEntry; gote?: MoveEntry }[] = []
    for (let i = 0; i < history.length; i += 2) {
      out.push({ n: (i + 2) / 2, sente: history[i], gote: history[i + 1] })
    }
    return out
  }, [history])

  const lastIndex = history.length - 1

  return (
    <div className="movelist" ref={scrollRef}>
      {rows.length === 0 && <div className="movelist-empty">ここに棋譜が並びます</div>}
      {rows.map((row) => (
        <div className="move-row" key={row.n}>
          <span className="move-no">{row.n}</span>
          <span className={`move-kif ${lastIndex === (row.n - 1) * 2 ? 'current' : ''}`}>
            {row.sente?.kif ?? ''}
          </span>
          <span className={`move-kif ${lastIndex === (row.n - 1) * 2 + 1 ? 'current' : ''}`}>
            {row.gote?.kif ?? ''}
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
  const resign = useGame((s) => s.resign)
  const askHint = useGame((s) => s.askHint)
  const toggleView = useGame((s) => s.toggleView)
  const history = useGame((s) => s.history)
  const thinking = useGame((s) => s.thinking)
  const status = useGame((s) => s.status)
  const sound = useGame((s) => s.settings.sound)
  const setSetting = useGame((s) => s.setSetting)
  const playerSide = useGame((s) => s.playerSide)
  const mode = useGame((s) => s.mode)
  const turn = useGame((s) => s.turn)

  const live = status.kind === 'playing'
  const canUndo = history.length > 0 && !thinking
  const humanTurn = mode === 'human' || turn === playerSide

  return (
    <>
      <header className="topbar">
        <div className="brand">
          <IconKoma size={18} className="brand-icon" />
          <span className="brand-text">
            将棋<span className="brand-thin">3D</span>
          </span>
        </div>
        <VariantSwitch />
        <div className="topbar-actions">
          <button className="tbtn" onClick={onNewGame} title="新しい対局">
            <IconNew />
            <span>新規</span>
          </button>
          <button className="tbtn" onClick={undo} disabled={!canUndo} title="一手戻す">
            <IconUndo />
            <span>戻す</span>
          </button>
          <button className="tbtn" onClick={toggleView} title="盤面を反転">
            <IconFlip />
            <span>反転</span>
          </button>
          <button
            className="tbtn"
            onClick={askHint}
            disabled={!live || thinking || !humanTurn}
            title="候補手を表示"
          >
            <IconHint />
            <span>ヒント</span>
          </button>
          <button className="tbtn" onClick={resign} disabled={!live} title="投了する">
            <IconFlag />
            <span>投了</span>
          </button>
          <button className="tbtn icon-only mobile-only" onClick={onToggleMoveList} title="棋譜">
            <IconList />
          </button>
          <button
            className="tbtn icon-only"
            onClick={() => setSetting('sound', !sound)}
            title={sound ? 'ミュート' : 'ミュート解除'}
          >
            {sound ? <IconSound /> : <IconMute />}
          </button>
          <button className="tbtn icon-only" onClick={onSettings} title="設定">
            <IconSettings />
          </button>
        </div>
      </header>

      <aside className={`panel ${showMoveList ? 'open' : ''}`}>
        <PlayerCard side={mode === 'cpu' && playerSide === BLACK ? WHITE : BLACK} />
        <div className="panel-divider" />
        <MoveList />
        <div className="panel-divider" />
        <PlayerCard side={mode === 'cpu' && playerSide === BLACK ? BLACK : WHITE} />
      </aside>

      <div className="statusbar">
        <div className="status-pill">
          <StatusText />
        </div>
        <div className="status-sub">
          <span className="status-label">直前の手</span>
          <LastMoveChip />
          <span className="status-sep" />
          <EvalReadout />
        </div>
      </div>
    </>
  )
}
