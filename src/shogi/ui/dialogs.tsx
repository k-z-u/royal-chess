import { useGame, type BoardTheme, type Difficulty, type PieceFinish } from '../game/store'
import { BLACK, baseOf, WHITE } from '../game/position.ts'
import { PROMOTED_KANJI, PIECE_KANJI, sideName } from '../game/notation.ts'

function Close({ onClose }: { onClose: () => void }) {
  return (
    <button className="modal-close" onClick={onClose} aria-label="閉じる">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <path d="m6 6 12 12M18 6 6 18" />
      </svg>
    </button>
  )
}

function Segmented<T extends string | number>({
  value,
  options,
  onChange,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="segmented">
      {options.map((o) => (
        <button
          key={String(o.value)}
          className={`seg ${o.value === value ? 'on' : ''}`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function Toggle({
  label,
  hint,
  on,
  onChange,
}: {
  label: string
  hint?: string
  on: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button className="toggle" onClick={() => onChange(!on)}>
      <span className="toggle-text">
        <span className="toggle-label">{label}</span>
        {hint && <span className="toggle-hint">{hint}</span>}
      </span>
      <span className={`switch ${on ? 'on' : ''}`}>
        <span className="knob" />
      </span>
    </button>
  )
}

const DIFFICULTY_LABEL: Record<Difficulty, { name: string; hint: string }> = {
  1: { name: '入門', hint: '2手読み・ときどき緩む' },
  2: { name: '中級', hint: '5手読み・静止探索あり' },
  3: { name: '上級', hint: '深く読む・ほぼ最善' },
}

export function NewGameDialog({ onClose }: { onClose: () => void }) {
  const newGame = useGame((s) => s.newGame)
  const mode = useGame((s) => s.mode)
  const setMode = useGame((s) => s.setMode)
  const difficulty = useGame((s) => s.difficulty)
  const setDifficulty = useGame((s) => s.setDifficulty)
  const playerSide = useGame((s) => s.playerSide)

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <Close onClose={onClose} />
        <div className="modal-head">
          <h2>新しい対局</h2>
          <p>手番と相手を選んで、盤をリセットします。</p>
        </div>

        <div className="field">
          <span className="field-label">対戦相手</span>
          <Segmented
            value={mode}
            options={[
              { value: 'cpu' as const, label: 'コンピューター' },
              { value: 'human' as const, label: 'ふたりで' },
            ]}
            onChange={(v) => setMode(v)}
          />
        </div>

        {mode === 'cpu' && (
          <>
            <div className="field">
              <span className="field-label">あなたの手番</span>
              <Segmented
                value={playerSide}
                options={[
                  { value: BLACK, label: '先手（下）' },
                  { value: WHITE, label: '後手（上）' },
                ]}
                onChange={(v) => useGame.setState({ playerSide: v })}
              />
            </div>
            <div className="field">
              <span className="field-label">強さ</span>
              <Segmented
                value={difficulty}
                options={[1, 2, 3].map((d) => ({
                  value: d as Difficulty,
                  label: DIFFICULTY_LABEL[d as Difficulty].name,
                }))}
                onChange={(v) => setDifficulty(v)}
              />
              <p className="field-note">{DIFFICULTY_LABEL[difficulty].hint}</p>
            </div>
          </>
        )}

        <button
          className="primary"
          onClick={() => {
            onClose()
            newGame({ mode, difficulty, side: playerSide })
          }}
        >
          対局をはじめる
        </button>
      </div>
    </div>
  )
}

export function SettingsDialog({ onClose }: { onClose: () => void }) {
  const settings = useGame((s) => s.settings)
  const setSetting = useGame((s) => s.setSetting)

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal wide" onClick={(e) => e.stopPropagation()}>
        <Close onClose={onClose} />
        <div className="modal-head">
          <h2>設定</h2>
          <p>盤・駒・表示の好みを保存します。</p>
        </div>

        <div className="field">
          <span className="field-label">盤</span>
          <div className="swatches">
            {(['kaya', 'hinoki', 'sumi'] as BoardTheme[]).map((t) => (
              <button
                key={t}
                className={`swatch ${t} ${settings.board === t ? 'on' : ''}`}
                onClick={() => setSetting('board', t)}
                title={t === 'kaya' ? '榧' : t === 'hinoki' ? '檜' : '墨'}
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
            value={settings.finish}
            options={[
              { value: 'tsuge' as PieceFinish, label: '黄楊' },
              { value: 'kaba' as PieceFinish, label: '樺' },
              { value: 'sumi' as PieceFinish, label: '墨' },
            ]}
            onChange={(v) => setSetting('finish', v)}
          />
        </div>

        <div className="field">
          <span className="field-label">駒の動き</span>
          <Segmented
            value={settings.speed}
            options={[
              { value: 0.6, label: 'ゆっくり' },
              { value: 1, label: 'ふつう' },
              { value: 1.8, label: 'きびきび' },
            ]}
            onChange={(v) => setSetting('speed', v)}
          />
        </div>

        <div className="field">
          <span className="field-label">グラフィック</span>
          <Segmented
            value={settings.quality}
            options={[
              { value: 'high' as const, label: '高' },
              { value: 'medium' as const, label: '中' },
            ]}
            onChange={(v) => setSetting('quality', v)}
          />
        </div>

        <div className="toggles">
          <Toggle
            label="座標を表示"
            hint="盤の縁に筋と段を出します"
            on={settings.coordinates}
            onChange={(v) => setSetting('coordinates', v)}
          />
          <Toggle
            label="ヒントを表示"
            hint="「ヒント」ボタンで候補手を照らします"
            on={settings.hints}
            onChange={(v) => setSetting('hints', v)}
          />
          <Toggle
            label="候補手を自動表示"
            hint="駒を選んだとき、動けるマスを常に表示します"
            on={settings.help}
            onChange={(v) => setSetting('help', v)}
          />
          <Toggle
            label="効果音"
            hint="駒を打つ音・王手の合図"
            on={settings.sound}
            onChange={(v) => setSetting('sound', v)}
          />
        </div>

        <button className="primary" onClick={onClose}>
          閉じる
        </button>
      </div>
    </div>
  )
}

export function PromotionDialog() {
  const promotion = useGame((s) => s.promotion)
  const choose = useGame((s) => s.choosePromotion)
  const cancel = useGame((s) => s.cancelPromotion)
  if (!promotion) return null

  const color = promotion.color
  // the piece that is about to move, read off the board before the move is made;
  // only an unpromoted 歩香桂銀角飛 can ever reach this dialog
  const board = useGame.getState().game.pos.board
  const base = baseOf(board[promotion.from])
  const plain = PIECE_KANJI[base]
  const promoted = PROMOTED_KANJI[base]

  return (
    <div className="overlay" onClick={cancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>成りますか</h2>
          <p>
            {sideName(color)}の{plain}が敵陣に入ります。
          </p>
        </div>
        <div className="promo-actions">
          <button className="promo-btn large" onClick={() => choose(true)}>
            <span className="promo-kanji promoted">{promoted}</span>
            <span className="promo-label">成る</span>
          </button>
          <button className="promo-btn large" onClick={() => choose(false)}>
            <span className="promo-kanji">{plain}</span>
            <span className="promo-label">成らず</span>
          </button>
        </div>
        <button className="ghost wide" onClick={cancel}>
          やめる
        </button>
      </div>
    </div>
  )
}

export function GameOverDialog({ onNewGame }: { onNewGame: () => void }) {
  const status = useGame((s) => s.status)
  const history = useGame((s) => s.history)
  if (status.kind === 'playing') return null

  let title = '対局終了'
  let detail = ''
  if (status.kind === 'checkmate') {
    title = '詰み'
    detail = `${sideName(status.winner)}の勝ちです。玉が詰みました。`
  } else if (status.kind === 'resign') {
    title = '投了'
    detail = `${sideName(status.winner)}の勝ちです。`
  } else if (status.kind === 'repetition') {
    if (status.reason === 'perpetual') {
      title = '連続王手の千日手'
      detail = `${sideName(status.loser)}が王手を続けたため、${sideName(status.winner)}の勝ちです。`
    } else {
      title = '千日手'
      detail = '同一局面が四回現れたため、引き分けです。'
    }
  }

  return (
    <div className="overlay">
      <div className="modal">
        <div className="modal-head">
          <h2>{title}</h2>
          <p>{detail}</p>
        </div>
        <div className="summary">
          <span className="summary-item">
            <span className="status-label">手数</span>
            <span>{history.length} 手</span>
          </span>
          <span className="summary-item">
            <span className="status-label">最後の手</span>
            <span>{history.length ? history[history.length - 1].kif : '—'}</span>
          </span>
        </div>
        <div className="gameover-actions">
          <button className="primary" onClick={onNewGame}>
            もう一局
          </button>
        </div>
      </div>
    </div>
  )
}

