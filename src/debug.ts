/**
 * Test handles. Exposed during development and whenever the page is opened
 * with `?debug` — never in a normal production load.
 */
export function debugEnabled() {
  if (import.meta.env.DEV) return true
  return typeof location !== 'undefined' && /(^|[?&])debug\b/.test(location.search)
}

export function expose(key: string, value: unknown) {
  if (!debugEnabled()) return
  ;(window as unknown as Record<string, unknown>)[key] = value
}
