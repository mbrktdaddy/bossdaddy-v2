'use client'

import { createContext, useContext, useRef } from 'react'
import Link from 'next/link'
import { useDisclosure, type Disclosure, type DisclosureTriggerProps } from '@/lib/hooks/useDisclosure'
import { OVERLAY_PANEL } from './overlay'
import { CountBadge } from './CountBadge'

// The one dropdown — Topics, Account, Activity, goal-card options, thread
// options. Before this, five menus had five panels (three edges, two radii,
// one with a shadow-2xl that the light canvas turned into a grey smear) and
// five sets of row padding, most under the 44px tap floor.
//
//   <Menu trigger={(p) => <IconButton {...p} label="Account">…</IconButton>}>
//     <MenuLabel>Signed in</MenuLabel>
//     <MenuItem href="/account" icon={<UserIcon />}>Account</MenuItem>
//     <MenuDivider />
//     <MenuItem onSelect={signOut} danger>Sign out</MenuItem>
//   </Menu>
//
// Need tabs or a feed? Compose `useDisclosure` + <MenuPanel> yourself (the
// activity menu does). The panel is the overlay recipe; behaviour is the hook.
//
// NOT role="menu": that role promises arrow-key roving focus, which hasn't
// shipped. Until it does this is a disclosure of links/buttons — Tab works,
// and assistive tech isn't told to expect keys that do nothing.

const MenuContext = createContext<{ close: (restoreFocus?: boolean) => void } | null>(null)

// Literal class strings only — Tailwind can't see `sm:${x}`.
const WIDTH = { default: 'w-56', feed: 'w-80' } as const
const WIDTH_SM = { default: 'sm:w-56', feed: 'sm:w-80' } as const
const SIDE = { start: 'left-0', end: 'right-0' } as const
const SIDE_SM = { start: 'sm:left-0', end: 'sm:right-0' } as const

interface PanelLayout {
  /** Which trigger edge the panel lines up with. `start` inside narrow left columns (the dashboard sidebar). */
  align?: 'start' | 'end'
  width?: keyof typeof WIDTH
  /**
   * Phones only: pin the panel to the viewport under the masthead instead of
   * anchoring it to the trigger. For triggers that sit mid-header, where an
   * anchored w-80 panel runs off the screen edge. 4.25rem = 64px masthead + 4px rule.
   */
  pinOnPhone?: boolean
}

function panelClass({ align = 'end', width = 'default', pinOnPhone = false }: PanelLayout) {
  const place = pinOnPhone
    ? `fixed inset-x-3 top-[4.25rem] w-auto sm:absolute sm:inset-x-auto sm:top-full sm:mt-2 ${SIDE_SM[align]} ${WIDTH_SM[width]}`
    : `absolute top-full mt-2 ${SIDE[align]} ${WIDTH[width]}`
  return `${place} max-w-[calc(100vw-1.5rem)] z-50 p-1.5 text-prose ${OVERLAY_PANEL}`
}

/** The positioned overlay panel. Render it inside a `relative` wrapper, only while open. */
export function MenuPanel({
  disclosure, label, className = '', children, ...layout
}: PanelLayout & {
  disclosure: Disclosure
  /** Accessible name for the panel region. */
  label?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <MenuContext.Provider value={{ close: disclosure.close }}>
      <div {...disclosure.panelProps} aria-label={label} className={`${panelClass(layout)} ${className}`}>
        {children}
      </div>
    </MenuContext.Provider>
  )
}

export function Menu({
  trigger, label, className = '', panelClassName = '', children, ...layout
}: PanelLayout & {
  /** Render the trigger; spread the props onto a <button> or <IconButton>. */
  trigger: (props: DisclosureTriggerProps & { open: boolean }) => React.ReactNode
  label?: string
  className?: string
  panelClassName?: string
  children: React.ReactNode
}) {
  const disclosure = useDisclosure()
  return (
    <div className={`relative ${className}`}>
      {trigger({ ...disclosure.triggerProps, open: disclosure.open })}
      {disclosure.open && (
        <MenuPanel disclosure={disclosure} label={label} className={panelClassName} {...layout}>
          {children}
        </MenuPanel>
      )}
    </div>
  )
}

const ITEM =
  'flex w-full items-center gap-2.5 px-3 min-h-11 rounded-md text-left text-sm font-medium transition-colors ' +
  'focus-visible:outline-none focus-visible:bg-surface-hover focus-visible:text-prose ' +
  // The icon recipe, applied from here so call sites pass a bare icon.
  '[&_svg]:w-4 [&_svg]:h-4 [&_svg]:shrink-0 [&_svg]:[stroke-width:1.8]'

