import { memo, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { ThreeEvent } from '@react-three/fiber'
import { frameRingGeometry, plateTopFace, roundedPlateGeometry } from './plate'
import type { SceneMaterials } from './materials'
import { makeLabelStrip } from './textures'
import { BOARD_HALF, isLightSquare, squareAt, squareToWorld } from '../game/squares'
import { useGame } from '../game/store'
import { wasTap } from './tapGuard'

const FRAME_OUTER = 9.5
const FRAME_INNER = BOARD_HALF * 2
const FRAME_TOP = 0.038
const FRAME_HEIGHT = 0.52
const SQUARE_TOP = 0
const LABEL_RADIUS = FRAME_INNER / 2 + 0.35

const SQUARE_PLATE = { width: 0.988, height: 0.07, radius: 0.02, bevel: 0.006 }

/**
 * World y of the surface the pieces stand on. Highlight overlays have to sit
 * above this, otherwise the square plates draw over them and every hint on the
 * board silently disappears.
 */
export const SURFACE_Y = SQUARE_TOP + plateTopFace(SQUARE_PLATE.height, SQUARE_PLATE.bevel)

interface BoardProps {
  materials: SceneMaterials
  showCoordinates: boolean
}

function BoardBase({ materials, showCoordinates }: BoardProps) {
  const frameGeo = useMemo(
    () => frameRingGeometry(FRAME_OUTER, FRAME_INNER, FRAME_HEIGHT, 0.12, 0.02),
    [],
  )
  const plateGeo = useMemo(() => roundedPlateGeometry(8.12, 8.12, 0.07, 0.03, 0.008), [])
  const bottomGeo = useMemo(() => roundedPlateGeometry(8.4, 8.4, 0.06, 0.05, 0.01), [])

  const inlayGeos = useMemo(() => {
    const half = FRAME_INNER / 2
    const len = FRAME_INNER + 0.06
    const make = (x: number, z: number, w: number, d: number) => {
      const g = new THREE.BoxGeometry(w, 0.018, d)
      g.translate(x, FRAME_TOP + 0.008, z)
      return g
    }
    return [
      make(0, half + 0.035, len, 0.05),
      make(0, -half - 0.035, len, 0.05),
      make(half + 0.035, 0, 0.05, len),
      make(-half - 0.035, 0, 0.05, len),
    ]
  }, [])

  const labelTex = useMemo(
    () => ({
      files: makeLabelStrip('abcdefgh'),
      filesRev: makeLabelStrip('hgfedcba'),
      ranks: makeLabelStrip('87654321'),
      ranksRev: makeLabelStrip('12345678'),
    }),
    [],
  )

  const labels = useMemo(
    () =>
      [
        { pos: [0, FRAME_TOP + 0.004, LABEL_RADIUS] as const, rotY: 0, tex: labelTex.files },
        { pos: [0, FRAME_TOP + 0.004, -LABEL_RADIUS] as const, rotY: Math.PI, tex: labelTex.filesRev },
        { pos: [-LABEL_RADIUS, FRAME_TOP + 0.004, 0] as const, rotY: Math.PI / 2, tex: labelTex.ranksRev },
        { pos: [LABEL_RADIUS, FRAME_TOP + 0.004, 0] as const, rotY: -Math.PI / 2, tex: labelTex.ranks },
      ] as const,
    [labelTex],
  )

  const labelGeo = useMemo(() => {
    const g = new THREE.PlaneGeometry(FRAME_INNER, 0.5)
    g.rotateX(-Math.PI / 2)
    return g
  }, [])

  return (
    <group>
      <mesh
        geometry={frameGeo}
        material={materials.frame}
        position={[0, FRAME_TOP, 0]}
        castShadow
        receiveShadow
      />
      <mesh
        geometry={bottomGeo}
        material={materials.underside}
        position={[0, -FRAME_HEIGHT + 0.06, 0]}
        receiveShadow
      />
      <mesh
        geometry={plateGeo}
        material={materials.boardTop}
        position={[0, -0.014, 0]}
        receiveShadow
      />
      {inlayGeos.map((g, i) => (
        <mesh key={i} geometry={g} material={materials.inlay} />
      ))}
      {showCoordinates &&
        labels.map((l, i) => (
          <group key={i} position={l.pos as unknown as [number, number, number]} rotation={[0, l.rotY, 0]}>
            <mesh geometry={labelGeo} renderOrder={1}>
              <meshBasicMaterial map={l.tex} transparent depthWrite={false} opacity={0.92} />
            </mesh>
          </group>
        ))}
    </group>
  )
}

function Squares({ materials }: { materials: SceneMaterials }) {
  const selectSquare = useGame((s) => s.selectSquare)
  const setHoverSquare = useGame((s) => s.setHoverSquare)
  const hoverRef = useRef<THREE.Mesh>(null)

  const geo = useMemo(
    () =>
      roundedPlateGeometry(
        SQUARE_PLATE.width,
        SQUARE_PLATE.width,
        SQUARE_PLATE.height,
        SQUARE_PLATE.radius,
        SQUARE_PLATE.bevel,
      ),
    [],
  )

  const squares = useMemo(() => {
    const out: { sq: string; pos: [number, number, number]; light: boolean; alt: boolean }[] = []
    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        const sq = squareAt(f, r)
        const [x, , z] = squareToWorld(sq)
        out.push({ sq, pos: [x, SQUARE_TOP, z], light: isLightSquare(sq), alt: r % 2 === 1 })
      }
    }
    return out
  }, [])

  const handleClick = (e: ThreeEvent<MouseEvent>, sq: string) => {
    if (!wasTap(e)) return
    e.stopPropagation()
    selectSquare(sq)
  }

  return (
    <group>
      {squares.map((s) => (
        <mesh
          key={s.sq}
          geometry={geo}
          material={
            s.light
              ? s.alt
                ? materials.lightSquareAlt
                : materials.lightSquare
              : s.alt
                ? materials.darkSquareAlt
                : materials.darkSquare
          }
          position={s.pos}
          receiveShadow
          onClick={(e) => handleClick(e, s.sq)}
          onPointerOver={(e) => {
            e.stopPropagation()
            if (hoverRef.current) {
              hoverRef.current.position.set(s.pos[0], SURFACE_Y + 0.002, s.pos[2])
              hoverRef.current.visible = true
            }
            setHoverSquare(s.sq)
            document.body.style.cursor = 'pointer'
          }}
          onPointerOut={() => {
            if (hoverRef.current) hoverRef.current.visible = false
            setHoverSquare(null)
            document.body.style.cursor = 'default'
          }}
        />
      ))}
      <mesh ref={hoverRef} visible={false} renderOrder={2} raycast={() => null}>
        <planeGeometry args={[0.99, 0.99]} />
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={0.07}
          depthWrite={false}
        />
      </mesh>
    </group>
  )
}

export const Board = memo(function Board(props: BoardProps) {
  return (
    <group>
      <BoardBase {...props} />
      <Squares materials={props.materials} />
    </group>
  )
})