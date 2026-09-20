import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { PieceType } from '../game/types'

const SEG = 96

/** Lathe geometries are indexed, ExtrudeGeometry is not — normalise before merging. */
function mergeAll(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const flat = geos.map((g) => (g.index ? g.toNonIndexed() : g))
  const merged = mergeGeometries(flat)
  if (!merged) throw new Error('geometry merge failed')
  merged.computeVertexNormals()
  return merged
}

function lathe(points: [number, number][], segments = SEG): THREE.BufferGeometry {
  const v = points.map(([x, y]) => new THREE.Vector2(Math.max(x, 0.0008), y))
  const g = new THREE.LatheGeometry(v, segments)
  g.computeVertexNormals()
  return g
}

/** A turned collar — a horizontal torus ring sitting at height `y`. */
function collar(radius: number, tube: number, y: number, segments = SEG): THREE.BufferGeometry {
  const g = new THREE.TorusGeometry(radius, tube, 14, segments)
  g.rotateX(Math.PI / 2)
  g.translate(0, y, 0)
  return g
}

function orb(radius: number, y: number, widthSeg = 24, heightSeg = 18): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(radius, widthSeg, heightSeg)
  g.translate(0, y, 0)
  return g
}

/** A crown point: a cone whose base sits at `base` and rises `height`. */
function spike(radius: number, height: number, base: number, x = 0, z = 0): THREE.BufferGeometry {
  const g = new THREE.ConeGeometry(radius, height, 16)
  g.translate(x, base + height / 2, z)
  return g
}

/** shared turned base: flat underside, moulded foot, cove, and stem start */
function baseProfile(scale = 1): [number, number][] {
  const p: [number, number][] = [
    [0.0, 0.0],
    [0.2, 0.0],
    [0.3, 0.0],
    [0.322, 0.004],
    [0.332, 0.012],
    [0.335, 0.024],
    [0.332, 0.036],
    [0.322, 0.048],
    [0.302, 0.06],
    [0.276, 0.072],
    [0.25, 0.084],
    [0.228, 0.096],
    [0.212, 0.11],
    [0.2, 0.128],
    [0.192, 0.148],
    [0.188, 0.17],
  ]
  return p.map(([x, y]) => [x * scale, y * scale])
}

function pawnProfile(): [number, number][] {
  const p = baseProfile()
  p.push(
    [0.176, 0.2],
    [0.164, 0.24],
    [0.156, 0.29],
    [0.158, 0.34],
    [0.172, 0.372],
    [0.184, 0.392],
    [0.176, 0.412],
    [0.152, 0.428],
    [0.132, 0.446],
    [0.15, 0.472],
    [0.18, 0.5],
    [0.204, 0.53],
    [0.214, 0.562],
    [0.21, 0.594],
    [0.192, 0.624],
    [0.16, 0.648],
    [0.118, 0.664],
    [0.07, 0.672],
    [0.03, 0.675],
    [0.0, 0.676],
  )
  return p
}

/** A tall, flat-topped tower, ready for the battlements to sit on the rim. */
function rookProfile(): [number, number][] {
  const p = baseProfile()
  p.push(
    [0.19, 0.2],
    [0.194, 0.25],
    [0.2, 0.32],
    [0.206, 0.4],
    [0.212, 0.47],
    [0.222, 0.53],
    [0.238, 0.575],
    [0.262, 0.61],
    [0.284, 0.638],
    [0.294, 0.66],
    [0.29, 0.678],
    [0.272, 0.69],
    [0.256, 0.696],
    [0.262, 0.706],
    [0.272, 0.714],
    [0.272, 0.722],
    [0.26, 0.728],
    [0.236, 0.73],
    [0.0, 0.724],
  )
  return p
}

