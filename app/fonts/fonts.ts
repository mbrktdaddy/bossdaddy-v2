import localFont from "next/font/local";

// Self-hosted fonts — every family the site renders, served from our own
// domain with no build-time dependency on Google.
//
// WHY NOT next/font/google: it downloads the font CSS from fonts.googleapis.com
// on every build. On 2026-10-08 Google began answering Source Serif 4 with
// extensionless `fonts.gstatic.com/l/font?kit=…&skey=…` URLs, which Turbopack's
// font resolver can't parse ("next/font/google queries have exactly one
// entry") — a hard build failure from a third-party response shape. Vendoring
// the files removes that dependency. Visitor-facing output is unchanged:
// next/font always served the files from /_next/static/media (CSP font-src
// 'self'), with size-adjusted fallbacks.
//
// FILES: @fontsource-variable/* v5.3.0 (built from the Google Fonts sources),
// variable `wght` axis only — other axes (Fraunces/Source Serif opsz) are
// pinned at their defaults, matching what Google served for a wght-only
// request. Licence: SIL OFL 1.1, alongside each family as OFL.txt.
//
// SUBSETS: each family is two calls — a Latin face and a Latin Extended face,
// split by `unicode-range` exactly like Google's CSS. next/font/local can't
// set a range per src entry, hence two calls. Each call gets its own generated
// family name, so app/globals.css composes the stack `var(--x-ext), var(--x)`.
// The ranges are disjoint, so Latin characters skip the -ext family and the
// browser downloads the -ext file only when a page actually contains one of
// its characters (Polish/Czech/Turkish names, etc.) — English pages cost the
// same as before. The -ext call is `preload: false` (never competes for the
// critical path) and `adjustFontFallback: false` (the Latin call owns the
// size-adjusted fallback face, which sits last in the stack).
//
// Don't add a custom `font-family` to `declarations` to merge the two calls
// into one family: Turbopack keeps it on the @font-face but still points the
// CSS variable at its own generated name, so the font silently never applies.
//
// WEIGHTS: declared to the same ranges the Google calls requested, so any
// in-between weight resolves the way it did before (CSS clamps to the range).
//
// next/font requires literal arguments — the ranges can't be hoisted into
// constants. Latin = U+0000-00FF…U+FFFD, Latin Ext = U+0100-02BA…U+A720-A7FF.
//
// PERF — `preload: false` on both serifs is deliberate, do not remove.
// next/font emits a high-priority <link rel="preload"> for every family by
// default. Neither serif renders above the fold (Fraunces starts at the Cover
// Story; Source Serif is blockquote-only), yet the four woff2 files they pull
// in were ~180 KB racing the hero image on the LCP critical path — measured as
// the dominant cost of a 5.6s mobile LCP (Moto G Power / Slow 4G, 2026-08-02).
// Dropping the preload keeps `display: swap` and the size-adjusted fallback
// metrics (so CLS stays 0); the fonts simply load at normal priority once the
// CSS references them, well before either surface scrolls into view. Only add
// a preload back for a family that actually paints above the fold.

// Body / UI.
export const geistSans = localFont({
  src: "./geist/geist-latin-wght-normal.woff2",
  variable: "--font-geist-sans",
  weight: "100 900",
  style: "normal",
  display: "swap",
  adjustFontFallback: "Arial",
  declarations: [
    { prop: "unicode-range", value: "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD" },
  ],
});
export const geistSansExt = localFont({
  src: "./geist/geist-latin-ext-wght-normal.woff2",
  variable: "--font-geist-sans-ext",
  weight: "100 900",
  style: "normal",
  display: "swap",
  preload: false,
  adjustFontFallback: false,
  declarations: [
    { prop: "unicode-range", value: "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF" },
  ],
});

