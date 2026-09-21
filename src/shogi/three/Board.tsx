import { memo, useMemo } from 'react'
import * as THREE from 'three'
import type { ThreeEvent } from '@react-three/fiber'
import { useGame } from '../game/store'
import { BOARD_THICKNESS, HALF, SPAN, worldToSquare } from '../game/squares'
import { makeLabelStrip } from './textures'
import type { SceneMaterials } from './materials'
import { wasTap } from './tapGuard'

/** The frame around the playing surface, in world units. */
const FRAME = 0.28
const SLAB = SPAN + FRAME * 2
const LABEL_DEPTH = 0.3

function Labels({ edge, dark }: { edge: 'near' | 'far' | 'left' | 'right'; dark: boolean }) {
  const color = dark ? '#efdfb4' : '#f6e8c4'
  // 先手 reads files 9…1 left to right, and ranks 一…九 up the side
  const texture = useMemo(() => {
    if (edge === 'near' || edge === 'far') return makeLabelStrip('987654321', color)
    return makeLabelStrip('一二三四五六七八九', color)
  }, [edge, color])

  const geometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(SPAN, LABEL_DEPTH)
    g.rotateX(-Math.PI / 2)
    return g
  }, [])

  const [x, z, rotY] =
    edge === 'near'
      ? [0, HALF + FRAME / 2, 0]
      : edge === 'far'
        ? [0, -HALF - FRAME / 2, Math.PI]
        : edge === 'right'
          ? [HALF + FRAME / 2, 0, -Math.PI / 2]
          : [-HALF - FRAME / 2, 0, Math.PI / 2]

  return (
    <group position={[x as number, -0.006, z as number]} rotation={[0, rotY as number, 0]}>
      <mesh geometry={geometry} renderOrder={1}>
        <meshBasicMaterial map={texture} transparent depthWrite={false} opacity={0.9} />
      </mesh>
    </group>
  )
}

function Slab({ materials }: { materials: SceneMaterials }) {
  return (
    <>
      <mesh position={[0, -BOARD_THICKNESS / 2 - 0.012, 0]} castShadow receiveShadow>
        <boxGeometry args={[SLAB, BOARD_THICKNESS, SLAB]} />
        <primitive object={materials.boardEdge} attach="material" />
      </mesh>
      {/* the four darker cheeks of a real 盤 */}
      <mesh position={[0, -BOARD_THICKNESS - 0.05, 0]} castShadow>
        <boxGeometry args={[SLAB * 0.96, 0.08, SLAB * 0.96]} />
        <primitive object={materials.boardSide} attach="material" />
      </mesh>
    </>
  )
}

/** The playing surface itself, and the layer that turns a tap into a square. */
function Surface() {
  const selectSquare = useGame((s) => s.selectSquare)

  const handle = (e: ThreeEvent<MouseEvent>) => {
    if (!wasTap(e)) return
    const sq = worldToSquare(e.point.x, e.point.z)
    if (sq === null) return
    e.stopPropagation()
    selectSquare(sq)
  }

  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0.0035, 0]}
      onClick={handle}
      onPointerOver={() => {
        document.body.style.cursor = 'pointer'
      }}
      onPointerOut={() => {
        document.body.style.cursor = 'default'
      }}
    >
      <planeGeometry args={[SPAN, SPAN]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  )
}

export const Board = memo(function Board({ materials }: { materials: SceneMaterials }) {
  const theme = useGame((s) => s.settings.board)
  const coordinates = useGame((s) => s.settings.coordinates)
  const dark = theme === 'sumi'

  const geometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(SPAN, SPAN)
    g.rotateX(-Math.PI / 2)
    return g
  }, [])

  return (
    <group>
      <Slab materials={materials} />
      <mesh geometry={geometry} position={[0, -0.002, 0]} receiveShadow>
        <primitive object={materials.boardTop} attach="material" />
      </mesh>
      {coordinates && (
        <>
          <Labels edge="near" dark={dark} />
          <Labels edge="far" dark={dark} />
          <Labels edge="right" dark={dark} />
          <Labels edge="left" dark={dark} />
        </>
      )}
      <Surface />
    </group>
  )
})