/** Slender body tapering into a pointed mitre. */
function bishopProfile(): [number, number][] {
  const p = baseProfile()
  p.push(
    [0.178, 0.2],
    [0.166, 0.26],
    [0.158, 0.32],
    [0.16, 0.37],
    [0.174, 0.402],
    [0.188, 0.422],
    [0.18, 0.442],
    [0.154, 0.46],
    [0.134, 0.478],
    [0.15, 0.504],
    [0.178, 0.532],
    [0.202, 0.562],
    [0.218, 0.596],
    [0.226, 0.632],
    [0.222, 0.668],
    [0.206, 0.702],
    [0.176, 0.732],
    [0.136, 0.758],
    [0.09, 0.78],
    [0.05, 0.798],
    [0.022, 0.812],
    [0.008, 0.824],
    [0.0, 0.836],
  )
  return p
}

function queenProfile(): [number, number][] {
  const p = baseProfile()
  p.push(
    [0.2, 0.2],
    [0.188, 0.26],
    [0.182, 0.33],
    [0.186, 0.39],
    [0.2, 0.43],
    [0.214, 0.452],
    [0.206, 0.474],
    [0.178, 0.492],
    [0.152, 0.51],
    [0.146, 0.53],
    [0.166, 0.556],
    [0.196, 0.588],
    [0.224, 0.624],
    [0.246, 0.664],
    [0.258, 0.706],
    [0.262, 0.746],
    [0.258, 0.78],
    [0.246, 0.806],
    [0.228, 0.822],
    [0.206, 0.83],
    [0.19, 0.826],
    [0.182, 0.812],
    [0.182, 0.796],
    [0.19, 0.782],
    [0.204, 0.774],
    [0.216, 0.77],
    [0.208, 0.762],
    [0.15, 0.756],
    [0.0, 0.752],
  )
  return p
}

function kingProfile(): [number, number][] {
  const p = baseProfile()
  p.push(
    [0.206, 0.2],
    [0.194, 0.26],
    [0.188, 0.34],
    [0.192, 0.4],
    [0.206, 0.44],
    [0.22, 0.462],
    [0.212, 0.484],
    [0.184, 0.502],
    [0.158, 0.52],
    [0.152, 0.542],
    [0.172, 0.568],
    [0.204, 0.602],
    [0.234, 0.64],
    [0.258, 0.682],
    [0.272, 0.726],
    [0.278, 0.768],
    [0.274, 0.802],
    [0.26, 0.828],
    [0.238, 0.844],
    [0.212, 0.85],
    [0.192, 0.844],
    [0.182, 0.83],
    [0.182, 0.812],
    [0.192, 0.798],
    [0.206, 0.79],
    [0.216, 0.786],
    [0.206, 0.778],
    [0.15, 0.772],
    [0.0, 0.768],
  )
  return p
}

/** Battlements for the rook crown. */
function rookCrown(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = []
  const count = 6
  const r = 0.24
  const toothW = 0.12
  const toothH = 0.098
  const toothD = 0.055
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + Math.PI / count
    const g = new THREE.BoxGeometry(toothD, toothH, toothW)
    g.translate(r, 0.704 + toothH / 2, 0)
    g.rotateY(a)
    parts.push(g)
  }
  return mergeAll(parts)
}

/** Coronet: a band of pointed spikes, each tipped with a bead — unmistakably a crown. */
function queenCoronet(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = []
  const count = 8
  const ringR = 0.19
  const base = 0.78
  const h = 0.16
  parts.push(collar(0.212, 0.03, 0.776))
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2
    const x = Math.cos(a) * ringR
    const z = Math.sin(a) * ringR
    parts.push(spike(0.052, h, base, x, z))
    parts.push(orb(0.032, base + h + 0.01, 16, 12).translate(x, 0, z))
  }
  return mergeAll(parts)
}

/** A tall cross rising from a crown band. */
function kingCross(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = []
  parts.push(collar(0.212, 0.028, 0.858))
  const v = new THREE.BoxGeometry(0.05, 0.19, 0.05)
  v.translate(0, 0.945, 0)
  const h = new THREE.BoxGeometry(0.05, 0.05, 0.14)
  h.translate(0, 0.975, 0)
  parts.push(v, h)
  parts.push(orb(0.03, 1.055, 18, 14))
  return mergeAll(parts)
}

