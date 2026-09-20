// Inspect king.glb: attributes, orientation, size. Run with:
//   node scripts/inspect-king.mjs
import { readFileSync } from 'node:fs'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import * as THREE from 'three'

const path = process.argv[2] ?? 'public/models/king.glb'
const buffer = readFileSync(path)
const arrayBuffer = buffer.buffer.slice(
  buffer.byteOffset,
  buffer.byteOffset + buffer.byteLength,
)

const loader = new GLTFLoader()
const gltf = await new Promise((resolve, reject) => {
  loader.parse(arrayBuffer, '', resolve, reject)
})

gltf.scene.updateMatrixWorld(true)
const box = new THREE.Box3().setFromObject(gltf.scene)
const size = new THREE.Vector3()
box.getSize(size)

console.log('scenes:', gltf.scene.children.length, 'objects')
gltf.scene.traverse((o) => {
  if (o.isMesh) {
    const g = o.geometry
    const attrs = Object.keys(g.attributes).join(',')
    const hasNormal = !!g.attributes.normal
    const hasUV = !!g.attributes.uv
    console.log(
      `mesh: ${o.name} verts=${g.attributes.position.count} ` +
        `attrs=${attrs} normal=${hasNormal} uv=${hasUV}`,
    )
    const mat = Array.isArray(o.material) ? o.material[0] : o.material
    console.log(`  material: ${mat?.type ?? 'none'}`)
  }
})

console.log(`bbox: min=(${box.min.x.toFixed(4)}, ${box.min.y.toFixed(4)}, ${box.min.z.toFixed(4)})`)
console.log(`      max=(${box.max.x.toFixed(4)}, ${box.max.y.toFixed(4)}, ${box.max.z.toFixed(4)})`)
console.log(`size: x=${size.x.toFixed(4)} y=${size.y.toFixed(4)} z=${size.z.toFixed(4)}`)
console.log(
  size.y >= size.x && size.y >= size.z
    ? 'orientation: Y-up (matches three.js, no fix needed)'
    : 'orientation: NOT Y-up — needs correction',
)

// radius profile — the quickest way to confirm an ornament actually stands
// proud of the body instead of being swallowed by it
const radiusByHeight = (() => {
  const bins = new Array(20).fill(0)
  let count = 0
  gltf.scene.traverse((o) => {
    if (!o.isMesh) return
    const pos = o.geometry.attributes.position
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const y = pos.getY(i)
      const z = pos.getZ(i)
      const bin = Math.min(bins.length - 1, Math.floor((y / size.y) * bins.length))
      bins[bin] = Math.max(bins[bin], Math.hypot(x, z))
      count++
    }
  })
  return { bins, count }
})()

console.log(`\nradius profile over ${radiusByHeight.count} vertices (max radius per 5% of height):`)
radiusByHeight.bins.forEach((r, i) => {
  const pct = (i * 5).toString().padStart(3)
  const bar = '#'.repeat(Math.round((r / Math.max(...radiusByHeight.bins)) * 34))
  console.log(`  ${pct}%  ${(r * 1000).toFixed(1).padStart(5)} mm  ${bar}`)
})
