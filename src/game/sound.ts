let ctx: AudioContext | null = null
let master: GainNode | null = null

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    ctx = new Ctor()
    master = ctx.createGain()
    master.gain.value = 0.5
    master.connect(ctx.destination)
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

/** Call from a user gesture so the context is unlocked on iOS/Safari. */
export function unlockAudio() {
  audio()
}

function noiseBuffer(ac: AudioContext, seconds: number) {
  const len = Math.floor(ac.sampleRate * seconds)
  const buf = ac.createBuffer(1, len, ac.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < len; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 1.5)
  }
  return buf
}

function knock(opts: {
  freq: number
  q: number
  gain: number
  decay: number
  thump: number
  thumpFreq: number
}) {
  const ac = audio()
  if (!ac || !master) return
  const now = ac.currentTime

  const src = ac.createBufferSource()
  src.buffer = noiseBuffer(ac, opts.decay)
  const bp = ac.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = opts.freq
  bp.Q.value = opts.q
  const g = ac.createGain()
  g.gain.setValueAtTime(opts.gain, now)
  g.gain.exponentialRampToValueAtTime(0.0001, now + opts.decay)
  src.connect(bp).connect(g).connect(master)
  src.start(now)

  const osc = ac.createOscillator()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(opts.thumpFreq, now)
  osc.frequency.exponentialRampToValueAtTime(opts.thumpFreq * 0.55, now + opts.thump)
  const og = ac.createGain()
  og.gain.setValueAtTime(opts.thump, now)
  og.gain.exponentialRampToValueAtTime(0.0001, now + opts.thump)
  osc.connect(og).connect(master)
  osc.start(now)
  osc.stop(now + opts.thump + 0.02)
}

function tone(freq: number, start: number, dur: number, gain: number, type: OscillatorType = 'sine') {
  const ac = audio()
  if (!ac || !master) return
  const t0 = ac.currentTime + start
  const osc = ac.createOscillator()
  osc.type = type
  osc.frequency.value = freq
  const g = ac.createGain()
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.02)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  osc.connect(g).connect(master)
  osc.start(t0)
  osc.stop(t0 + dur + 0.05)
}

export function playMove() {
  knock({ freq: 2200, q: 1.2, gain: 0.22, decay: 0.085, thump: 0.11, thumpFreq: 165 })
}

export function playCapture() {
  knock({ freq: 1400, q: 0.9, gain: 0.3, decay: 0.13, thump: 0.16, thumpFreq: 120 })
}

export function playCheck() {
  tone(784, 0, 0.35, 0.09, 'triangle')
  tone(1175, 0.07, 0.4, 0.06, 'sine')
}

export function playEnd() {
  tone(523.25, 0, 0.5, 0.07)
  tone(659.25, 0.08, 0.55, 0.06)
  tone(784, 0.16, 0.7, 0.05)
}

export function playSound(kind: string) {
  switch (kind) {
    case 'move':
      playMove()
      break
    case 'capture':
      playCapture()
      break
    case 'check':
      playCheck()
      break
    case 'end':
      playEnd()
      break
  }
}