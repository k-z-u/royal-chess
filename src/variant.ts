import { create } from 'zustand'

/**
 * Which game is on screen.
 *
 * The chess store already uses `mode` for "who is playing" (cpu vs. human),
 * and the shogi store does the same, so the choice of *game* is called the
 * variant to keep the two ideas from being confused.
 */
export type Variant = 'chess' | 'shogi'

const STORAGE_KEY = 'royal-chess:variant'

export const VARIANTS: { id: Variant; label: string }[] = [
  { id: 'chess', label: 'チェス' },
  { id: 'shogi', label: '将棋' },
]

/**
 * A variant in the URL wins (deep links, and the UI checks), then the last one
 * the player picked, then chess. Reading localStorage can throw in private
 * mode, which is not a reason to fail to start.
 */
function initialVariant(): Variant {
  const fromUrl = new URLSearchParams(window.location.search).get('variant')
  if (fromUrl === 'shogi' || fromUrl === 'chess') return fromUrl
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (saved === 'shogi' || saved === 'chess') return saved
  } catch {
    /* no storage — fall through to the default */
  }
  return 'chess'
}

interface VariantState {
  variant: Variant
  setVariant: (variant: Variant) => void
}

export const useVariant = create<VariantState>((set) => ({
  variant: initialVariant(),
  setVariant: (variant) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, variant)
    } catch {
      /* not fatal */
    }
    set({ variant })
  },
}))
