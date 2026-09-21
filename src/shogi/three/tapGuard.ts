let downX = 0
let downY = 0
let downAt = 0
let downId = -1

if (typeof window !== 'undefined') {
  window.addEventListener(
    'pointerdown',
    (e) => {
      downX = e.clientX
      downY = e.clientY
      downAt = performance.now()
      downId = e.pointerId
    },
    true,
  )
}

/**
 * True when the gesture that just ended was a tap rather than an orbit drag.
 *
 * R3F fires onClick even after a drag that happens to end on the same object, so
 * every board interaction is gated through this.
 */
export function wasTap(e: { clientX: number; clientY: number; pointerId?: number }): boolean {
  if (e.pointerId !== undefined && downId !== -1 && e.pointerId !== downId) return false
  const dist = Math.hypot(e.clientX - downX, e.clientY - downY)
  const dt = performance.now() - downAt
  return dist <= 6 && dt <= 1500
}
