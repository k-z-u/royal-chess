import { useEffect, useState, type ReactNode } from 'react'
import { useGame } from '../game/store'
import { PIECE_GLYPH } from '../game/squares'
import type { Color, Difficulty, GameMode } from '../game/types'
import { IconClose } from './Icons'

function Modal({
  children,
  onClose,
  wide,
  className = '',
}: {
  children: ReactNode
  onClose?: () => void
  wide?: boolean
  className?: string
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="overlay" onClick={onClose}>
      <div
        className={`modal ${wide ? 'wide' : ''} ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {onClose && (
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <IconClose size={16} />
          </button>
        )}
        {children}
      </div>
    </div>
  )
}

function Segmented<T extends string | number>({
  value,
  options,
  onChange,
}: {
  value: T
  options: { value: T; label: string; hint?: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="segmented">
      {options.map((o) => (
        <button
          key={String(o.value)}
          className={`seg ${o.value === value ? 'on' : ''}`}
          onClick={() => onChange(o.value)}
          title={o.hint}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function NewGameDialog({ onClose }: { onClose: () => void }) {
  const playerColor = useGame((s) => s.playerColor)
  const mode = useGame((s) => s.mode)
  const difficulty = useGame((s) => s.difficulty)
  const newGame = useGame((s) => s.newGame)
  const setSetting = useGame((s) => s.setSetting)
  const theme = useGame((s) => s.settings.theme)
  const finish = useGame((s) => s.settings.finish)

  return (
    <Modal onClose={onClose} wide className="newgame">
      <div className="modal-head">
        <h2>New game</h2>
        <p>Choose your side and opponent.</p>
      </div>

      <div className="field">
        <span className="field-label">Play as</span>
        <Segmented<Color>
          value={playerColor}
          onChange={(v) => {
            useGame.setState({ playerColor: v })
          }}
          options={[
            { value: 'w', label: 'White' },
            { value: 'b', label: 'Black' },
          ]}
        />
      </div>

      <div className="field">
        <span className="field-label">Opponent</span>
        <Segmented<GameMode>
          value={mode}
          onChange={(v) => useGame.setState({ mode: v })}
          options={[
            { value: 'cpu', label: 'Computer' },
            { value: 'human', label: 'Two players' },
          ]}
        />
      </div>

      {mode === 'cpu' && (
        <div className="field">
          <span className="field-label">Strength</span>
          <Segmented<Difficulty>
            value={difficulty}
            onChange={(v) => useGame.setState({ difficulty: v })}
            options={[
              { value: 1, label: 'Casual', hint: 'Relaxed, makes mistakes' },
              { value: 2, label: 'Club', hint: 'Solid club level' },
              { value: 3, label: 'Master', hint: 'Thinks hardest' },
            ]}
          />
        </div>
      )}

      <div className="field">
        <span className="field-label">Board</span>
        <div className="swatches">
          {(['walnut', 'charcoal', 'marble'] as const).map((t) => (
            <button
              key={t}
              className={`swatch ${t} ${theme === t ? 'on' : ''}`}
              onClick={() => setSetting('theme', t)}
              title={t}
            >
              <span className="sw-l" />
              <span className="sw-d" />
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <span className="field-label">Pieces</span>
        <Segmented
          value={finish}
          onChange={(v) => setSetting('finish', v)}
          options={[
            { value: 'classic', label: 'Boxwood' },
            { value: 'stone', label: 'Stone' },
            { value: 'brass', label: 'Metal' },
          ]}
        />
      </div>

      <button
        className="primary"
        onClick={() => {
          newGame({ color: playerColor, mode, difficulty })
          onClose()
        }}
      >
        Start game
      </button>
    </Modal>
  )
}

export function SettingsDialog({ onClose }: { onClose: () => void }) {
  const settings = useGame((s) => s.settings)
  const setSetting = useGame((s) => s.setSetting)

  return (
    <Modal onClose={onClose} className="settings">
      <div className="modal-head">
        <h2>Settings</h2>
        <p>Board, pieces and interface.</p>
      </div>

      <div className="field">
        <span className="field-label">Board</span>
        <Segmented
          value={settings.theme}
          onChange={(v) => setSetting('theme', v)}
          options={[
            { value: 'walnut', label: 'Walnut' },
            { value: 'charcoal', label: 'Charcoal' },
            { value: 'marble', label: 'Marble' },
          ]}
        />
      </div>

      <div className="field">
        <span className="field-label">Pieces</span>
        <Segmented
          value={settings.finish}
          onChange={(v) => setSetting('finish', v)}
          options={[
            { value: 'classic', label: 'Boxwood' },
            { value: 'stone', label: 'Stone' },
            { value: 'brass', label: 'Metal' },
          ]}
        />
      </div>

      <div className="field">
        <span className="field-label">Animation</span>
        <Segmented
          value={settings.speed}
          onChange={(v) => setSetting('speed', v)}
          options={[
            { value: 1.6, label: 'Quick' },
            { value: 1, label: 'Normal' },
            { value: 0.7, label: 'Slow' },
          ]}
        />
      </div>

      <div className="field">
        <span className="field-label">Graphics</span>
        <Segmented
          value={settings.quality}
          onChange={(v) => setSetting('quality', v)}
          options={[
            { value: 'high', label: 'High' },
            { value: 'medium', label: 'Performance' },
          ]}
        />
      </div>

      <div className="toggles">
        <Toggle
          label="Help mode"
          hint="Hover a piece to see where it can move"
          value={settings.help}
          onChange={(v) => setSetting('help', v)}
        />
        <Toggle
          label="Move hints"
          hint="Show legal destinations for the selected piece"
          value={settings.hints}
          onChange={(v) => setSetting('hints', v)}
        />
        <Toggle
          label="Coordinates"
          hint="Show files and ranks around the board"
          value={settings.coordinates}
          onChange={(v) => setSetting('coordinates', v)}
        />
        <Toggle
          label="Sound"
          hint="Soft wooden clicks on moves and captures"
          value={settings.sound}
          onChange={(v) => setSetting('sound', v)}
        />
      </div>
    </Modal>
  )
}

function Toggle({
  label,
  hint,
  value,
  onChange,
}: {
  label: string
  hint?: string
  value: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button className="toggle" onClick={() => onChange(!value)}>
      <span className="toggle-text">
        <span className="toggle-label">{label}</span>
        {hint && <span className="toggle-hint">{hint}</span>}
      </span>
      <span className={`switch ${value ? 'on' : ''}`}>
        <span className="knob" />
      </span>
    </button>
  )
}

export function PromotionDialog() {
  const promotion = useGame((s) => s.promotion)
  const choose = useGame((s) => s.choosePromotion)
  const cancel = useGame((s) => s.cancelPromotion)
  if (!promotion) return null

  const options: ('q' | 'r' | 'b' | 'n')[] = ['q', 'r', 'b', 'n']

  return (
    <Modal onClose={cancel} className="promotion">
      <div className="modal-head">
        <h2>Promote pawn</h2>
        <p>Choose the piece to promote to.</p>
      </div>
      <div className="promo-grid">
        {options.map((t) => (
          <button key={t} className="promo-btn" onClick={() => choose(t)}>
            <span className={`glyph large ${promotion.color}`}>{PIECE_GLYPH[t]}</span>
          </button>
        ))}
      </div>
    </Modal>
  )
}

export function GameOverDialog({ onNewGame }: { onNewGame: () => void }) {
  const status = useGame((s) => s.status)
  const [dismissed, setDismissed] = useState(false)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    if (status.kind === 'playing') {
      setDismissed(false)
      setShown(false)
      return
    }
    const t = setTimeout(() => setShown(true), 700)
    return () => clearTimeout(t)
  }, [status.kind])

  if (status.kind === 'playing' || dismissed || !shown) return null

  let title = 'Draw'
  let detail = ''
  if (status.kind === 'checkmate') {
    title = `${status.winner === 'w' ? 'White' : 'Black'} wins`
    detail = 'Checkmate'
  } else if (status.kind === 'stalemate') {
    title = 'Draw'
    detail = 'Stalemate — no legal moves'
  } else if (status.kind === 'draw') {
    detail =
      status.reason === 'threefold'
        ? 'Threefold repetition'
        : status.reason === 'fifty'
          ? 'Fifty-move rule'
          : 'Insufficient material'
  }

  return (
    <Modal className="gameover">
      <div className="modal-head">
        <h2>{title}</h2>
        <p>{detail}</p>
      </div>
      <div className="gameover-actions">
        <button className="primary" onClick={onNewGame}>
          New game
        </button>
        <button className="ghost" onClick={() => setDismissed(true)}>
          Review board
        </button>
      </div>
    </Modal>
  )
}

