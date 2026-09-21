import { memo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGame, type PieceOnBoard } from '../game/store'
import { facingYaw, squareToWorld } from '../game/squares'
import { komaGeometry } from './pieceGeometry'
import type { SceneMaterials } from './materials'

const yawCache = new Map<number, number>()
function yawFor(code: number): number {
  const black = code > 0
  let yaw = yawCache.get(black ? 1 : 0)
  if (yaw === undefined) {
    yaw = facingYaw(black)
    yawCache.set(black ? 1 : 0, yaw)
  }
  return yaw
}

function Koma({ piece, materials, speed }: { piece: PieceOnBoard; materials: SceneMaterials; speed: number }) {
  const group = useRef<THREE.Group>(null)
  const [x, y, z] = squareToWorld(piece.square)
  const geometry = komaGeometry()
  const face = materials.faceFor(piece.code)
  const side = materials.pieceSide

  // Pieces only ever move when their square changes, so a smooth follow of the
  // target position reads as a slide for the piece that moved and as a no-op for
  // every other piece. `speed` is the settings multiplier.
  useFrame((_, rawDt) => {
    const g = group.current
    if (!g) return
    const dt = Math.min(rawDt, 0.05)
    const rate = 1 - Math.exp(-dt * (9 + speed * 5))
    g.position.x += (x - g.position.x) * rate
    g.position.z += (z - g.position.z) * rate
    // a small hop while travelling, so a piece never looks like it slid
    const distance = Math.hypot(x - g.position.x, z - g.position.z)
    g.position.y += (y + Math.min(0.06, distance * 0.35) - g.position.y) * rate
  })

  return (
    <group ref={group} position={[x, y, z]} rotation={[0, yawFor(piece.code), 0]}>
      <mesh geometry={geometry} material={[face, side]} castShadow receiveShadow />
    </group>
  )
}

export const Pieces = memo(function Pieces({ materials }: { materials: SceneMaterials }) {
  const pieces = useGame((s) => s.pieces)
  const speed = useGame((s) => s.settings.speed)

  return (
    <group>
      {pieces.map((piece) => (
        <Koma key={piece.id} piece={piece} materials={materials} speed={speed} />
      ))}
    </group>
  )
})
