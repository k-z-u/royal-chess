import { useEffect, useState } from 'react'
import { ShogiScene } from './three/Scene'
import { Hud } from './ui/Hud'
import { GameOverDialog, NewGameDialog, PromotionDialog, SettingsDialog } from './ui/dialogs'
import { useGame, warmUpEngine } from './game/store'
import { unlockAudio } from './game/sound'
import { expose } from '../debug'
// The shogi skin. Every rule in it is scoped under body.variant-shogi, so it
// cannot reach the chess board when that variant is the one on screen.
import './shogi.css'

export default function App() {
  const [showNewGame, setShowNewGame] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showMoveList, setShowMoveList] = useState(false)

  const runCpu = useGame((s) => s.runCpuIfNeeded)
  const turn = useGame((s) => s.turn)
  const mode = useGame((s) => s.mode)
  const playerSide = useGame((s) => s.playerSide)
  const status = useGame((s) => s.status)
  const thinking = useGame((s) => s.thinking)

  useEffect(() => {
    warmUpEngine()
  }, [])

  useEffect(() => {
    runCpu()
  }, [runCpu, turn, mode, playerSide, status.kind, thinking])

  useEffect(() => {
    const unlock = () => {
      unlockAudio()
      window.removeEventListener('pointerdown', unlock)
    }
    window.addEventListener('pointerdown', unlock)
    return () => window.removeEventListener('pointerdown', unlock)
  }, [])

  useEffect(() => {
    expose('__shogi', useGame)
  }, [])

  return (
    <div className="app">
      <div className="stage">
        <ShogiScene />
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