function itemTone(current: boolean, danger: boolean) {
  if (danger) return 'text-danger-ink hover:bg-danger-bg [&_svg]:text-danger-ink'
  // Current = fill only (state changes colour, never geometry).
  if (current) return 'bg-surface-hover text-prose [&_svg]:text-prose-muted'
  return 'text-prose-muted hover:bg-surface-hover hover:text-prose [&_svg]:text-prose-faint'
}

type MenuItemProps = {
  icon?: React.ReactNode
  /** The page you're on — fill + aria-current. */
  current?: boolean
  danger?: boolean
  className?: string
  children: React.ReactNode
} & (
  | { href: string; onSelect?: never; type?: never; disabled?: never }
  | { href?: never; onSelect: () => void; type?: never; disabled?: boolean }
  /**
   * A submit button inside a <form> in the panel (sign-out). It deliberately
   * does NOT close the menu on click: closing unmounts the panel, and the form
   * with it, mid-submit — the POST never leaves (memory: form-unmount
   * anti-pattern). The navigation that follows closes it.
   */
  | { href?: never; onSelect?: never; type: 'submit'; disabled?: boolean }
)

export function MenuItem({ icon, current = false, danger = false, className = '', children, ...rest }: MenuItemProps) {
  const ctx = useContext(MenuContext)
  const cls = `${ITEM} ${itemTone(current, danger)} ${className}`
  const body = <>{icon}{children}</>

  if (rest.href !== undefined) {
    return (
      <Link href={rest.href} aria-current={current ? 'page' : undefined} onClick={() => ctx?.close(false)} className={cls}>
        {body}
      </Link>
    )
  }
  if (rest.type === 'submit') {
    return <button type="submit" disabled={rest.disabled} className={`${cls} disabled:opacity-50`}>{body}</button>
  }
  return (
    <button
      type="button"
      disabled={rest.disabled}
      aria-current={current ? 'true' : undefined}
      onClick={() => { rest.onSelect?.(); ctx?.close() }}
      className={`${cls} disabled:opacity-50`}
    >
      {body}
    </button>
  )
}

/** Small caps group label — the Eyebrow recipe. */
export function MenuLabel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <p className={`px-3 pt-2 pb-1 text-xs text-eyebrow uppercase tracking-widest font-semibold ${className}`}>{children}</p>
}

/** Full-bleed hairline across the panel's 6px padding. */
export function MenuDivider() {
  return <hr className="-mx-1.5 my-1.5 border-0 border-t border-soft" />
}

/** The tracked-caps action at the foot of a panel ("All notifications", "All topics"). */
export function MenuFooterLink({ href, children, className = '' }: { href: string; children: React.ReactNode; className?: string }) {
  const ctx = useContext(MenuContext)
  return (
    <Link
      href={href}
      onClick={() => ctx?.close(false)}
      className={`flex items-center justify-center gap-1.5 min-h-11 px-3 rounded-md font-display font-extrabold text-[11px] uppercase tracking-[0.1em] text-prose hover:bg-surface-hover transition-colors ${className}`}
    >
      {children}
    </Link>
  )
}

/**
 * Tabs inside a panel (Notifications | Messages). 44px tall. Every tab carries
 * a 2px bottom border — transparent at rest, accent when active — so switching
 * changes colour only, never the row's height. Left/Right arrows move between
 * tabs (the ARIA tabs pattern); the caller renders the matching panel.
 */
export function MenuTabs<T extends string>({
  tabs, value, onChange, label, className = '',
}: {
  tabs: { value: T; label: string; count?: number }[]
  value: T
  onChange: (v: T) => void
  label: string
  className?: string
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  function onKeyDown(e: React.KeyboardEvent, i: number) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    e.preventDefault()
    const next = (i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length
    onChange(tabs[next].value)
    refs.current[next]?.focus()
  }
  return (
    <div role="tablist" aria-label={label} className={`flex -mx-1.5 -mt-1.5 mb-1.5 border-b border-soft ${className}`}>
      {tabs.map((t, i) => {
        const active = t.value === value
        return (
          <button
            key={t.value}
            ref={(el) => { refs.current[i] = el }}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(t.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={`flex-1 inline-flex items-center justify-center gap-2 min-h-11 px-3 -mb-px border-b-2 font-display font-extrabold text-[11px] uppercase tracking-[0.1em] transition-colors ${
              active ? 'border-accent text-prose' : 'border-transparent text-prose-muted hover:text-prose'
            }`}
          >
            {t.label}
            {t.count !== undefined && <CountBadge count={t.count} />}
          </button>
        )
      })}
    </div>
  )
}