/** A bead sitting on the tip of the bishop's mitre. */
function bishopFinial(): THREE.BufferGeometry {
  return orb(0.042, 0.862, 20, 14)
}

/** Stylised horse head for the knight, extruded with a soft bevel. */
function knightHead(): THREE.BufferGeometry {
  const s = new THREE.Shape()
  // profile drawn in the X (forward) / Y (up) plane
  s.moveTo(-0.11, 0.0)
  s.bezierCurveTo(-0.17, 0.08, -0.2, 0.2, -0.205, 0.3)
  s.bezierCurveTo(-0.21, 0.37, -0.19, 0.42, -0.165, 0.45)
  s.bezierCurveTo(-0.2, 0.5, -0.19, 0.56, -0.15, 0.58)
  s.bezierCurveTo(-0.115, 0.6, -0.07, 0.585, -0.045, 0.555)
  s.bezierCurveTo(-0.01, 0.585, 0.03, 0.6, 0.06, 0.585)
  s.bezierCurveTo(0.11, 0.565, 0.14, 0.52, 0.17, 0.47)
  s.bezierCurveTo(0.21, 0.405, 0.25, 0.35, 0.27, 0.305)
  s.bezierCurveTo(0.29, 0.27, 0.285, 0.245, 0.255, 0.235)
  s.bezierCurveTo(0.225, 0.225, 0.185, 0.24, 0.16, 0.255)
  s.bezierCurveTo(0.13, 0.27, 0.1, 0.285, 0.07, 0.3)
  s.bezierCurveTo(0.04, 0.315, 0.02, 0.33, 0.01, 0.345)
  s.bezierCurveTo(-0.01, 0.31, -0.02, 0.24, -0.015, 0.18)
  s.bezierCurveTo(-0.012, 0.12, -0.03, 0.05, -0.11, 0.0)
  s.closePath()

  const g = new THREE.ExtrudeGeometry(s, {
    depth: 0.15,
    bevelEnabled: true,
    bevelThickness: 0.028,
    bevelSize: 0.028,
    bevelSegments: 4,
    curveSegments: 26,
  })
  g.translate(0, 0, -0.075 - 0.028)
  g.rotateY(-Math.PI / 2)
  g.translate(0, 0.255, 0)
  g.scale(0.95, 0.95, 0.95)
  g.computeVertexNormals()
  return g
}

function knightBase(): THREE.BufferGeometry {
  const p = baseProfile()
  p.push(
    [0.19, 0.2],
    [0.182, 0.24],
    [0.178, 0.27],
    [0.176, 0.29],
    [0.0, 0.292],
  )
  return lathe(p)
}

/**
 * A Blender-authored stand-in for the turned king.
 *
 * scripts/blender-king.py builds the king from the same profile and publishes
 * it to public/models/king.glb; loading swaps it in over the procedural one.
 * Until it lands (or if the fetch fails) the procedural king keeps rendering,
 * so the board is never missing a piece.
 */
let kingOverride: THREE.BufferGeometry | null = null
let kingReady = false
let kingLoad: Promise<void> | null = null
const kingListeners = new Set<() => void>()

export function subscribeKingModel(onChange: () => void): () => void {
  kingListeners.add(onChange)
  return () => {
    kingListeners.delete(onChange)
  }
}

export function isKingModelReady(): boolean {
  return kingReady
}

/** Cylindrical UVs — the same mapping a lathe would give, for the wood grain. */
function cylindricalUVs(g: THREE.BufferGeometry): void {
  if (g.attributes.uv) return
  g.computeBoundingBox()
  const box = g.boundingBox
  if (!box) return
  const height = Math.max(box.max.y - box.min.y, 1e-6)
  const pos = g.attributes.position
  const uv = new Float32Array(pos.count * 2)
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2] = Math.atan2(pos.getZ(i), pos.getX(i)) / (Math.PI * 2) + 0.5
    uv[i * 2 + 1] = (pos.getY(i) - box.min.y) / height
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
}

