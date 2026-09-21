/**
 * Small synthesised sounds — a koma being set down, a capture, 王手, the end.
 *
 * Everything is generated with the Web Audio API, so there are no assets to
 * fetch and nothing to wait for. Browsers block audio until the player has
 * interacted with the page, which is what `unlockAudio()` is for.
 */
export type SoundName = 'move' | 'capture' | 'check' | 'drop' | 'end' | 'illegal'

let ctx: AudioContext | null = null
let master: GainNode | null = null
let blocked = true

function context(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    ctx = new Ctor()
    master = ctx.createGain()
    master.gain.value = 0.6
    master.connect(ctx.destination)
  }
  return ctx
}

export function unlockAudio(): void {
  const audio = context()
  if (!audio) return
  blocked = false
  if (audio.state === 'suspended') void audio.resume()
}

/** One short noise burst through a band-pass, which is what wood sounds like. */
function click(at: number, frequency: number, duration: number, gain: number, q = 1.1) {
  const audio = context()
  if (!audio || !master || blocked) return

  const frames = Math.max(1, Math.floor(audio.sampleRate * duration))
  const buffer = audio.createBuffer(1, frames, audio.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < frames; i++) {
    const decay = Math.pow(1 - i / frames, 3)
    data[i] = (Math.random() * 2 - 1) * decay
  }

  const source = audio.createBufferSource()
  source.buffer = buffer

  const filter = audio.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = frequency
  filter.Q.value = q

  const envelope = audio.createGain()
  envelope.gain.value = gain

  source.connect(filter)
  filter.connect(envelope)
  envelope.connect(master)
  source.start(at)
  source.stop(at + duration + 0.02)
}

/** A short pitched tone, for the moments a click is not enough. */
function tone(at: number, frequency: number, duration: number, gain: number, type: OscillatorType = 'triangle') {
  const audio = context()
  if (!audio || !master || blocked) return
  const osc = audio.createOscillator()
  osc.type = type
  osc.frequency.setValueAtTime(frequency, at)
  const envelope = audio.createGain()
  envelope.gain.setValueAtTime(0, at)
  envelope.gain.linearRampToValueAtTime(gain, at + 0.012)
  envelope.gain.exponentialRampToValueAtTime(0.0001, at + duration)
  osc.connect(envelope)
  envelope.connect(master)
  osc.start(at)
  osc.stop(at + duration + 0.02)
}

export function playSound(name: SoundName): void {
  const audio = context()
  if (!audio || blocked) return
  const now = audio.currentTime

  switch (name) {
    case 'move':
      click(now, 1750, 0.075, 0.5)
      click(now + 0.012, 900, 0.06, 0.22)
      break
    case 'drop':
      click(now, 2100, 0.06, 0.42)
      click(now + 0.02, 1250, 0.09, 0.3)
      break
    case 'capture':
      click(now, 1500, 0.08, 0.55)
      click(now + 0.02, 640, 0.13, 0.4)
      tone(now + 0.01, 220, 0.12, 0.1, 'sine')
      break
    case 'check':
      tone(now, 880, 0.24, 0.16)
      tone(now + 0.09, 1318, 0.28, 0.13)
      break
    case 'end':
      tone(now, 523, 0.5, 0.14)
      tone(now + 0.13, 784, 0.6, 0.12)
      tone(now + 0.26, 1046, 0.8, 0.1)
      break
    case 'illegal':
      tone(now, 180, 0.18, 0.12, 'sawtooth')
      break
  }
}
