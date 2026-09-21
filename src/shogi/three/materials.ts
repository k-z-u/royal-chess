/**
 * Materials for the board, the stands and the pieces.
 *
 * The kanji face of a piece depends on its packed code (piece *and* colour *and*
 * whether it has been promoted), so those materials are built lazily and cached
 * by code — a game never needs more than a handful of them.
 */
import * as THREE from 'three'
import { isPromoted } from '../game/position.ts'
import { pieceName } from '../game/notation.ts'
import { BOARD_PALETTES, makeBoardTexture, makeKomaTexture, makeWoodTexture } from './textures'

// the settings in the store are the single source of truth for these two, so a
// theme picked in the dialog always has matching materials here
export type { BoardTheme, PieceFinish } from '../game/store.ts'
import type { BoardTheme, PieceFinish } from '../game/store.ts'

interface WoodRecipe {
  base: string
  light: string
  dark: string
  /** ink colour for a plain piece, and for a 成駒 */
  ink: string
  promotedInk: string
  seed: number
}

const PIECE_WOOD: Record<PieceFinish, WoodRecipe> = {
  tsuge: {
    base: '#f0dca6',
    light: '#fdf3cf',
    dark: '#d6b878',
    ink: '#1f180f',
    promotedInk: '#b8301f',
    seed: 71,
  },
  kaba: {
    base: '#e0bd85',
    light: '#f3dcb2',
    dark: '#b98f57',
    ink: '#241a10',
    promotedInk: '#a8291b',
    seed: 83,
  },
  sumi: {
    base: '#2e2a26',
    light: '#443d36',
    dark: '#191614',
    ink: '#f0dfae',
    promotedInk: '#ff8a63',
    seed: 97,
  },
}

export interface SceneMaterials {
  boardTop: THREE.MeshPhysicalMaterial
  boardEdge: THREE.MeshPhysicalMaterial
  boardSide: THREE.MeshStandardMaterial
  standTop: THREE.MeshPhysicalMaterial
  standSide: THREE.MeshStandardMaterial
  pieceSide: THREE.MeshPhysicalMaterial
  /** the kanji face for a packed piece code */
  faceFor: (code: number) => THREE.MeshPhysicalMaterial
  dispose: () => void
}

export function createMaterials(theme: BoardTheme, finish: PieceFinish): SceneMaterials {
  const disposables: Array<THREE.Material | THREE.Texture> = []
  const track = <T extends THREE.Material | THREE.Texture>(x: T): T => {
    disposables.push(x)
    return x
  }

  const palette = BOARD_PALETTES[theme] ?? BOARD_PALETTES.kaya
  const wood = PIECE_WOOD[finish] ?? PIECE_WOOD.tsuge

  const boardMap = track(makeBoardTexture(palette))
  const boardGrain = track(
    makeWoodTexture({
      base: palette.base,
      light: palette.light,
      dark: palette.dark,
      seed: palette.seed + 3,
      ringCount: 20,
      grainStrength: 0.6,
    }),
  )
  boardGrain.repeat.set(1, 1)

  const boardTop = track(
    new THREE.MeshPhysicalMaterial({
      map: boardMap,
      roughness: 0.46,
      metalness: 0,
      clearcoat: 0.4,
      clearcoatRoughness: 0.34,
      envMapIntensity: 0.65,
    }),
  ) as THREE.MeshPhysicalMaterial

  const boardEdge = track(
    new THREE.MeshPhysicalMaterial({
      map: boardGrain,
      roughness: 0.52,
      metalness: 0,
      clearcoat: 0.35,
      clearcoatRoughness: 0.4,
      envMapIntensity: 0.6,
    }),
  ) as THREE.MeshPhysicalMaterial

  const boardSide = track(
    new THREE.MeshStandardMaterial({
      color: theme === 'sumi' ? '#171513' : '#6b4a24',
      roughness: 0.82,
      metalness: 0,
    }),
  ) as THREE.MeshStandardMaterial

  const standWood = track(
    makeWoodTexture({
      base: theme === 'sumi' ? '#332e28' : '#c89a5d',
      light: theme === 'sumi' ? '#443c34' : '#e0bd8a',
      dark: theme === 'sumi' ? '#211d1a' : '#9a6f3c',
      seed: palette.seed + 11,
      ringCount: 22,
    }),
  )

  const standTop = track(
    new THREE.MeshPhysicalMaterial({
      map: standWood,
      roughness: 0.5,
      clearcoat: 0.35,
      clearcoatRoughness: 0.4,
      envMapIntensity: 0.6,
    }),
  ) as THREE.MeshPhysicalMaterial

  const standSide = track(
    new THREE.MeshStandardMaterial({ color: theme === 'sumi' ? '#141210' : '#7a5427', roughness: 0.85 }),
  ) as THREE.MeshStandardMaterial

  const pieceWoodMap = track(
    makeWoodTexture({
      base: wood.base,
      light: wood.light,
      dark: wood.dark,
      seed: wood.seed,
      ringCount: 34,
      grainStrength: 0.55,
    }),
  )
  pieceWoodMap.repeat.set(2, 2)

  const pieceSide = track(
    new THREE.MeshPhysicalMaterial({
      map: pieceWoodMap,
      roughness: 0.38,
      metalness: 0,
      clearcoat: 0.75,
      clearcoatRoughness: 0.22,
      envMapIntensity: 0.85,
      sheen: 0.25,
      sheenColor: new THREE.Color(wood.light),
    }),
  ) as THREE.MeshPhysicalMaterial

  const faces = new Map<number, THREE.MeshPhysicalMaterial>()
  const faceFor = (code: number): THREE.MeshPhysicalMaterial => {
    const existing = faces.get(code)
    if (existing) return existing
    const promoted = isPromoted(code)
    const texture = track(
      makeKomaTexture({
        glyph: pieceName(code),
        base: wood.base,
        light: wood.light,
        dark: wood.dark,
        ink: promoted ? wood.promotedInk : wood.ink,
        seed: wood.seed + Math.abs(code) * 7,
      }),
    )
    const material = track(
      new THREE.MeshPhysicalMaterial({
        map: texture,
        roughness: 0.34,
        metalness: 0,
        clearcoat: 0.85,
        clearcoatRoughness: 0.18,
        envMapIntensity: 0.95,
      }),
    ) as THREE.MeshPhysicalMaterial
    faces.set(code, material)
    return material
  }

  return {
    boardTop,
    boardEdge,
    boardSide,
    standTop,
    standSide,
    pieceSide,
    faceFor,
    dispose: () => {
      for (const d of disposables) d.dispose()
      faces.clear()
    },
  }
}

/** The face texture for a piece lying on a stand, with its count printed on. */
export function makeStandFaceTexture(
  code: number,
  finish: PieceFinish,
  count: number,
  cache: Map<string, THREE.Texture>,
): THREE.Texture {
  const key = `${code}:${count}`
  const hit = cache.get(key)
  if (hit) return hit
  const wood = PIECE_WOOD[finish] ?? PIECE_WOOD.tsuge
  const promoted = isPromoted(code)
  const texture = makeKomaTexture({
    glyph: pieceName(code),
    base: wood.base,
    light: wood.light,
    dark: wood.dark,
    ink: promoted ? wood.promotedInk : wood.ink,
    seed: wood.seed + Math.abs(code) * 7 + count,
    count,
  })
  cache.set(key, texture)
  return texture
}
