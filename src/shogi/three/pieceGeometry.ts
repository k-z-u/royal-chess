/**
 * The shape of a 駒 — a five-sided plate, thick at the base and thinned to a
 * bevel near the top, with the point facing the opponent.
 *
 * It is built by hand rather than extruded so that the top face gets its own
 * material group (that is where the kanji lives) and so the bevel is a real
 * ring of faces rather than a smoothed silhouette.
 *
 *                     apex  ← pointing at the opponent
 *                      /\
 *                     /  \
 *               ______/    \______      ← shoulders
 *              |                  |
 *              |                  |     ← the sides
 *              |__________________|     ← the base, nearest the player
 *
 * The same geometry is shared by every piece; only the material differs.
 */
import * as THREE from 'three'

/** Half width of the base, and how far the point reaches forward. */
export const KOMA_HALF_WIDTH = 0.415
export const KOMA_BACK = 0.375
export const KOMA_SHOULDER = -0.045
export const KOMA_TIP = -0.425
export const KOMA_HEIGHT = 0.185

/** The outline in the x/z plane, counter-clockwise seen from above. */
const OUTLINE: [number, number][] = [
  [-KOMA_HALF_WIDTH, KOMA_BACK],
  [KOMA_HALF_WIDTH, KOMA_BACK],
  [KOMA_HALF_WIDTH, KOMA_SHOULDER],
  [0, KOMA_TIP],
  [-KOMA_HALF_WIDTH, KOMA_SHOULDER],
]

/** The bevelled rings from the base up to the top face. */
const RINGS = [
  { y: 0, scale: 1 },
  { y: KOMA_HEIGHT * 0.66, scale: 1 },
  { y: KOMA_HEIGHT * 0.88, scale: 0.965 },
  { y: KOMA_HEIGHT, scale: 0.9 },
]

let cached: THREE.BufferGeometry | null = null
let cachedIndexless: THREE.BufferGeometry | null = null

/**
 * A koma, single-sided but with two material groups:
 * group 0 is the top face (the kanji), group 1 is everything else.
 */
export function komaGeometry(): THREE.BufferGeometry {
  if (cached) return cached

  const positions: number[] = []
  const normals: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  // which vertex index starts the non-top-face part of the geometry
  let faceSplit = 0

  const ringVertices = (ring: (typeof RINGS)[number]) => {
    const out: number[] = []
    for (const [x, z] of OUTLINE) {
      out.push(x * ring.scale, ring.y, z * ring.scale)
    }
    return out
  }

  // --- top face: the last ring, fanned from its centre -------------------
  const top = RINGS[RINGS.length - 1]
  const topRing = ringVertices(top)
  const topCentre = positions.length / 3
  positions.push(0, top.y, 0)
  normals.push(0, 1, 0)
  uvs.push(0.5, 0.5)
  const topStart = positions.length / 3
  for (let i = 0; i < 5; i++) {
    const [x, z] = OUTLINE[i]
    positions.push(topRing[i * 3], topRing[i * 3 + 1], topRing[i * 3 + 2])
    normals.push(0, 1, 0)
    // map the koma's bounding box onto the texture's full square
    const u = 0.5 + (x * top.scale) / (KOMA_HALF_WIDTH * 2 * top.scale)
    const v = 0.5 - (z * top.scale) / ((KOMA_BACK - KOMA_TIP) * top.scale)
    uvs.push(u, v)
  }
  for (let i = 0; i < 5; i++) {
    const a = topStart + i
    const b = topStart + ((i + 1) % 5)
    indices.push(topCentre, a, b)
  }
  faceSplit = positions.length / 3

  // --- the bevelled sides, ring to ring ----------------------------------
  for (let r = 0; r < RINGS.length - 1; r++) {
    const lower = ringVertices(RINGS[r])
    const upper = ringVertices(RINGS[r + 1])
    const lowerRing = positions.length / 3
    for (let i = 0; i < 5; i++) {
      positions.push(lower[i * 3], lower[i * 3 + 1], lower[i * 3 + 2])
      normals.push(0, 0, 0)
      uvs.push(i / 5, 0)
    }
    const upperRing = positions.length / 3
    for (let i = 0; i < 5; i++) {
      positions.push(upper[i * 3], upper[i * 3 + 1], upper[i * 3 + 2])
      normals.push(0, 0, 0)
      uvs.push(i / 5, 0.2)
    }
    for (let i = 0; i < 5; i++) {
      const j = (i + 1) % 5
      const l0 = lowerRing + i
      const l1 = lowerRing + j
      const u0 = upperRing + i
      const u1 = upperRing + j
      indices.push(l0, u0, u1, l0, u1, l1)
    }
  }

  // --- the base, fanned so the piece is closed ---------------------------
  const baseRing = positions.length / 3
  for (let i = 0; i < 5; i++) {
    positions.push(OUTLINE[i][0], 0, OUTLINE[i][1])
    normals.push(0, -1, 0)
    uvs.push(0.5, 0.5)
  }
  const baseCentre = positions.length / 3
  positions.push(0, 0, 0)
  normals.push(0, -1, 0)
  uvs.push(0.5, 0.5)
  for (let i = 0; i < 5; i++) {
    const a = baseRing + i
    const b = baseRing + ((i + 1) % 5)
    indices.push(baseCentre, b, a)
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geo.setIndex(indices)
  geo.computeVertexNormals()
  geo.addGroup(0, faceSplit, 0)
  geo.addGroup(faceSplit, positions.length / 3 - faceSplit, 1)
  cached = geo
  return geo
}

/**
 * The same koma with the top face separated into its own geometry pair, for the
 * stands: a piece lying on a 駒台 is drawn flat, and the kanji needs to land on
 * a plate rather than on a bevelled block.
 */
export function flatKomaGeometry(): THREE.BufferGeometry {
  if (cachedIndexless) return cachedIndexless
  const geo = new THREE.BufferGeometry()
  const positions: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  positions.push(0, 0, 0)
  uvs.push(0.5, 0.5)
  OUTLINE.forEach(([x, z]) => {
    positions.push(x, 0, z)
    uvs.push(
      0.5 + x / (KOMA_HALF_WIDTH * 2),
      0.5 - z / (KOMA_BACK - KOMA_TIP),
    )
  })
  for (let i = 0; i < 5; i++) indices.push(0, 1 + i, 1 + ((i + 1) % 5))
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geo.setIndex(indices)
  geo.computeVertexNormals()
  cachedIndexless = geo
  return geo
}

/** The outline, for the outline-pass on selected squares. */
export function komaOutline(): [number, number][] {
  return OUTLINE.map(([x, z]) => [x, z])
}
