import { memo, useMemo } from 'react'
import type { ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { BLACK, WHITE, type Color } from '../game/position.ts'
import { useGame } from '../game/store'
import type { HandCounts } from '../game/rules.ts'
import { facingYaw, HALF } from '../game/squares'
import { flatKomaGeometry } from './pieceGeometry'
import { makeStandFaceTexture, type SceneMaterials } from './materials'
import { wasTap } from './tapGuard'

/** The stand's own size, and where it sits beside the board. */
const STAND_W = 2.2
const STAND_D = 2.5
const STAND_H = 0.11
const STAND_X = HALF + STAND_W / 2 + 0.34
const STAND_Z = 2.9

/** The hand pieces, largest first, in the order a scoresheet would list them. */
const ORDER = [7, 6, 5, 4, 3, 2, 1]

/** Base piece code → the key the rules use for that piece in hand. */
const HAND_KEY: Record<number, keyof HandCounts> = {
  1: 'pawn',
  2: 'lance',
  3: 'knight',
  4: 'silver',
  5: 'gold',
  6: 'bishop',
  7: 'rook',
}

function countOf(counts: HandCounts, type: number): number {
  const key = HAND_KEY[type]
  return key ? counts[key] : 0
}

/** Slots on the stand: two columns of four. */
const SLOTS: [number, number][] = [
  [-0.5, -0.86],
  [0.5, -0.86],
  [-0.5, -0.3],
  [0.5, -0.3],
  [-0.5, 0.26],
  [0.5, 0.26],
  [-0.5, 0.82],
]

const textureCache = new Map<string, THREE.Texture>()

function HandKoma({
  color,
  type,
  count,
  slot,
  finish,
  selected,
  droppable,
}: {
  color: Color
  type: number
  count: number
  slot: [number, number]
  finish: 'tsuge' | 'kaba' | 'sumi'
  selected: boolean
  droppable: boolean
}) {
  const selectHand = useGame((s) => s.selectHand)
  const geometry = useMemo(() => flatKomaGeometry(), [])
  const texture = useMemo(
    () => makeStandFaceTexture(type * color, finish, count, textureCache),
    [color, type, count, finish],
  )

  const handle = (e: ThreeEvent<MouseEvent>) => {
    if (!wasTap(e)) return
    e.stopPropagation()
    selectHand(selected ? null : { color, type })
  }

  return (
    <group
      position={[slot[0], STAND_H / 2 + 0.004, slot[1]]}
      rotation={[0, facingYaw(color === BLACK), 0]}
      onClick={handle}
      onPointerOver={(e) => {
        e.stopPropagation()
        if (droppable) document.body.style.cursor = 'pointer'
      }}
      onPointerOut={() => {
        document.body.style.cursor = 'default'
      }}
    >
      <mesh geometry={geometry} renderOrder={5}>
        <meshPhysicalMaterial
          map={texture}
          roughness={0.36}
          clearcoat={0.8}
          clearcoatRoughness={0.2}
          envMapIntensity={0.9}
        />
      </mesh>
      {selected && (
        <mesh geometry={geometry} position={[0, 0.003, 0]} renderOrder={6}>
          <meshBasicMaterial color="#f0cf85" transparent opacity={0.35} depthWrite={false} />
        </mesh>
      )}
    </group>
  )
}

function Stand({ color, materials }: { color: Color; materials: SceneMaterials }) {
  const hands = useGame((s) => s.hands)
  const hand = useGame((s) => s.hand)
  const turn = useGame((s) => s.turn)
  const finish = useGame((s) => s.settings.finish)
  const status = useGame((s) => s.status)

  const black = color === BLACK
  const counts: HandCounts = hands[black ? 0 : 1]
  // the stand sits beside its owner, towards that owner's end of the board
  const z = black ? STAND_Z : -STAND_Z
  const x = black ? STAND_X : -STAND_X - 0.1

  const droppable = status.kind === 'playing' && turn === color
  const rows = useMemo(() => ORDER.filter((type) => countOf(counts, type) > 0), [counts])

  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, -STAND_H / 2 - 0.062, 0]} castShadow receiveShadow>
        <boxGeometry args={[STAND_W, STAND_H, STAND_D]} />
        <primitive object={materials.standTop} attach="material" />
      </mesh>
      <mesh position={[0, -STAND_H - 0.11, 0]} castShadow>
        <boxGeometry args={[STAND_W * 0.94, 0.1, STAND_D * 0.94]} />
        <primitive object={materials.standSide} attach="material" />
      </mesh>
      {rows.map((type, i) => (
        <HandKoma
          key={type}
          color={color}
          type={type}
          count={countOf(counts, type)}
          slot={SLOTS[i] ?? [0, 0]}
          finish={finish}
          selected={hand?.color === color && hand.type === type}
          droppable={droppable}
        />
      ))}
    </group>
  )
}

export const Hands = memo(function Hands({ materials }: { materials: SceneMaterials }) {
  // both stands are always on the table — a player wants to see what the
  // opponent is holding, the same as looking across a real board
  return (
    <group>
      <Stand color={BLACK} materials={materials} />
      <Stand color={WHITE} materials={materials} />
    </group>
  )
})
