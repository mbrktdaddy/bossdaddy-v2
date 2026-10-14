// THE OVERLAY RECIPE — every floating panel: Modal, Menu, GlobalSearch.
// `border-prose` is the sanctioned inversion pair, the same one the outline
// button and PILL_BASE use: black on the light page, white inside a dark zone.
// It replaced `border-chrome`, which is identical on the page but black-on-black
// in a zone — the dashboard's modals had no visible edge at all. No shadow:
// Hard Goods separates by edge, never by blur. No new token on purpose.
//
// Its own module (not Modal.tsx) because Modal is 'use client' — a Server
// Component importing a string from a client module gets a reference proxy,
// not the string.
export const OVERLAY_PANEL = 'bg-surface border-2 border-prose rounded-xl'
