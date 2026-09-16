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
 * R3F fires onClick even after a drag that returns to the same object, so we
 * gate every board interaction through this.
 */
export function wasTap(e: { clientX: number; clientY: number; pointerId?: number }) {
  if (e.pointerId !== undefined && downId !== -1 && e.pointerId !== downId) return false
  const dx = e.clientX - downX
  const dy = e.clientY - downY
  const dist = Math.hypot(dx, dy)
  const dt = performance.now() - downAt
  return dist <= 6 && dt <= 1500
}