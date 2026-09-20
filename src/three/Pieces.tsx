import { memo, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import {
  getPieceGeometry,
  isKingModelReady,
  loadKingModel,
  subscribeKingModel,
} from './pieceGeometry'
import type { SceneMaterials } from './materials'
import { squareToWorld } from '../game/squares'
import { SURFACE_Y } from './Board'
import { useGame, type PieceOnBoard } from '../game/store'
import type { Color, PieceType } from '../game/types'

function easeInOut(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

/**
 * Resting position for a piece: centred on its square and standing on the
 * square surface. The board's zero plane sits below the tiles, so pieces must
 * be lifted by SURFACE_Y or they sink into the plates.
 */
function squareRestPos(sq: string): [number, number, number] {
  const [x, , z] = squareToWorld(sq)
  return [x, SURFACE_Y, z]
}

function easeOutBack(t: number) {
  const c1 = 1.4
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
}

interface PieceProps {
  piece: PieceOnBoard
  selected: boolean
  checked: boolean
  materials: SceneMaterials
  speed: number
  /** bumped when an override model loads, so memoised pieces swap geometry */
  geoVersion: number
}

const Piece = memo(function Piece({
  piece,
  selected,
  checked,
  materials,
  speed,
  geoVersion,
}: PieceProps) {
  const groupRef = useRef<THREE.Group>(null)
  const geometry = useMemo(() => {
    // bumping geoVersion when an override model lands re-reads the geometry,
    // which is what swaps the procedural king for the Blender one
    void geoVersion
    return getPieceGeometry(piece.type as PieceType)
  }, [piece.type, geoVersion])

  // a king in check gets its own material so it can glow on its own
  const material = useMemo(() => {
    const base = piece.color === 'w' ? materials.whitePiece : materials.blackPiece
    if (!checked) return base
    const m = base.clone()
    m.emissive = new THREE.Color('#c4453a')
    m.emissiveIntensity = 0.4
    return m
  }, [checked, piece.color, materials])

  useEffect(() => {
    if (!checked) return
    return () => {
      material.dispose()
    }
  }, [material, checked])

  const pos = useRef(new THREE.Vector3(...squareRestPos(piece.square)))
  const anim = useRef({
    from: new THREE.Vector3(),
    to: new THREE.Vector3(),
    t: 1,
    dur: 0.34,
    arc: 0.12,
    active: false,
  })
  const prevSquare = useRef(piece.square)
  const prevType = useRef(piece.type)
  const spawn = useRef({ t: 0 })
  const lift = useRef(0)
  const pop = useRef({ t: 1 })
  const seeded = useRef(false)

  const spawnDelay = useMemo(() => {
    const [x, , z] = squareToWorld(piece.square)
    return (Math.abs(x) + Math.abs(z)) * 0.022
  }, [piece.square])

  useFrame((_, rawDt) => {
    const g = groupRef.current
    if (!g) return
    const dt = Math.min(rawDt, 0.05)

    if (!seeded.current) {
      seeded.current = true
      pos.current.set(...squareRestPos(piece.square))
      g.position.copy(pos.current)
      g.scale.setScalar(0.9)
    }

    if (prevSquare.current !== piece.square) {
      const to = squareRestPos(piece.square)
      anim.current.from.copy(pos.current)
      anim.current.to.set(to[0], to[1], to[2])
      anim.current.t = 0
      anim.current.active = true
      const dx = Math.abs(to[0] - anim.current.from.x)
      const dz = Math.abs(to[2] - anim.current.from.z)
      const isKnight = piece.type === 'n'
      anim.current.dur = (isKnight ? 0.52 : 0.34) / speed
      anim.current.arc = isKnight ? 0.5 : 0.1 + Math.min(dx + dz, 4) * 0.022
      prevSquare.current = piece.square
    }

    if (prevType.current !== piece.type) {
      prevType.current = piece.type
      pop.current.t = 0
    }

    let y = 0
    if (anim.current.active) {
      const a = anim.current
      a.t = Math.min(1, a.t + dt / a.dur)
      const e = easeInOut(a.t)
      pos.current.lerpVectors(a.from, a.to, e)
      y += Math.sin(Math.PI * e) * a.arc
      if (a.t >= 1) {
        a.active = false
        pos.current.copy(a.to)
      }
    }

    // pieces now rest on the board surface, so a selection lift is a small
    // hop above that resting height
    const targetLift = selected ? 0.07 : 0
    lift.current += (targetLift - lift.current) * Math.min(1, dt * 9)

    spawn.current.t += dt
    const sp = Math.max(0, Math.min(1, (spawn.current.t - spawnDelay) / 0.55))
    const drop = (1 - easeOutBack(sp)) * 0.55

    let scale = 0.9 + 0.1 * sp
    if (pop.current.t < 1) {
      pop.current.t = Math.min(1, pop.current.t + dt / 0.45)
      scale *= 1 + 0.18 * Math.sin(Math.PI * pop.current.t)
    }

    g.position.set(pos.current.x, pos.current.y + lift.current + y + drop, pos.current.z)
    g.scale.setScalar(scale)

    if (checked) {
      const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 260)
      material.emissiveIntensity = 0.28 + pulse * 0.5
    }
  })

  const rotationY = piece.type === 'n' ? (piece.color === 'w' ? Math.PI : 0) : 0

  return (
    <group ref={groupRef}>
      <group rotation={[0, rotationY, 0]}>
        <mesh geometry={geometry} material={material} castShadow receiveShadow />
      </group>
    </group>
  )
})

export function Pieces({
  materials,
  speed,
}: {
  materials: SceneMaterials
  speed: number
}) {
  const pieces = useGame((s) => s.pieces)
  const selected = useGame((s) => s.selected)
  const status = useGame((s) => s.status)
  const anim = useGame((s) => s.anim)
  void anim

  // re-render once the Blender-authored king has finished loading
  const kingReady = useSyncExternalStore(subscribeKingModel, isKingModelReady)
  useEffect(() => {
    void loadKingModel('./models/king.glb')
  }, [])

  const checkedKing = useMemo(() => {
    if (status.kind !== 'playing' || !status.check) return null
    const king = pieces.find((p) => p.type === 'k' && p.color === status.check)
    return king?.square ?? null
  }, [status, pieces])

  return (
    <group>
      {pieces.map((p) => (
        <Piece
          key={p.id}
          piece={p}
          selected={selected === p.square}
          checked={checkedKing === p.square}
          materials={materials}
          speed={speed}
          geoVersion={kingReady ? 1 : 0}
        />
      ))}
    </group>
  )
}

interface GhostProps {
  at: [number, number, number]
  color: Color
  type: string
  materials: SceneMaterials
  onDone: () => void
}

export function CaptureGhost({ at, color, type, materials, onDone }: GhostProps) {
  const ref = useRef<THREE.Group>(null)
  const ringRef = useRef<THREE.Mesh>(null)
  const t = useRef(0)
  const done = useRef(false)
  const geometry = getPieceGeometry(type as PieceType)

  const material = useMemo(() => {
    const base = color === 'w' ? materials.whitePiece : materials.blackPiece
    const m = base.clone()
    m.transparent = true
    m.opacity = 1
    m.depthWrite = false
    return m
  }, [color, materials])

  useFrame((_, rawDt) => {
    const g = ref.current
    if (!g) return
    const dt = Math.min(rawDt, 0.05)
    t.current += dt
    const p = Math.min(1, t.current / 0.62)
    const e = easeInOut(p)
    g.position.set(at[0], at[1] + e * 0.75, at[2])
    const s = 1 - e * 0.85
    g.scale.setScalar(Math.max(0.001, s))
    g.rotation.y = e * 1.1
    material.opacity = Math.max(0, 1 - p * 1.15)

    if (ringRef.current) {
      const rp = Math.min(1, t.current / 0.5)
      const rs = 0.5 + rp * 1.6
      ringRef.current.scale.set(rs, 1, rs)
      const rm = ringRef.current.material as THREE.MeshBasicMaterial
      rm.opacity = Math.max(0, 0.5 * (1 - rp))
    }

    if (p >= 1 && !done.current) {
      done.current = true
      onDone()
    }
  })

  return (
    <group ref={ref} position={at}>
      <group>
        <mesh geometry={geometry} material={material} />
      </group>
      <mesh ref={ringRef} position={[0, -0.54, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.3, 0.42, 40]} />
        <meshBasicMaterial color="#e8b06a" transparent opacity={0.5} depthWrite={false} />
      </mesh>
    </group>
  )
}

export function CaptureFx({ materials }: { materials: SceneMaterials }) {
  const capturedFx = useGame((s) => s.capturedFx)
  const [active, setActive] = useState<typeof capturedFx>(null)

  useEffect(() => {
    if (capturedFx) setActive(capturedFx)
  }, [capturedFx])

  if (!active) return null
  return (
    <CaptureGhost
      key={active.n}
      at={active.at}
      color={active.color}
      type={active.type}
      materials={materials}
      onDone={() => setActive(null)}
    />
  )
}