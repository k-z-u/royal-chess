import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { squareToWorld } from '../game/squares'
import { useGame } from '../game/store'
import { makeGlowTexture } from './textures'

const Y = 0.008

function SquareTint({
  square,
  color,
  opacity,
}: {
  square: string
  color: string
  opacity: number
}) {
  const [x, , z] = squareToWorld(square)
  return (
    <mesh position={[x, Y, z]} renderOrder={3}>
      <planeGeometry args={[0.988, 0.988]} />
      <meshBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} />
    </mesh>
  )
}

export function Highlights() {
  const selected = useGame((s) => s.selected)
  const legalTargets = useGame((s) => s.legalTargets)
  const lastMove = useGame((s) => s.lastMove)
  const pieces = useGame((s) => s.pieces)
  const status = useGame((s) => s.status)
  const showHints = useGame((s) => s.settings.hints)

  const checkSquare = useMemo(() => {
    if (status.kind !== 'playing' || !status.check) return null
    const king = pieces.find((p) => p.type === 'k' && p.color === status.check)
    return king?.square ?? null
  }, [status, pieces])

  const occupied = useMemo(() => {
    const set = new Set<string>()
    for (const p of pieces) set.add(p.square)
    return set
  }, [pieces])

  const dotGeo = useMemo(() => {
    const g = new THREE.CircleGeometry(0.135, 32)
    g.rotateX(-Math.PI / 2)
    return g
  }, [])

  const ringGeo = useMemo(() => {
    const g = new THREE.RingGeometry(0.395, 0.455, 48)
    g.rotateX(-Math.PI / 2)
    return g
  }, [])

  const selRingGeo = useMemo(() => {
    const g = new THREE.RingGeometry(0.415, 0.472, 56)
    g.rotateX(-Math.PI / 2)
    return g
  }, [])

  const checkRef = useRef<THREE.Mesh>(null)
  const glowRef = useRef<THREE.Mesh>(null)
  const checkGeo = useMemo(() => {
    const g = new THREE.RingGeometry(0.3, 0.47, 48)
    g.rotateX(-Math.PI / 2)
    return g
  }, [])
  const glowGeo = useMemo(() => {
    const g = new THREE.PlaneGeometry(1.9, 1.9)
    g.rotateX(-Math.PI / 2)
    return g
  }, [])
  const glowTex = useMemo(() => makeGlowTexture(), [])

  useFrame((state) => {
    const t = state.clock.elapsedTime
    const pulse = 0.5 + 0.5 * Math.sin(t * 3.2)
    if (checkRef.current) {
      const s = 1 + pulse * 0.07
      checkRef.current.scale.set(s, 1, s)
      const mat = checkRef.current.material as THREE.MeshBasicMaterial
      mat.opacity = 0.45 + pulse * 0.45
    }
    if (glowRef.current) {
      const mat = glowRef.current.material as THREE.MeshBasicMaterial
      mat.opacity = 0.35 + pulse * 0.4
      const g = 1 + pulse * 0.06
      glowRef.current.scale.set(g, 1, g)
    }
  })

  return (
    <group>
      {lastMove && (
        <>
          <SquareTint square={lastMove.from} color="#e2b96a" opacity={0.14} />
          <SquareTint square={lastMove.to} color="#e2b96a" opacity={0.2} />
        </>
      )}

      {selected && (
        <>
          <SquareTint square={selected} color="#f2d9a4" opacity={0.16} />
          <mesh
            geometry={selRingGeo}
            position={[
              squareToWorld(selected)[0],
              Y + 0.001,
              squareToWorld(selected)[2],
            ]}
            renderOrder={4}
          >
            <meshBasicMaterial
              color="#f4dcae"
              transparent
              opacity={0.85}
              depthWrite={false}
            />
          </mesh>
        </>
      )}

      {showHints &&
        legalTargets.map((t) => {
          const [x, , z] = squareToWorld(t)
          const isCapture = occupied.has(t)
          return (
            <mesh
              key={t}
              geometry={isCapture ? ringGeo : dotGeo}
              position={[x, Y + 0.0015, z]}
              renderOrder={4}
            >
              <meshBasicMaterial
                color={isCapture ? '#e8a45c' : '#efe0bd'}
                transparent
                opacity={isCapture ? 0.9 : 0.6}
                depthWrite={false}
              />
            </mesh>
          )
        })}

      {checkSquare && (
        <>
          <mesh
            ref={glowRef}
            geometry={glowGeo}
            position={[
              squareToWorld(checkSquare)[0],
              Y + 0.002,
              squareToWorld(checkSquare)[2],
            ]}
            renderOrder={5}
          >
            <meshBasicMaterial
              map={glowTex}
              transparent
              opacity={0.5}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
          <mesh
            ref={checkRef}
            geometry={checkGeo}
            position={[
              squareToWorld(checkSquare)[0],
              Y + 0.004,
              squareToWorld(checkSquare)[2],
            ]}
            renderOrder={6}
          >
            <meshBasicMaterial color="#e0564a" transparent opacity={0.8} depthWrite={false} />
          </mesh>
        </>
      )}
    </group>
  )
}