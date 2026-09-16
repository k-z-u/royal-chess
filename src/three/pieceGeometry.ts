import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { PieceType } from '../game/types'

const SEG = 64

/** Lathe geometries are indexed, ExtrudeGeometry is not — normalise before merging. */
function mergeAll(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const flat = geos.map((g) => (g.index ? g.toNonIndexed() : g))
  const merged = mergeGeometries(flat)
  if (!merged) throw new Error('geometry merge failed')
  merged.computeVertexNormals()
  return merged
}

function lathe(points: [number, number][]): THREE.BufferGeometry {
  const v = points.map(([x, y]) => new THREE.Vector2(Math.max(x, 0.0008), y))
  const g = new THREE.LatheGeometry(v, SEG)
  g.computeVertexNormals()
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

function rookProfile(): [number, number][] {
  const p = baseProfile()
  p.push(
    [0.19, 0.2],
    [0.192, 0.24],
    [0.196, 0.3],
    [0.2, 0.36],
    [0.202, 0.42],
    [0.208, 0.45],
    [0.228, 0.466],
    [0.238, 0.478],
    [0.234, 0.49],
    [0.216, 0.5],
    [0.208, 0.512],
    [0.212, 0.532],
    [0.228, 0.55],
    [0.236, 0.566],
    [0.236, 0.582],
    [0.228, 0.594],
    [0.212, 0.6],
    [0.196, 0.602],
    [0.19, 0.596],
    [0.186, 0.582],
    [0.182, 0.572],
    [0.0, 0.57],
  )
  return p
}

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
    [0.136, 0.756],
    [0.09, 0.774],
    [0.05, 0.786],
    [0.022, 0.792],
    [0.008, 0.8],
    [0.0, 0.812],
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
  const r = 0.203
  const toothW = 0.115
  const toothH = 0.085
  const toothD = 0.052
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + Math.PI / count
    const g = new THREE.BoxGeometry(toothD, toothH, toothW)
    g.translate(r, 0.598 + toothH / 2, 0)
    g.rotateY(a)
    parts.push(g)
  }
  return mergeAll(parts)
}

/** Coronet: ring of small spheres for the queen. */
function queenCoronet(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = []
  const count = 9
  const r = 0.198
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2
    const g = new THREE.SphereGeometry(0.036, 16, 12)
    g.translate(Math.cos(a) * r, 0.83, Math.sin(a) * r)
    parts.push(g)
  }
  const band = new THREE.TorusGeometry(0.196, 0.022, 12, 48)
  band.rotateX(Math.PI / 2)
  band.translate(0, 0.8, 0)
  parts.push(band)
  return mergeAll(parts)
}

function kingCross(): THREE.BufferGeometry {
  const v = new THREE.BoxGeometry(0.045, 0.15, 0.045)
  v.translate(0, 0.9, 0)
  const h = new THREE.BoxGeometry(0.045, 0.045, 0.115)
  h.translate(0, 0.925, 0)
  const ball = new THREE.SphereGeometry(0.028, 16, 12)
  ball.translate(0, 0.978, 0)
  return mergeAll([v, h, ball])
}

function bishopFinial(): THREE.BufferGeometry {
  const ball = new THREE.SphereGeometry(0.036, 20, 14)
  ball.translate(0, 0.845, 0)
  const collar = new THREE.TorusGeometry(0.048, 0.016, 12, 32)
  collar.rotateX(Math.PI / 2)
  collar.translate(0, 0.8, 0)
  return mergeAll([ball, collar])
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
  g.translate(0, 0.29, 0)
  g.scale(1.18, 1.18, 1.18)
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

const cache = new Map<PieceType, THREE.BufferGeometry>()

export function getPieceGeometry(type: PieceType): THREE.BufferGeometry {
  const hit = cache.get(type)
  if (hit) return hit
  let g: THREE.BufferGeometry
  switch (type) {
    case 'p':
      g = lathe(pawnProfile())
      break
    case 'r':
      g = mergeAll([lathe(rookProfile()), rookCrown()])
      break
    case 'n':
      g = mergeAll([knightBase(), knightHead()])
      break
    case 'b':
      g = mergeAll([lathe(bishopProfile()), bishopFinial()])
      break
    case 'q':
      g = mergeAll([lathe(queenProfile()), queenCoronet()])
      break
    case 'k':
      g = mergeAll([lathe(kingProfile()), kingCross()])
      break
  }
  g.computeVertexNormals()
  g.computeBoundingSphere()
  cache.set(type, g)
  return g
}

export const PIECE_HEIGHT: Record<PieceType, number> = {
  p: 0.676,
  r: 0.69,
  n: 0.79,
  b: 0.87,
  q: 0.96,
  k: 1.0,
}