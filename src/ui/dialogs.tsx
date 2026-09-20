import { useEffect, useState, type ReactNode } from 'react'
import { useGame } from '../game/store'
import { PIECE_GLYPH } from '../game/squares'
import type { Color, Difficulty, GameMode } from '../game/types'
import { IconClose } from './Icons'

const THEME_LABEL: Record<'walnut' | 'charcoal' | 'marble', string> = {
  walnut: 'ウォールナット',
  charcoal: 'チャコール',
  marble: 'マーブル',
}

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
          <button className="modal-close" onClick={onClose} aria-label="閉じる">
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
        <h2>新しい対局</h2>
        <p>手番と対戦相手を選びます。</p>
      </div>

      <div className="field">
        <span className="field-label">手番</span>
        <Segmented<Color>
          value={playerColor}
          onChange={(v) => {
            useGame.setState({ playerColor: v })
          }}
          options={[
            { value: 'w', label: '白' },
            { value: 'b', label: '黒' },
          ]}
        />
      </div>

      <div className="field">
        <span className="field-label">対戦相手</span>
        <Segmented<GameMode>
          value={mode}
          onChange={(v) => useGame.setState({ mode: v })}
          options={[
            { value: 'cpu', label: 'コンピューター' },
            { value: 'human', label: '2人対戦' },
          ]}
        />
      </div>

      {mode === 'cpu' && (
        <div className="field">
          <span className="field-label">強さ</span>
          <Segmented<Difficulty>
            value={difficulty}
            onChange={(v) => useGame.setState({ difficulty: v })}
            options={[
              { value: 1, label: 'カジュアル', hint: 'のんびり、ミスもする' },
              { value: 2, label: 'クラブ', hint: '堅実なクラブレベル' },
              { value: 3, label: 'マスター', hint: '最も深く読む' },
            ]}
          />
        </div>
      )}

      <div className="field">
        <span className="field-label">盤</span>
        <div className="swatches">
          {(['walnut', 'charcoal', 'marble'] as const).map((t) => (
            <button
              key={t}
              className={`swatch ${t} ${theme === t ? 'on' : ''}`}
              onClick={() => setSetting('theme', t)}
              title={THEME_LABEL[t]}
            >
              <span className="sw-l" />
              <span className="sw-d" />
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <span className="field-label">駒</span>
        <Segmented
          value={finish}
          onChange={(v) => setSetting('finish', v)}
          options={[
            { value: 'classic', label: 'ツゲ' },
            { value: 'stone', label: 'ストーン' },
            { value: 'brass', label: 'メタル' },
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
        対局開始
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
        <h2>設定</h2>
        <p>盤・駒・インターフェース。</p>
      </div>

      <div className="field">
        <span className="field-label">盤</span>
        <Segmented
          value={settings.theme}
          onChange={(v) => setSetting('theme', v)}
          options={[
            { value: 'walnut', label: 'ウォールナット' },
            { value: 'charcoal', label: 'チャコール' },
            { value: 'marble', label: 'マーブル' },
          ]}
        />
      </div>

      <div className="field">
        <span className="field-label">駒</span>
        <Segmented
          value={settings.finish}
          onChange={(v) => setSetting('finish', v)}
          options={[
            { value: 'classic', label: 'ツゲ' },
            { value: 'stone', label: 'ストーン' },
            { value: 'brass', label: 'メタル' },
          ]}
        />
      </div>

      <div className="field">
        <span className="field-label">アニメーション</span>
        <Segmented
          value={settings.speed}
          onChange={(v) => setSetting('speed', v)}
          options={[
            { value: 1.6, label: '速い' },
            { value: 1, label: '普通' },
            { value: 0.7, label: '遅い' },
          ]}
        />
      </div>

      <div className="field">
        <span className="field-label">グラフィック</span>
        <Segmented
          value={settings.quality}
          onChange={(v) => setSetting('quality', v)}
          options={[
            { value: 'high', label: '高品質' },
            { value: 'medium', label: '性能優先' },
          ]}
        />
      </div>

      <div className="toggles">
        <Toggle
          label="ヘルプ表示"
          hint="駒にカーソルを合わせると動ける場所を表示"
          value={settings.help}
          onChange={(v) => setSetting('help', v)}
        />
        <Toggle
          label="移動候補"
          hint="選択した駒が動けるマスを表示"
          value={settings.hints}
          onChange={(v) => setSetting('hints', v)}
        />
        <Toggle
          label="座標"
          hint="盤の周囲にファイルとランクを表示"
          value={settings.coordinates}
          onChange={(v) => setSetting('coordinates', v)}
        />
        <Toggle
          label="サウンド"
          hint="着手と駒取りでやわらかな木の音"
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
        <h2>ポーンの昇格</h2>
        <p>昇格する駒を選んでください。</p>
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

  let title = '引き分け'
  let detail = ''
  if (status.kind === 'checkmate') {
    title = `${status.winner === 'w' ? '白' : '黒'}の勝ち`
    detail = 'チェックメイト'
  } else if (status.kind === 'stalemate') {
    title = '引き分け'
    detail = 'ステイルメイト — 合法手なし'
  } else if (status.kind === 'draw') {
    detail =
      status.reason === 'threefold'
        ? '同一局面の3回反復'
        : status.reason === 'fifty'
          ? '50手ルール'
          : '戦力不足'
  }

  return (
    <Modal className="gameover">
      <div className="modal-head">
        <h2>{title}</h2>
        <p>{detail}</p>
      </div>
      <div className="gameover-actions">
        <button className="primary" onClick={onNewGame}>
          新しい対局
        </button>
        <button className="ghost" onClick={() => setDismissed(true)}>
          盤面を確認
        </button>
      </div>
    </Modal>
  )
}

