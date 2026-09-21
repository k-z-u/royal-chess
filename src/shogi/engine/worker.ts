/**
 * The search runs here, off the main thread, so the board keeps its frame rate
 * while the engine thinks.
 */
import { findBestMove, type EngineReply, type EngineRequest } from './engine.ts'

self.onmessage = (e: MessageEvent<EngineRequest>) => {
  const { id, sfen, moves, difficulty } = e.data
  let reply: EngineReply = { id, usi: null, score: 0, depth: 0, nodes: 0, ms: 0, mate: false, pv: [] }
  try {
    const started = Date.now()
    const result = findBestMove(sfen, moves ?? [], difficulty)
    if (result) {
      reply = {
        id,
        usi: result.usi,
        score: result.score,
        depth: result.depth,
        nodes: result.nodes,
        ms: Date.now() - started,
        mate: result.mate,
        pv: result.pv,
      }
    }
  } catch (error) {
    console.error('[shogi-3d] engine failed', error)
  }
  ;(self as unknown as Worker).postMessage(reply)
}
