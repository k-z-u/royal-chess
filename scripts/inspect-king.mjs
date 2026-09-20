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
