import * as THREE from 'three'

function mulberry32(seed: number) {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface WoodOptions {
  size?: number
  seed?: number
  base: string
  light: string
  dark: string
  ringCount?: number
  grainStrength?: number
}

/** Procedural wood grain — an anisotropic streak pattern with soft rings. */
export function makeWoodTexture(opts: WoodOptions): THREE.CanvasTexture {
  const size = opts.size ?? 512
  const rand = mulberry32(opts.seed ?? 7)
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = opts.base
  ctx.fillRect(0, 0, size, size)

  const ringCount = opts.ringCount ?? 26
  const grain = opts.grainStrength ?? 1

  // long, gently wavering grain lines
  for (let i = 0; i < ringCount * 12; i++) {
    const y0 = rand() * size
    const amp = 2 + rand() * 10
    const freq = 0.5 + rand() * 2.2
    const phase = rand() * Math.PI * 2
    const width = 0.6 + rand() * 2.4
    const alpha = (0.03 + rand() * 0.1) * grain
    ctx.strokeStyle = rand() > 0.45 ? opts.dark : opts.light
    ctx.globalAlpha = alpha
    ctx.lineWidth = width
    ctx.beginPath()
    for (let x = -8; x <= size + 8; x += 6) {
      const y = y0 + Math.sin((x / size) * Math.PI * freq + phase) * amp
      if (x === -8) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()
  }

  // broad tonal bands (like cathedral grain)
  for (let i = 0; i < ringCount; i++) {
    const y0 = rand() * size
    const amp = 6 + rand() * 26
    const freq = 0.4 + rand() * 1.4
    const phase = rand() * Math.PI * 2
    const grad = ctx.createLinearGradient(0, y0 - 26, 0, y0 + 26)
    grad.addColorStop(0, 'rgba(0,0,0,0)')
    grad.addColorStop(0.5, rand() > 0.5 ? opts.dark : opts.light)
    grad.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.globalAlpha = 0.05 + rand() * 0.08
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.moveTo(0, y0)
    for (let x = 0; x <= size; x += 8) {
      ctx.lineTo(x, y0 + Math.sin((x / size) * Math.PI * freq + phase) * amp)
    }
    for (let x = size; x >= 0; x -= 8) {
      ctx.lineTo(x, y0 + 22 + Math.sin((x / size) * Math.PI * freq + phase) * amp)
    }
    ctx.closePath()
    ctx.fill()
  }

  // fine grain noise
  const img = ctx.getImageData(0, 0, size, size)
  const d = img.data
  for (let i = 0; i < d.length; i += 4) {
    const n = (rand() - 0.5) * 16
    d[i] = Math.max(0, Math.min(255, d[i] + n))
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n))
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n))
  }
  ctx.putImageData(img, 0, 0)

  ctx.globalAlpha = 1
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.anisotropy = 8
  return tex
}

/** Soft roughness variation derived from a noise field. */
export function makeRoughnessTexture(seed = 11, size = 256): THREE.CanvasTexture {
  const rand = mulberry32(seed)
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#b8b8b8'
  ctx.fillRect(0, 0, size, size)
  for (let i = 0; i < 900; i++) {
    const x = rand() * size
    const y = rand() * size
    const r = 4 + rand() * 60
    const v = 150 + Math.floor(rand() * 90)
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r)
    grad.addColorStop(0, `rgba(${v},${v},${v},0.10)`)
    grad.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  return tex
}

/** Marble / polished stone with veins, for one of the piece finishes. */
export function makeStoneTexture(opts: {
  size?: number
  seed?: number
  base: string
  vein: string
}): THREE.CanvasTexture {
  const size = opts.size ?? 512
  const rand = mulberry32(opts.seed ?? 3)
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = opts.base
  ctx.fillRect(0, 0, size, size)

  for (let i = 0; i < 26; i++) {
    ctx.beginPath()
    let x = rand() * size
    let y = rand() * size
    ctx.moveTo(x, y)
    const steps = 40 + Math.floor(rand() * 40)
    let ang = rand() * Math.PI * 2
    for (let s = 0; s < steps; s++) {
      ang += (rand() - 0.5) * 0.6
      x += Math.cos(ang) * 9
      y += Math.sin(ang) * 9
      ctx.lineTo(x, y)
    }
    ctx.strokeStyle = opts.vein
    ctx.globalAlpha = 0.05 + rand() * 0.12
    ctx.lineWidth = 0.5 + rand() * 3.5
    ctx.stroke()
  }

  // soft cloudy mottling
  for (let i = 0; i < 240; i++) {
    const x = rand() * size
    const y = rand() * size
    const r = 20 + rand() * 120
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r)
    const v = rand() > 0.5 ? '255,255,255' : '0,0,0'
    grad.addColorStop(0, `rgba(${v},0.045)`)
    grad.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.globalAlpha = 1
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.anisotropy = 8
  return tex
}

/** A rail strip of coordinate labels, one glyph per square. */
export function makeLabelStrip(text: string, color = '#dccdaa'): THREE.CanvasTexture {
  const cell = 128
  const canvas = document.createElement('canvas')
  canvas.width = cell * text.length
  canvas.height = cell
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.font = '700 84px "Helvetica Neue", Helvetica, Arial, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (let i = 0; i < text.length; i++) {
    const cx = cell * (i + 0.5)
    const cy = cell / 2
    ctx.fillStyle = 'rgba(0,0,0,0.55)'
    ctx.fillText(text[i], cx, cy + 4)
    ctx.fillStyle = color
    ctx.fillText(text[i], cx, cy)
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  return tex
}

/** Soft radial glow used for the check indicator. */
export function makeGlowTexture(inner = 'rgba(214,74,60,0.85)', outer = 'rgba(214,74,60,0)'): THREE.CanvasTexture {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  grad.addColorStop(0, inner)
  grad.addColorStop(0.45, inner.replace(/[\d.]+\)$/, '0.35)'))
  grad.addColorStop(1, outer)
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, size, size)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}
