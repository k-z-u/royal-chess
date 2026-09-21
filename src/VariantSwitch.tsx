import { useVariant, VARIANTS, type Variant } from './variant'
import { IconCrown } from './ui/Icons'
import { IconKoma } from './shogi/ui/Icons'

/** The mark for a variant: the chess crown, or a shogi koma. */
function Glyph({ variant }: { variant: Variant }) {
  return variant === 'shogi' ? <IconKoma size={15} /> : <IconCrown size={15} />
}

/**
 * The chess / shogi switch, shown in the top bar of both games.
 *
 * It sits between the brand and the buttons, so the bar's space-between layout
 * centres it without moving either of them — which is also what makes it a
 * clean thing to regression-test: adding it must not shift anything else.
 */
export function VariantSwitch() {
  const variant = useVariant((s) => s.variant)
  const setVariant = useVariant((s) => s.setVariant)

  return (
    <div className="variant-switch" role="tablist" aria-label="ゲームの種類">
      {VARIANTS.map((v) => {
        const on = variant === v.id
        return (
          <button
            key={v.id}
            role="tab"
            aria-selected={on}
            className={`variant-btn ${on ? 'on' : ''}`}
            onClick={() => setVariant(v.id)}
            title={on ? `${v.label}を表示中` : `${v.label}に切り替え`}
          >
            <Glyph variant={v.id} />
            <span className="variant-label">{v.label}</span>
          </button>
        )
      })}
    </div>
  )
}
