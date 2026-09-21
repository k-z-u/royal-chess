/**
 * Every surface in the scene is drawn on a canvas at load time — there are no
 * image files to fetch. The three that matter:
 *
 *   - `makeWoodTexture`   hinoki/kaya grain, used for the board and the stands
 *   - `makeBoardTexture`  the 9×9 grid, drawn once over the whole slab so the
 *                         lines are crisp at any zoom
 *   - `makeKomaTexture`   a kanji stamped on the top face of a piece, black ink
 *                         for a plain piece and 朱 (red) for a 成駒
 */
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

/** Procedural wood grain: long wavering streaks plus broad tonal bands. */
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

  for (let i = 0; i < ringCount * 12; i++) {
    const y0 = rand() * size
    const amp = 2 + rand() * 10
    const freq = 0.5 + rand() * 2.2
    const phase = rand() * Math.PI * 2
    ctx.strokeStyle = rand() > 0.45 ? opts.dark : opts.light
    ctx.globalAlpha = (0.03 + rand() * 0.1) * grain
    ctx.lineWidth = 0.6 + rand() * 2.4
    ctx.beginPath()
    for (let x = -8; x <= size + 8; x += 6) {
      const y = y0 + Math.sin((x / size) * Math.PI * freq + phase) * amp
      if (x === -8) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()
  }

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

  const img = ctx.getImageData(0, 0, size, size)
  const d = img.data
  for (let i = 0; i < d.length; i += 4) {
    const n = (rand() - 0.5) * 14
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

export interface BoardPalette {
  /** the wood the squares are printed on */
  base: string
  light: string
  dark: string
  /** the ink of the grid lines */
  line: string
  seed: number
}

export const BOARD_PALETTES: Record<string, BoardPalette> = {
  kaya: { base: '#e7c489', light: '#f4dcae', dark: '#c39a5f', line: '#48351c', seed: 13 },
  hinoki: { base: '#f0dcb6', light: '#fbf0d6', dark: '#d5b782', line: '#5b4a2f', seed: 29 },
  sumi: { base: '#3a352f', light: '#4b453d', dark: '#282420', line: '#c9b993', seed: 41 },
}

/**
 * The whole board surface: wood grain, the 9×9 grid, the four 星 dots, and the
 * faint border of a real 将棋盤. Drawn at 2048px so the lines stay sharp when
 * the camera is close.
 */
export function makeBoardTexture(palette: BoardPalette): THREE.CanvasTexture {
  const size = 2048
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!

  // grain: reuse the wood generator at board scale
  const grain = makeWoodTexture({
    size: 512,
    seed: palette.seed,
    base: palette.base,
    light: palette.light,
    dark: palette.dark,
    ringCount: 30,
    grainStrength: 0.85,
  })
  ctx.drawImage(grain.image as HTMLCanvasElement, 0, 0, size, size)
  grain.dispose()

  const cell = size / 9
  ctx.strokeStyle = palette.line
  ctx.globalAlpha = 0.82
  ctx.lineWidth = Math.max(2, size / 720)

  for (let i = 1; i < 9; i++) {
    ctx.beginPath()
    ctx.moveTo(i * cell, 0)
    ctx.lineTo(i * cell, size)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(0, i * cell)
    ctx.lineTo(size, i * cell)
    ctx.stroke()
  }

  // the heavier outline of the board itself
  ctx.globalAlpha = 0.95
  ctx.lineWidth = Math.max(4, size / 330)
  ctx.strokeRect(0, 0, size, size)

  // 星: the four dots on the intersections around the middle
  ctx.globalAlpha = 1
  ctx.fillStyle = palette.line
  const dot = Math.max(6, size / 190)
  for (const col of [3, 6]) {
    for (const row of [3, 6]) {
      ctx.beginPath()
      ctx.arc(col * cell, row * cell, dot, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  return tex
}

const KANJI_FONT =
  '"Hiragino Mincho ProN", "Yu Mincho", "YuMincho", "Noto Serif JP", "Songti SC", "MS Mincho", "Times New Roman", serif'

export interface KomaTextureOptions {
  /** the kanji to stamp */
  glyph: string
  /** wood the piece is cut from */
  base: string
  light: string
  dark: string
  /** 朱 for 成駒, 墨 for the rest */
  ink: string
  seed: number
  /** a small "×3" in the corner, for the stands */
  count?: number
}

/** The top face of one piece: wood, a bevel line, and the kanji. */
export function makeKomaTexture(opts: KomaTextureOptions): THREE.CanvasTexture {
  const size = 512
  const rand = mulberry32(opts.seed)
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = opts.base
  ctx.fillRect(0, 0, size, size)

  // a little grain, so the face is not a flat colour
  for (let i = 0; i < 160; i++) {
    const y = rand() * size
    ctx.globalAlpha = 0.03 + rand() * 0.05
    ctx.strokeStyle = rand() > 0.5 ? opts.dark : opts.light
    ctx.lineWidth = 0.6 + rand() * 2
    ctx.beginPath()
    for (let x = -8; x <= size + 8; x += 16) {
      const yy = y + Math.sin((x / size) * Math.PI * (0.4 + rand() * 1.2)) * 3
      if (x === -8) ctx.moveTo(x, yy)
      else ctx.lineTo(x, yy)
    }
    ctx.stroke()
  }
  ctx.globalAlpha = 1

  // the kanji, centred a touch above the middle the way a real piece sits
  ctx.fillStyle = opts.ink
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const glyphSize = opts.glyph.length > 1 ? size * 0.44 : size * 0.68
  ctx.font = `600 ${glyphSize}px ${KANJI_FONT}`
  ctx.fillText(opts.glyph, size * 0.5, size * 0.47)

  if (opts.count !== undefined) {
    ctx.font = `700 ${size * 0.2}px ${KANJI_FONT}`
    ctx.textAlign = 'right'
    ctx.textBaseline = 'bottom'
    ctx.fillStyle = opts.ink
    ctx.globalAlpha = 0.85
    ctx.fillText(`${opts.count}`, size * 0.93, size * 0.97)
    ctx.globalAlpha = 1
  }

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  return tex
}

/** A row of coordinate glyphs along one edge of the board. */
export function makeLabelStrip(text: string, color = '#e8d7ad'): THREE.CanvasTexture {
  const cell = 128
  const canvas = document.createElement('canvas')
  canvas.width = cell * text.length
  canvas.height = cell
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.font = `600 ${text.length > 1 ? 92 : 96}px ${KANJI_FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (let i = 0; i < text.length; i++) {
    const cx = cell * (i + 0.5)
    ctx.fillStyle = 'rgba(0,0,0,0.45)'
    ctx.fillText(text[i], cx, cell / 2 + 4)
    ctx.fillStyle = color
    ctx.fillText(text[i], cx, cell / 2)
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  return tex
}

/** Soft radial glow, used under a king that is in check. */
export function makeGlowTexture(inner = 'rgba(214,74,60,0.85)'): THREE.CanvasTexture {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  grad.addColorStop(0, inner)
  grad.addColorStop(0.45, inner.replace(/[\d.]+\)$/, '0.32)'))
  grad.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, size, size)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}
