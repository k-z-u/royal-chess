import * as THREE from 'three'
import { makeRoughnessTexture, makeStoneTexture, makeWoodTexture } from './textures'

export type BoardTheme = 'walnut' | 'charcoal' | 'marble'
export type PieceFinish = 'classic' | 'stone' | 'brass'

export interface SceneMaterials {
  lightSquare: THREE.MeshPhysicalMaterial
  darkSquare: THREE.MeshPhysicalMaterial
  lightSquareAlt: THREE.MeshPhysicalMaterial
  darkSquareAlt: THREE.MeshPhysicalMaterial
  frame: THREE.MeshPhysicalMaterial
  inlay: THREE.MeshStandardMaterial
  whitePiece: THREE.MeshPhysicalMaterial
  blackPiece: THREE.MeshPhysicalMaterial
  boardTop: THREE.MeshPhysicalMaterial
  underside: THREE.MeshStandardMaterial
  label: THREE.MeshBasicMaterial
  dispose: () => void
}

export function createMaterials(theme: BoardTheme, finish: PieceFinish): SceneMaterials {
  const disposables: Array<THREE.Material | THREE.Texture> = []

  const rough = makeRoughnessTexture(finish === 'stone' ? 23 : 11)
  rough.repeat.set(3, 3)
  disposables.push(rough)

  const track = <T extends THREE.Material | THREE.Texture>(x: T) => {
    disposables.push(x)
    return x
  }

  let lightMap: THREE.Texture
  let darkMap: THREE.Texture
  let frameMap: THREE.Texture
  let boardTopMap: THREE.Texture

  if (theme === 'marble') {
    lightMap = track(
      makeStoneTexture({ base: '#e6e2da', vein: '#8d8880', seed: 5 }),
    )
    darkMap = track(makeStoneTexture({ base: '#4a4f55', vein: '#20242a', seed: 9 }))
    frameMap = track(makeStoneTexture({ base: '#2b2f34', vein: '#14171a', seed: 17 }))
    boardTopMap = frameMap
  } else if (theme === 'charcoal') {
    lightMap = track(
      makeWoodTexture({ base: '#8f8a80', light: '#b9b3a6', dark: '#5d584f', seed: 21, ringCount: 18 }),
    )
    darkMap = track(
      makeWoodTexture({ base: '#3a3733', light: '#54504a', dark: '#1d1b19', seed: 33, ringCount: 18 }),
    )
    frameMap = track(
      makeWoodTexture({ base: '#211f1c', light: '#3b3833', dark: '#0e0d0c', seed: 41, ringCount: 22 }),
    )
    boardTopMap = frameMap
  } else {
    lightMap = track(
      makeWoodTexture({ base: '#c8a878', light: '#e0c79b', dark: '#9c7a4e', seed: 13, ringCount: 22 }),
    )
    darkMap = track(
      makeWoodTexture({ base: '#6b4429', light: '#8a5c38', dark: '#3d2415', seed: 29, ringCount: 22 }),
    )
    frameMap = track(
      makeWoodTexture({ base: '#3a2317', light: '#5a3a25', dark: '#1c110a', seed: 37, ringCount: 26 }),
    )
    boardTopMap = frameMap
  }

  // grain runs across the board: rotate the two square maps so rows alternate
  lightMap.repeat.set(1, 1)
  darkMap.repeat.set(1, 1)
  frameMap.repeat.set(1, 1)

  const lightSquare = track(
    new THREE.MeshPhysicalMaterial({
      map: lightMap,
      roughnessMap: rough,
      roughness: 0.52,
      metalness: 0,
      clearcoat: 0.45,
      clearcoatRoughness: 0.35,
      envMapIntensity: 0.7,
    }),
  ) as THREE.MeshPhysicalMaterial

  const darkSquare = track(
    new THREE.MeshPhysicalMaterial({
      map: darkMap,
      roughnessMap: rough,
      roughness: 0.46,
      metalness: 0,
      clearcoat: 0.55,
      clearcoatRoughness: 0.3,
      envMapIntensity: 0.8,
    }),
  ) as THREE.MeshPhysicalMaterial

  // alternate grain direction variants (cloned so repeats differ)
  const lightMap2 = track(lightMap.clone())
  lightMap2.needsUpdate = true
  lightMap2.repeat.set(1, 1)
  lightMap2.rotation = Math.PI / 2
  lightMap2.center.set(0.5, 0.5)

  const darkMap2 = track(darkMap.clone())
  darkMap2.needsUpdate = true
  darkMap2.repeat.set(1, 1)
  darkMap2.rotation = Math.PI / 2
  darkMap2.center.set(0.5, 0.5)

  const lightSquareAlt = track(
    lightSquare.clone(),
  ) as THREE.MeshPhysicalMaterial
  lightSquareAlt.map = lightMap2

  const darkSquareAlt = track(darkSquare.clone()) as THREE.MeshPhysicalMaterial
  darkSquareAlt.map = darkMap2

  const frame = track(
    new THREE.MeshPhysicalMaterial({
      map: frameMap,
      roughnessMap: rough,
      roughness: 0.42,
      metalness: 0.05,
      clearcoat: 0.6,
      clearcoatRoughness: 0.28,
      envMapIntensity: 0.9,
      color: new THREE.Color(theme === 'marble' ? '#ffffff' : '#ffffff'),
    }),
  ) as THREE.MeshPhysicalMaterial

  const inlay = track(
    new THREE.MeshStandardMaterial({
      color: finish === 'brass' ? '#c9a227' : '#8a6f3c',
      metalness: 0.95,
      roughness: 0.28,
      envMapIntensity: 1.2,
    }),
  ) as THREE.MeshStandardMaterial

  const boardTop = track(
    new THREE.MeshPhysicalMaterial({
      map: boardTopMap,
      roughnessMap: rough,
      roughness: 0.55,
      metalness: 0,
      clearcoat: 0.2,
      clearcoatRoughness: 0.5,
      envMapIntensity: 0.4,
    }),
  ) as THREE.MeshPhysicalMaterial

  const underside = track(
    new THREE.MeshStandardMaterial({
      color: '#14100d',
      roughness: 0.9,
      metalness: 0,
    }),
  ) as THREE.MeshStandardMaterial

  const label = track(
    new THREE.MeshBasicMaterial({
      transparent: true,
      depthWrite: false,
      opacity: 0.85,
    }),
  ) as THREE.MeshBasicMaterial

  let whitePiece: THREE.MeshPhysicalMaterial
  let blackPiece: THREE.MeshPhysicalMaterial

  if (finish === 'stone') {
    const wMap = track(makeStoneTexture({ base: '#efeae0', vein: '#b7ada0', seed: 61 }))
    const bMap = track(makeStoneTexture({ base: '#24272c', vein: '#0c0e10', seed: 67 }))
    whitePiece = track(
      new THREE.MeshPhysicalMaterial({
        map: wMap,
        roughness: 0.16,
        metalness: 0,
        clearcoat: 1,
        clearcoatRoughness: 0.08,
        envMapIntensity: 1.1,
        sheen: 0.35,
        sheenColor: new THREE.Color('#fff6e8'),
      }),
    ) as THREE.MeshPhysicalMaterial
    blackPiece = track(
      new THREE.MeshPhysicalMaterial({
        map: bMap,
        roughness: 0.14,
        metalness: 0.05,
        clearcoat: 1,
        clearcoatRoughness: 0.06,
        envMapIntensity: 1.3,
        sheen: 0.25,
        sheenColor: new THREE.Color('#6d7a8c'),
      }),
    ) as THREE.MeshPhysicalMaterial
  } else if (finish === 'brass') {
    whitePiece = track(
      new THREE.MeshPhysicalMaterial({
        color: '#d8b978',
        roughness: 0.22,
        metalness: 0.98,
        clearcoat: 0.6,
        clearcoatRoughness: 0.2,
        envMapIntensity: 1.5,
      }),
    ) as THREE.MeshPhysicalMaterial
    blackPiece = track(
      new THREE.MeshPhysicalMaterial({
        color: '#3c4048',
        roughness: 0.24,
        metalness: 0.96,
        clearcoat: 0.6,
        clearcoatRoughness: 0.22,
        envMapIntensity: 1.6,
      }),
    ) as THREE.MeshPhysicalMaterial
  } else {
    const wMap = track(
      makeWoodTexture({ base: '#e9dfc8', light: '#f6efdd', dark: '#c9b993', seed: 71, ringCount: 30, grainStrength: 0.7 }),
    )
    const bMap = track(
      makeWoodTexture({ base: '#2a1c13', light: '#463020', dark: '#150c07', seed: 83, ringCount: 30, grainStrength: 0.7 }),
    )
    wMap.repeat.set(2, 2)
    bMap.repeat.set(2, 2)
    whitePiece = track(
      new THREE.MeshPhysicalMaterial({
        map: wMap,
        roughnessMap: rough,
        roughness: 0.3,
        metalness: 0,
        clearcoat: 0.85,
        clearcoatRoughness: 0.16,
        envMapIntensity: 0.95,
        sheen: 0.3,
        sheenColor: new THREE.Color('#fff3dd'),
      }),
    ) as THREE.MeshPhysicalMaterial
    blackPiece = track(
      new THREE.MeshPhysicalMaterial({
        map: bMap,
        roughnessMap: rough,
        roughness: 0.26,
        metalness: 0,
        clearcoat: 0.95,
        clearcoatRoughness: 0.12,
        envMapIntensity: 1.1,
        sheen: 0.2,
        sheenColor: new THREE.Color('#7a6a55'),
      }),
    ) as THREE.MeshPhysicalMaterial
  }

  return {
    lightSquare,
    darkSquare,
    lightSquareAlt,
    darkSquareAlt,
    frame,
    inlay,
    whitePiece,
    blackPiece,
    boardTop,
    underside,
    label,
    dispose: () => {
      for (const d of disposables) d.dispose()
    },
  }
}