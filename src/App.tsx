import { useEffect } from 'react'
import ChessApp from './chess/App'
import ShogiApp from './shogi/App'
import { useVariant } from './variant'

/**
 * The shell: chess and shogi are two self-contained games behind one switch.
 *
 * Only the active one is mounted, so a game in progress keeps its state while
 * you look at the other, and there is never a second WebGL canvas or a second
 * engine worker running behind the scenes.
 */
export default function App() {
  const variant = useVariant((s) => s.variant)

  useEffect(() => {
    // The shogi stylesheet is gated on this class, so turning it on and off is
    // what keeps the two skins apart. It lives on <body> rather than on a
    // wrapper so that dialogs portalled out of the app tree are still covered.
    document.body.classList.toggle('variant-shogi', variant === 'shogi')
    document.title = variant === 'shogi' ? 'ロイヤルチェス · 将棋' : 'ロイヤルチェス'
  }, [variant])

  return variant === 'shogi' ? <ShogiApp /> : <ChessApp />
}
