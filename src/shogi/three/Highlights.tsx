import { memo, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { baseOf, dropPiece, KING, moveFrom, movePromotes, moveTo } from '../game/position.ts'
import { useGame } from '../game/store'
import { CELL, squareToWorld } from '../game/squares'
import { makeGlowTexture } from './textures'

const DOT_Y = 0.006
const TINT_Y = 0.0025
const RING_Y = 0.005
/** the glow sits just under the surface so it never fights the pieces */
const BOARD_EPS = -0.001

function squarePlane(size: number, y: number) {
  const g = new THREE.PlaneGeometry(size, size)
  g.rotateX(-Math.PI / 2)
  g.translate(0, y, 0)
  return g
}

/** The four corners of the selected square, drawn as an open gold bracket. */
function SelectionFrame({ square }: { square: number }) {
  const [x, , z] = squareToWorld(square)
  const geometry = useMemo(() => squarePlane(CELL * 0.985, RING_Y), [])
  return (
    <mesh geometry={geometry} position={[x, 0, z]} renderOrder={3} raycast={() => null}>
      <meshBasicMaterial color="#f0cf85" transparent opacity={0.16} depthWrite={false} />
    </mesh>
  )
}

function Target({
  square,
  capture,
}: {
  square: number
  capture: boolean
}) {
  const [x, , z] = squareToWorld(square)
  const ring = useMemo(() => new THREE.RingGeometry(0.3, 0.4, 32).rotateX(-Math.PI / 2), [])
  const dot = useMemo(() => new THREE.CircleGeometry(0.155, 32).rotateX(-Math.PI / 2), [])
  const color = capture ? '#e8a94a' : '#f0cf85'
  return (
    <group position={[x, 0, z]} renderOrder={4} raycast={() => null}>
      {capture ? (
        <mesh geometry={ring} position={[0, RING_Y, 0]}>
          <meshBasicMaterial color={color} transparent opacity={0.72} depthWrite={false} />
        </mesh>
      ) : (
        <mesh geometry={dot} position={[0, DOT_Y, 0]}>
          <meshBasicMaterial color={color} transparent opacity={0.5} depthWrite={false} />
        </mesh>
      )}
    </group>
  )
}

function MoveTint({ square, color, opacity }: { square: number; color: string; opacity: number }) {
  const [x, , z] = squareToWorld(square)
  const geometry = useMemo(() => squarePlane(CELL * 0.985, TINT_Y), [])
  return (
    <mesh geometry={geometry} position={[x, 0, z]} renderOrder={2} raycast={() => null}>
      <meshBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} />
    </mesh>
  )
}

function CheckGlow({ square }: { square: number }) {
  const [x, , z] = squareToWorld(square)
  const ref = useRef<THREE.Mesh>(null)
  const texture = useMemo(() => makeGlowTexture(), [])
  const geometry = useMemo(() => squarePlane(CELL * 1.5, -BOARD_EPS), [])

  useFrame((state) => {
    const mesh = ref.current
    if (!mesh) return
    const material = mesh.material as THREE.MeshBasicMaterial
    material.opacity = 0.42 + Math.sin(state.clock.elapsedTime * 4) * 0.18
  })

  return (
    <mesh ref={ref} geometry={geometry} position={[x, 0, z]} renderOrder={1} raycast={() => null}>
      <meshBasicMaterial
        map={texture}
        transparent
        opacity={0.5}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  )
}

export const Highlights = memo(function Highlights() {
  const selected = useGame((s) => s.selected)
  const targets = useGame((s) => s.targets)
  const dropTargets = useGame((s) => s.dropTargets)
  const hand = useGame((s) => s.hand)
  const lastMove = useGame((s) => s.lastMove)
  const hint = useGame((s) => s.hint)
  const status = useGame((s) => s.status)
  const showHints = useGame((s) => s.settings.hints)
  const help = useGame((s) => s.settings.help)
  const pieces = useGame((s) => s.pieces)

  const occupied = useMemo(() => {
    const set = new Set<number>()
    for (const p of pieces) set.add(p.square)
    return set
  }, [pieces])

  const checkSquare = useMemo(() => {
    if (status.kind !== 'playing' || !status.check) return null
    const king = pieces.find((p) => p.code * status.check! > 0 && baseOf(p.code) === KING)
    return king ? king.square : null
  }, [pieces, status])

  const moves = hand ? dropTargets : targets
  const showTargets = help || selected !== null || hand !== null

  return (
    <group>
      {lastMove && (
        <>
          {lastMove.from >= 0 && <MoveTint square={lastMove.from} color="#c8a45c" opacity={0.16} />}
          <MoveTint square={lastMove.to} color="#c8a45c" opacity={0.22} />
        </>
      )}

      {showHints && hint && (
        <>
          {!dropPiece(hint) && <MoveTint square={moveFrom(hint)} color="#4fd1c5" opacity={0.24} />}
          <MoveTint square={moveTo(hint)} color="#4fd1c5" opacity={0.3} />
        </>
      )}

      {selected !== null && <SelectionFrame square={selected} />}

      {showTargets &&
        moves.map((move) => (
          <Target
            key={move}
            square={moveTo(move)}
            capture={
              !dropPiece(move) && (occupied.has(moveTo(move)) || movePromotes(move))
            }
          />
        ))}

      {checkSquare !== null && <CheckGlow square={checkSquare} />}
    </group>
  )
})
