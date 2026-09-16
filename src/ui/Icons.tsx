interface IconProps {
  size?: number
  className?: string
}

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
})

export function IconNew({ size = 18, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

export function IconUndo({ size = 18, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h9a7 7 0 0 1 0 14H8" />
    </svg>
  )
}

export function IconFlip({ size = 18, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M4 9a8 8 0 0 1 13.2-3.2L20 8" />
      <path d="M20 4v4h-4" />
      <path d="M20 15a8 8 0 0 1-13.2 3.2L4 16" />
      <path d="M4 20v-4h4" />
    </svg>
  )
}

export function IconSettings({ size = 18, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
      <circle cx="16" cy="7" r="2.2" />
      <circle cx="8" cy="17" r="2.2" />
    </svg>
  )
}

export function IconClose({ size = 18, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  )
}

export function IconSound({ size = 18, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M4 9.5h3l4-3.5v12l-4-3.5H4z" />
      <path d="M15 9.5a3.5 3.5 0 0 1 0 5" />
      <path d="M17.6 7a7 7 0 0 1 0 10" />
    </svg>
  )
}

export function IconMute({ size = 18, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M4 9.5h3l4-3.5v12l-4-3.5H4z" />
      <path d="M15.5 10l4 4M19.5 10l-4 4" />
    </svg>
  )
}

export function IconList({ size = 18, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  )
}

export function IconCrown({ size = 18, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M3 8l3.5 9h11L21 8l-5 3.5L12 5 8 11.5z" />
    </svg>
  )
}