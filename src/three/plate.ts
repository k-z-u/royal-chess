import * as THREE from 'three'

/** A beveled rounded plate lying in the XZ plane, top surface at y = 0. */
export function roundedPlateGeometry(
  width: number,
  depth: number,
  height: number,
  radius: number,
  bevel = 0.01,
): THREE.BufferGeometry {
  const w = width / 2
  const d = depth / 2
  const r = Math.min(radius, Math.min(w, d) - 0.001)
  const s = new THREE.Shape()
  s.moveTo(-w + r, -d)
  s.lineTo(w - r, -d)
  s.quadraticCurveTo(w, -d, w, -d + r)
  s.lineTo(w, d - r)
  s.quadraticCurveTo(w, d, w - r, d)
  s.lineTo(-w + r, d)
  s.quadraticCurveTo(-w, d, -w, d - r)
  s.lineTo(-w, -d + r)
  s.quadraticCurveTo(-w, -d, -w + r, -d)

  const g = new THREE.ExtrudeGeometry(s, {
    depth: height - bevel * 2,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: 6,
  })
  // shape is in XY, extrudes along +Z. Rotate so the extrusion runs along -Y
  // and the top face sits at y = 0.
  g.rotateX(-Math.PI / 2)
  g.translate(0, height - bevel, 0)
  g.computeVertexNormals()
  return g
}

/** A flat ring (frame) with a rounded outer edge and a square hole. */
export function frameRingGeometry(
  outer: number,
  inner: number,
  height: number,
  cornerRadius: number,
  bevel = 0.015,
): THREE.BufferGeometry {
  const o = outer / 2
  const i = inner / 2
  const r = Math.min(cornerRadius, o - i - 0.001)

  const s = new THREE.Shape()
  s.moveTo(-o + r, -o)
  s.lineTo(o - r, -o)
  s.quadraticCurveTo(o, -o, o, -o + r)
  s.lineTo(o, o - r)
  s.quadraticCurveTo(o, o, o - r, o)
  s.lineTo(-o + r, o)
  s.quadraticCurveTo(-o, o, -o, o - r)
  s.lineTo(-o, -o + r)
  s.quadraticCurveTo(-o, -o, -o + r, -o)

  const hole = new THREE.Path()
  hole.moveTo(-i, -i)
  hole.lineTo(i, -i)
  hole.lineTo(i, i)
  hole.lineTo(-i, i)
  hole.lineTo(-i, -i)
  s.holes.push(hole)

  const g = new THREE.ExtrudeGeometry(s, {
    depth: height - bevel * 2,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: 8,
  })
  g.rotateX(-Math.PI / 2)
  g.translate(0, height - bevel, 0)
  g.computeVertexNormals()
  return g
}