/** Fetch the Blender king and swap it in; safe to call more than once. */
export function loadKingModel(url: string): Promise<void> {
  if (kingReady) return Promise.resolve()
  if (kingLoad) return kingLoad
  kingLoad = (async () => {
    try {
      const loader = new GLTFLoader()
      const gltf = await new Promise<GLTF>((resolve, reject) => {
        loader.load(url, resolve, undefined, reject)
      })
      const geos: THREE.BufferGeometry[] = []
      gltf.scene.updateMatrixWorld(true)
      gltf.scene.traverse((o) => {
        const mesh = o as THREE.Mesh
        if (!mesh.isMesh) return
        const g = mesh.geometry.clone()
        g.applyMatrix4(mesh.matrixWorld)
        geos.push(g)
      })
      if (geos.length) {
        const merged =
          geos.length === 1
            ? geos[0]
            : mergeAll(geos.map((g) => (g.index ? g.toNonIndexed() : g)))
        cylindricalUVs(merged)
        kingOverride = normalize(merged, TARGET_HEIGHT.k)
        kingReady = true
        for (const listener of kingListeners) listener()
      }
    } catch {
      // the procedural king stays on the board
    }
  })()
  return kingLoad
}

/** Distinct silhouette heights, so a piece's worth reads at a glance. */
const TARGET_HEIGHT: Record<PieceType, number> = {
  p: 0.6,
  r: 0.72,
  n: 0.8,
  b: 0.88,
  q: 1.0,
  k: 1.1,
}

/**
 * Scale a piece uniformly to a known height and sit it on y = 0.
 *
 * Hand-tuning each profile to the target height is fragile; normalising means
 * the height ordering is guaranteed no matter how the ornament is built.
 */
function normalize(g: THREE.BufferGeometry, target: number): THREE.BufferGeometry {
  g.computeBoundingBox()
  const box = g.boundingBox
  if (box) {
    const height = box.max.y - box.min.y
    if (height > 0) {
      const s = target / height
      g.scale(s, s, s)
    }
  }
  g.computeBoundingBox()
  if (g.boundingBox) g.translate(0, -g.boundingBox.min.y, 0)
  g.computeBoundingBox()
  g.computeBoundingSphere()
  return g
}

const cache = new Map<PieceType, THREE.BufferGeometry>()

export function getPieceGeometry(type: PieceType): THREE.BufferGeometry {
  if (type === 'k' && kingOverride) return kingOverride
  const hit = cache.get(type)
  if (hit) return hit
  let g: THREE.BufferGeometry
  switch (type) {
    case 'p':
      g = mergeAll([lathe(pawnProfile()), collar(0.134, 0.016, 0.448)])
      break
    case 'r':
      g = mergeAll([lathe(rookProfile()), rookCrown(), collar(0.228, 0.02, 0.53)])
      break
    case 'n':
      g = mergeAll([knightBase(), knightHead(), collar(0.184, 0.018, 0.282)])
      break
    case 'b':
      g = mergeAll([lathe(bishopProfile()), bishopFinial(), collar(0.157, 0.018, 0.514)])
      break
    case 'q':
      g = mergeAll([lathe(queenProfile()), queenCoronet(), collar(0.15, 0.018, 0.534)])
      break
    case 'k':
      g = mergeAll([
        lathe(kingProfile()),
        kingCross(),
        collar(0.157, 0.02, 0.548),
      ])
      break
  }
  g = normalize(g, TARGET_HEIGHT[type])
  cache.set(type, g)
  return g
}

export const PIECE_HEIGHT: Record<PieceType, number> = TARGET_HEIGHT
