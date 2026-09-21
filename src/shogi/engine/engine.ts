/**
 * The engine's front door.
 *
 * `findBestMove` is what the worker calls, and it is deliberately the only
 * exported entry point: everything else about the search stays private so the
 * UI cannot accidentally depend on it.
 */
import { Position } from '../game/position.ts'
import { LEVELS, searchPosition, type SearchReport } from './search.ts'

export interface EngineRequest {
  id: number
  /** the position to move in */
  sfen: string
  /** USI moves of the whole game, so the engine can avoid repeating itself */
  moves: string[]
  /** 1 = 入門, 2 = 中級, 3 = 上級 */
  difficulty: number
  /** a random pick among near-best moves (defaults to true for the lower levels) */
  allowRandomness?: boolean
}

export interface EngineReply {
  id: number
  usi: string | null
  score: number
  depth: number
  nodes: number
  ms: number
  mate: boolean
  pv: string[]
}

export function levelFor(difficulty: number) {
  const index = Math.min(LEVELS.length, Math.max(1, Math.round(difficulty))) - 1
  return LEVELS[index]
}

export function findBestMove(
  sfen: string,
  moves: string[],
  difficulty: number,
  allowRandomness = true,
): SearchReport | null {
  const level = levelFor(difficulty)
  const pos = Position.fromSfen(sfen)
  return searchPosition(pos, level, { history: moves, allowRandomness })
}

export { LEVELS }
export type { SearchReport }
