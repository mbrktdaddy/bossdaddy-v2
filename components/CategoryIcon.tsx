type Props = {
  slug: string
  className?: string
}

// Hand-drafted simple line icons in the Heroicons aesthetic (24×24,
// currentColor stroke, rounded caps + joins). Inlined as React fragments so
// the wrapping <svg> can apply consistent props in one place.
const ICONS: Record<string, React.ReactNode> = {
  'kids-family': (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 21v-1a6 6 0 0 1 12 0v1" />
      <circle cx="17" cy="10" r="2" />
      <path d="M14 17.5a4 4 0 0 1 5-3.5" />
    </>
  ),
  'tools-diy': (
    <>
      <circle cx="16" cy="8" r="3.5" />
      <path d="M13.5 10.5l-10 10 2 2 10-10" />
      <path d="M14.5 6.5l3 3" />
    </>
  ),
  'grilling-cooking': (
    <path d="M12 22a6 6 0 0 0 6-6c0-4-4-5-4-9 0 0-2 1-3 4-1-2-2-3-3-3 0 4-4 5-4 9a6 6 0 0 0 6 6z" />
  ),
  'outdoors-adventure': (
    <>
      <path d="M3 20l6-9 4 6 3-4 5 7H3z" />
      <circle cx="17" cy="7" r="2" />
    </>
  ),
  'tech-edc': (
    <>
      <rect x="7" y="2" width="10" height="20" rx="2" />
      <path d="M11 19h2" />
    </>
  ),
  'vehicles-garage': (
    <>
      <path d="M3 16V8h11v8H3z" />
      <path d="M14 11h4l3 3v2h-7" />
      <circle cx="7" cy="18" r="1.75" />
      <circle cx="17" cy="18" r="1.75" />
    </>
  ),
  'health-wellness': (
    <path d="M12 21s-7-5-7-11a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 6-7 11-7 11z" />
  ),
  'home-lifestyle': (
    <path d="M3 12l9-9 9 9M5 10v10h14V10M10 20v-5h4v5" />
  ),
}

export default function CategoryIcon({ slug, className = '' }: Props) {
  const content = ICONS[slug]
  if (!content) return null
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {content}
    </svg>
  )
}
