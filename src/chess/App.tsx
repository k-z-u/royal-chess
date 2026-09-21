import { useEffect, useState } from 'react'
import { ChessScene } from '../three/Scene'
import { Hud } from '../ui/Hud'
import { GameOverDialog, NewGameDialog, PromotionDialog, SettingsDialog } from '../ui/dialogs'
import { useGame, warmUpEngine } from '../game/store'
import { unlockAudio } from '../game/sound'
import { expose } from '../debug'

export default function App() {
  const [showNewGame, setShowNewGame] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showMoveList, setShowMoveList] = useState(false)

  const runCpu = useGame((s) => s.runCpuIfNeeded)
  const turn = useGame((s) => s.turn)
  const mode = useGame((s) => s.mode)
  const playerColor = useGame((s) => s.playerColor)
  const status = useGame((s) => s.status)
  const promotion = useGame((s) => s.promotion)

  useEffect(() => {
    warmUpEngine()
  }, [])

  useEffect(() => {
    runCpu()
  }, [runCpu, turn, mode, playerColor, status.kind])

  useEffect(() => {
    const unlock = () => {
      unlockAudio()
      window.removeEventListener('pointerdown', unlock)
    }
    window.addEventListener('pointerdown', unlock)
    return () => window.removeEventListener('pointerdown', unlock)
  }, [])

  useEffect(() => {
    document.body.style.cursor = promotion ? 'default' : document.body.style.cursor
  }, [promotion])

  useEffect(() => {
    expose('__chess', useGame)
  }, [])

  return (
    <div className="app">
      <div className="stage">
        <ChessScene />
      </div>
      <div className="vignette" aria-hidden />
      <div className="grain" aria-hidden />

      <Hud
        onNewGame={() => setShowNewGame(true)}
        onSettings={() => setShowSettings(true)}
        showMoveList={showMoveList}
        onToggleMoveList={() => setShowMoveList((v) => !v)}
      />

      {showNewGame && <NewGameDialog onClose={() => setShowNewGame(false)} />}
      {showSettings && <SettingsDialog onClose={() => setShowSettings(false)} />}
      <PromotionDialog />
      <GameOverDialog onNewGame={() => setShowNewGame(true)} />
    </div>
  )
}