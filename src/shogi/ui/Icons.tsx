/** The icon set — inline SVG, so nothing has to be fetched. */
interface IconProps {
  size?: number
  className?: string
}

function base(size: number, className?: string) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.6,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className,
    'aria-hidden': true,
  }
}

/** The brand mark: a 駒 seen from the front. */
export function IconKoma({ size = 17, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M7.2 20.5h9.6l-1-13.2L12 3.4 8.2 7.3z" />
      <path d="M9.3 13.6h5.4" strokeWidth={1.2} />
    </svg>
  )
}

export function IconNew({ size = 15, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

export function IconUndo({ size = 15, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M4 9h11a5 5 0 0 1 0 10H9" />
      <path d="M8 5 4 9l4 4" />
    </svg>
  )
}

export function IconFlip({ size = 15, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M12 4v16" />
      <path d="M8 8 4 12l4 4" />
      <path d="m16 8 4 4-4 4" />
    </svg>
  )
}

export function IconList({ size = 15, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M4 6h16M4 12h16M4 18h10" />
    </svg>
  )
}

export function IconSound({ size = 15, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M4 9.5h3l4-3.5v12l-4-3.5H4z" />
      <path d="M15 9a4 4 0 0 1 0 6" />
      <path d="M17.5 6.5a7.5 7.5 0 0 1 0 11" />
    </svg>
  )
}

export function IconMute({ size = 15, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M4 9.5h3l4-3.5v12l-4-3.5H4z" />
      <path d="m15.5 9.5 5 5M20.5 9.5l-5 5" />
    </svg>
  )
}

export function IconSettings({ size = 15, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2.2M12 18.8V21M4.2 7.5l1.9 1.1M17.9 15.4l1.9 1.1M4.2 16.5l1.9-1.1M17.9 8.6l1.9-1.1" />
    </svg>
  )
}

export function IconHint({ size = 15, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M9 17h6" />
      <path d="M10 20h4" />
      <path d="M12 3a6 6 0 0 0-3.4 10.9c.5.4.9.9 1.1 1.5h4.6c.2-.6.6-1.1 1.1-1.5A6 6 0 0 0 12 3z" />
    </svg>
  )
}

export function IconFlag({ size = 15, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M6 21V4" />
      <path d="M6 5h11l-2 4 2 4H6z" />
    </svg>
  )
}