// Display / headings (font-black heroes).
export const montserrat = localFont({
  src: "./montserrat/montserrat-latin-wght-normal.woff2",
  variable: "--font-montserrat",
  weight: "700 900",
  style: "normal",
  display: "swap",
  adjustFontFallback: "Arial",
  declarations: [
    { prop: "unicode-range", value: "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD" },
  ],
});
export const montserratExt = localFont({
  src: "./montserrat/montserrat-latin-ext-wght-normal.woff2",
  variable: "--font-montserrat-ext",
  weight: "700 900",
  style: "normal",
  display: "swap",
  preload: false,
  adjustFontFallback: false,
  declarations: [
    { prop: "unicode-range", value: "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF" },
  ],
});

// Article blockquotes + prose emphasis. `preload: false` — see PERF above.
export const sourceSerif4 = localFont({
  src: [
    { path: "./source-serif-4/source-serif-4-latin-wght-normal.woff2", style: "normal" },
    { path: "./source-serif-4/source-serif-4-latin-wght-italic.woff2", style: "italic" },
  ],
  variable: "--font-serif",
  weight: "400 600",
  display: "swap",
  preload: false,
  adjustFontFallback: "Times New Roman",
  declarations: [
    { prop: "unicode-range", value: "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD" },
  ],
});
export const sourceSerif4Ext = localFont({
  src: [
    { path: "./source-serif-4/source-serif-4-latin-ext-wght-normal.woff2", style: "normal" },
    { path: "./source-serif-4/source-serif-4-latin-ext-wght-italic.woff2", style: "italic" },
  ],
  variable: "--font-serif-ext",
  weight: "400 600",
  display: "swap",
  preload: false,
  adjustFontFallback: false,
  declarations: [
    { prop: "unicode-range", value: "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF" },
  ],
});

// Editorial display serif — Manifesto v2 design system. Carries the
// magazine/"cover story" voice on Cover Story, editorial section H2s, guide
// titles, and the mission Creed. Scoped opt-in via `font-editorial-display`
// (see docs/brand-guide.md §3 + docs/home-manifesto-spec.md) — headings stay
// Montserrat font-black by default. `preload: false` — see PERF above.
export const fraunces = localFont({
  src: [
    { path: "./fraunces/fraunces-latin-wght-normal.woff2", style: "normal" },
    { path: "./fraunces/fraunces-latin-wght-italic.woff2", style: "italic" },
  ],
  variable: "--font-fraunces",
  weight: "400 700",
  display: "swap",
  preload: false,
  adjustFontFallback: "Times New Roman",
  declarations: [
    { prop: "unicode-range", value: "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD" },
  ],
});
export const frauncesExt = localFont({
  src: [
    { path: "./fraunces/fraunces-latin-ext-wght-normal.woff2", style: "normal" },
    { path: "./fraunces/fraunces-latin-ext-wght-italic.woff2", style: "italic" },
  ],
  variable: "--font-fraunces-ext",
  weight: "400 700",
  display: "swap",
  preload: false,
  adjustFontFallback: false,
  declarations: [
    { prop: "unicode-range", value: "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF" },
  ],
});

// Dashboard-only monospace (loaded by app/(dashboard)/layout.tsx).
export const geistMono = localFont({
  src: "./geist-mono/geist-mono-latin-wght-normal.woff2",
  variable: "--font-geist-mono",
  weight: "100 900",
  style: "normal",
  display: "swap",
  adjustFontFallback: "Arial",
  declarations: [
    { prop: "unicode-range", value: "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD" },
  ],
});
export const geistMonoExt = localFont({
  src: "./geist-mono/geist-mono-latin-ext-wght-normal.woff2",
  variable: "--font-geist-mono-ext",
  weight: "100 900",
  style: "normal",
  display: "swap",
  preload: false,
  adjustFontFallback: false,
  declarations: [
    { prop: "unicode-range", value: "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF" },
  ],
});

// Applied to <html> in app/layout.tsx. Geist Mono is applied separately by the
// dashboard layout.
export const rootFontVariables = [
  geistSans.variable,
  geistSansExt.variable,
  montserrat.variable,
  montserratExt.variable,
  sourceSerif4.variable,
  sourceSerif4Ext.variable,
  fraunces.variable,
  frauncesExt.variable,
].join(" ");
