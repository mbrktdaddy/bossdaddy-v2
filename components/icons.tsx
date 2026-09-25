import * as React from 'react'

// Shared outline icon set (Heroicons v1 paths, 24×24, currentColor stroke).
// Use these instead of pasting <svg><path d="…"/></svg> — the paths below were
// each hand-copied 4-19 times before this file existed. Size + colour via
// className; stroke weight via strokeWidth (SVG default is 1 — pass it).
// Chrome only: member-authored content may use emoji (brand-guide §7.1).

type IconProps = React.SVGProps<SVGSVGElement>

function make(d: string, name: string) {
  function Icon(props: IconProps) {
    return (
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
        <path d={d} />
      </svg>
    )
  }
  Icon.displayName = name
  return Icon
}

export const XIcon            = make('M6 18L18 6M6 6l12 12', 'XIcon')
export const CheckIcon        = make('M5 13l4 4L19 7', 'CheckIcon')
export const CheckCircleIcon  = make('M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z', 'CheckCircleIcon')
export const ChevronLeftIcon  = make('M15 19l-7-7 7-7', 'ChevronLeftIcon')
export const ChevronRightIcon = make('M9 5l7 7-7 7', 'ChevronRightIcon')
export const ChevronDownIcon  = make('M19 9l-7 7-7-7', 'ChevronDownIcon')
export const PlusIcon         = make('M12 4v16m8-8H4', 'PlusIcon')
export const SearchIcon       = make('M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z', 'SearchIcon')
export const PhotoIcon        = make('M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z', 'PhotoIcon')
export const EnvelopeIcon     = make('M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z', 'EnvelopeIcon')
export const StarIcon         = make('M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.562.562 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z', 'StarIcon')
export const CubeIcon         = make('M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4', 'CubeIcon')
export const TrashIcon        = make('M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0', 'TrashIcon')
export const DownloadIcon     = make('M12 4v12m0 0-4-4m4 4 4-4M4 20h16', 'DownloadIcon')
export const ScaleIcon        = make('M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0012 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3 .52m-3-.52l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.988 5.988 0 01-2.031.352 5.988 5.988 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L18.75 4.971zm-16.5.52c.99-.203 1.99-.377 3-.52m0 0l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.989 5.989 0 01-2.031.352 5.989 5.989 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L5.25 4.971z', 'ScaleIcon')
