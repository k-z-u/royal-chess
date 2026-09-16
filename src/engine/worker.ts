import { findBestMove } from './engine'

interface Request {
  id: number
  fen: string
  difficulty: number
}

self.onmessage = (e: MessageEvent<Request>) => {
  const { id, fen, difficulty } = e.data
  const started = Date.now()
  let result = null
  try {
    result = findBestMove(fen, difficulty)
  } catch (err) {
    result = null
    console.error('engine error', err)
  }
  const elapsed = Date.now() - started
  // keep the reply from feeling instantaneous, but never add real latency
  const pad = Math.max(0, 140 - elapsed)
  setTimeout(() => {
    ;(self as unknown as Worker).postMessage({ id, move: result })
  }, pad)
}