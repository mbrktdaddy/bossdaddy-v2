# Hard Goods continuity fix plan — the surfaces the sweep didn't reach

**Written 2026-10-14**, after the Hard Goods commit (`f74af09`). Source: six read-only
surface reviews (header menus · email signups · cart/commerce · tools + calculators ·
savings + the Boss · account/profile) plus a scan of every file `f74af09` did not touch.
High findings were spot-checked against source before landing here. **Revised the same
day** after a second-pass review: D1 corrected against the approved mockup (it used white
ink on small orange elements — the doctrine is a block/chip split, not a contradiction),
the overlay edge token dropped for the existing `border-prose` recipe, `Notice` /
`MenuTabs` / `Switch` / `ProgressBar` added, the unsubscribe GET-with-side-effect and
missing `List-Unsubscribe` headers added, a walkthrough per phase.

**How to use this file.** Work top to bottom. Phase 1 (shared primitives) is the
precondition for everything after it — most surface fixes are "adopt the primitive",
not hand edits. Each phase lists its files, its acceptance bar, and a phone walkthrough.
One session per block (§8); start each session by reading only its phase section.

---

## 1. Scope

**In:** every public, member and auth surface — header menus, the notification/messages
dropdown, cart + checkout + order, signups/opt-ins, tools (hub, cards, calculators,
savings, the Boss, family, goals/today), account + messaging + profile, loading and
error states, auth pages, the bench/article leftovers, the PWA launch screen, social
share cards, transactional email.

**Out (operator, 2026-10-14):** `app/(dashboard)/**`, `components/workspace/**`,
`components/admin/**`, `components/dashboard/**`, `components/media/**` (workspace-only),
`components/merch/SyncMerchButton.tsx` (admin). They inherit primitive changes for free
(Modal, Menu, Field, Button); no dashboard call-site migrations. Also out — already on the
saved TO-DO in `project_light_editorial_canvas`: article prose, Key Takeaways + TOC asides,
the cover-story score ring, the utility `SectionHeader` orange rule.

**Moratorium check (brand-guide §10.1).** Nothing here touches the canvas, the heading
face, the loudness mechanism, or the mobile masthead. D3 extends the existing
`PageHeader` lockup to app pages; ink on orange is applied exactly as the mockup had it.

---

## 2. Why these surfaces drifted — three habits, one gap

The sweep restyled the **reading path**. Everything stateful, member-only, overlaid,
transactional or off-site kept its dark-era construction, and three dark-era habits
fail on a white page:

1. **Separate by fill.** `bg-surface` (#fff) and `bg-surface-raised` (#fafafa) boxes
   with no edge are invisible on the white canvas — the cart, the order page, and the
   `Skeleton` primitive behind 10 loading screens.
2. **`border-faint`** (#f4f4f5) edges vanish on white — the Milestones result card,
   moment cards, the dashed "add kid" button.
3. **White body text on orange.** 4.3:1 on `#CC5500`, 3.6:1 on the zone `#E55A1A` —
   fails AA at body size. The doctrine (brand-guide §2 "Blocks", and the mockup
   `build.mjs`) is a **split**: orange BLOCKS (band, newsletter) carry chrome-black
   ink; orange CHIPS, score chips and buttons (Montserrat black caps, ≤14px, or a
   numeral) carry white. The drift is *body* text on orange — message bubbles, a
   hand-rolled 16px newsletter button — not the chips.

**The gap:** no shared primitive existed for menus, form fields, app-page headers,
count badges, steppers, confirms, avatars, banners/toasts or the newsletter — so every
surface hand-rolled its own, and the sweep (which restyled primitives) never reached them.

---

## 3. Decisions

| # | Question | Recommendation (default if no answer) | Alternative |
|---|---|---|---|
| **D1** | Ink on orange | **Already decided by the approved mockup — not reopened.** Blocks = `text-chrome`; chips / score chips / buttons / count badges / avatar initials = white. Zone primary button stays hot orange + white (`.tool .btn` in the mockup). The plan *applies* the split: body text never sits on orange (bubbles go black, the hand-rolled orange newsletter button becomes the black primary). | None — reopening it would be a design change to approved surfaces. |
| **D2** | Email look | **Light** — white body, black masthead strip with the 4px orange rule and the white wordmark, near-black text, black uppercase 4px button. Mirrors the site; dark-mode clients invert on their own. | Keep the dark body; fix only the wordmark, button and radius. |
| **D3** | App-page header (account, cart, order, tools, savings, the Boss, goals/today, auth) | **`PageHeader size="compact"`** — label block + uppercase H1 at 2xl/3xl + 3px chrome rule, the lockup `/install` already uses. | Standardise the quieter Eyebrow + sentence-case H1 that `/goals` uses today. |

**Decided — PWA launch screen (operator, 2026-10-14: "what it would typically be"):**
splash = the page canvas, status bar = the masthead. `background_color` → `#ffffff`
(follows `lib/canvas.ts` so `BD_CANVAS=dark` restores `#09090b`); `theme_color` and
`viewport.themeColor` → `#09090b` (the chrome token; was `#0a0a0a`). The home-screen tile,
maskable icon and favicon **stay dark** — a black tile with the orange hex is the brand
edge (DeWalt), and a tile is not a canvas. The 512 `any` icon is an orange hex on
transparent, so the splash reads as the orange hex on white.

**My calls — veto any:** message bubbles use the recipe `BossChat` already has (own =
`bg-chrome text-white`, peer = `bg-surface-raised`; orange reserved for the unread
marker); tools hub = black `ToolCard`s for the 4 main spokes, chrome-box compact cards for
the calculators (caps black panels per screen); "liked" = accent fill on the square chip,
no raw red; every calculator renders its result panel from first paint with an empty
voice line (no layout jump when the first number lands); `MobileBottomNav` goes solid
`bg-chrome` to match the masthead (drops `/95` + blur); overlays in dark zones take the
white 2px edge (P2) — if that reads too loud on the phone, the fallback is a dedicated
edge token that resolves to `border-strong` inside zones.

---

## 4. Phase 1 — Shared primitives (do first; everything else adopts these)

| ID | Primitive | Spec | Unlocks |
|---|---|---|---|
| **P1** | `Skeleton` tones (`components/ui/Skeleton.tsx:12`) | blocks `bg-surface-hover`; `soft` → `bg-surface-hover/60` | all 10 skeleton loading screens, one line |
| **P2** | **One overlay recipe** — no new token | `bg-surface border-2 border-prose rounded-xl`, no shadow: the sanctioned inversion pair (black on the page, white inside zones — what the outline button and `PILL_BASE` already do). `Modal` swaps `border-chrome` → `border-prose` (identical on the page; visible in zones for the first time). GlobalSearch adopts it | Modal, GlobalSearch, Menu panel |
| **P3** | `Menu` + `useDisclosure` (`components/ui/Menu.tsx`, `lib/hooks/useDisclosure.ts`) | Hook: Esc, outside `pointerdown`, close on route change, focus returns to the trigger, `aria-expanded/haspopup/controls`. Panel = P2 recipe, `p-1.5 z-50 mt-2`, `w-56` default / `w-80` feed, `align: 'start' \| 'end'`, `pinOnPhone` → `fixed inset-x-3 top-[4.25rem]` (64px masthead + 4px rule). `MenuItem`: `flex items-center gap-2.5 px-3 min-h-11 rounded-md text-sm font-medium text-prose-muted hover:bg-surface-hover hover:text-prose`; icon `w-4 h-4 text-prose-faint` stroke 1.8; current = fill + `aria-current`; danger = `text-danger-ink hover:bg-danger-bg`. `MenuLabel` = Eyebrow recipe; `MenuDivider` = `border-t border-soft`; `MenuFooterLink` = tracked-caps action link, `min-h-11`; `MenuTabs` = `role=tablist`, 44px, active = 2px accent underline (colour only). `role="menu"` only if arrow keys ship | Topics, Account, Activity, GoalCardMenu, Thread options |
| **P4** | `IconButton` + `CountBadge` | IconButton: 44px square ghost, `rounded-md`, `aria-label` required, `tone: 'chrome' \| 'overlay'` (overlay = `bg-chrome/60 text-white` for lightbox/gallery controls). CountBadge: `min-w-[18px] h-[18px] px-1 rounded-sm bg-accent text-white` Montserrat black 10px tabular, `99+`; caller positions it. Unread dot = 8px round, **always mounted** (transparent when read) | bell, cart, search, hamburger, thread options, lightbox, share rows; 6 hand-rolled count dots |
| **P5** | `Field` (`components/ui/Field.tsx`) | `fieldClass({ tone: 'page' \| 'onBlock' })` → `w-full min-h-[44px] px-3.5 rounded-md text-base sm:text-sm text-prose placeholder:text-prose-faint bg-surface border border-strong focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent` (onBlock: `border-2 border-chrome focus:ring-2 focus:ring-chrome`). `<Field label hint error type inputMode>` wires `htmlFor` / `aria-describedby` via `useId`; `type="date"` and `textarea` supported. Mirrors `buttonVariants`: string + thin wrapper | ~30 inputs on 4 recipes, all 14px / 40px today |
| **P6** | `PageHeader size="compact"` | H1 `text-2xl sm:text-3xl` uppercase font-black, label block, 3px chrome rule, **no `max-w-6xl` wrapper** so the caller's column governs; reuse the existing `back` prop (no hand-rolled back links anywhere) | D3 — ~25 app pages |
| **P7** | `useConfirm()` on `Modal` | promise-returning confirm / prompt; `danger` variant; the one two-step pattern for irreversible actions | 9 native `confirm()` / `prompt()` in scope |
| **P8** | `QtyStepper` | 44px cells, `border-2 border-prose rounded-md`, aria-labels, disabled at bounds; "−" at 1 never deletes; `onError` surfaces a danger line | product page + cart (two steppers today, 28–32px) |
| **P9** | `Avatar` | round; initials fallback `bg-accent text-white` (one letter, 900 weight = chip class per D1; what `AccountMenu` does today — **one recipe replaces the peach `bg-accent/15`, the `bg-chrome` kid rows, and the `AvatarUploader` orange gradient**); sizes 24/32/44/96. **Author portraits stay square** (AuthorBio, Hard Goods) | ~8 fallback recipes |
| **P10** | `Segmented` → `components/ui` (re-exported from `CalculatorParts` to avoid churn), `PILL_WRAP`, `PillFilterStrip bleed` | Segmented: radiogroup + `aria-checked`, square PILL recipe. `PILL_WRAP` = PILL minus nowrap/shrink/uppercase: square 2px, 44px min, wraps, sentence case. `bleed: 4 \| 6` → `-mx-4 px-4` / `-mx-6 px-6` (the `px-4` tool pages hand-rolled scrollers because the strip only bled 6) | calculator toggles; the Boss suggestion chips; kid/unit pickers |
| **P11** | `NewsletterSignup` (`components/newsletter/`) | logic from `EmailSignup.tsx`. `variant: 'block' \| 'card' \| 'inline'`, `intent: 'digest' \| 'notify'` + `topic` (notify tags never `newsletter`). `<form action={serverAction}>` + `useActionState` — works without JS, so the API route's form-POST branch retires (audit JSON callers before deleting the route). The server action already rate-limits (`checkRateLimit`) — keep it. States idle/submitting/success/already/error with `role=status/alert`, **same height in every state**. Strings in `LABELS.newsletter` | homepage block, cards, opt-ins (Phase 4) |
| **P12** | `ToolCard` + `CalculatorPage` / `ResultCard` upgrades | ToolCard from `BossToolsSection.tsx:50-67`: `size: 'full' \| 'compact'`, `tone: 'panel' \| 'box'`, kicker from `LABELS`. ResultCard: `aria-live="polite"`, drop the dead `tone` prop, always-render + empty voice line, children slot for share / save / opt-in / links. CalculatorPage uses P6 | 4 tool-card treatments → 1; all six calculators |
| **P13** | `RouteError` | `EmptyState subtle` + primary "Try again" + outline "Back to …", `role="alert"`, no raw red. `app/global-error.tsx` can't use the layout or the fonts — restyle its **inline** styles to the light canvas (white, `#18181b`, black uppercase button, 4px orange rule) | 8 `error.tsx` copies + global-error |
| **P14** | Button geometry | every variant carries a 2px border (`border-transparent` where it has no edge) so swapping variants (Add → Added) never changes height | "Added to cart" jump; all state swaps |
| **P15** | `LABELS` | add `messages`, `notifications`, `settings` (fix the "Account Settings" casing), `topics`, `newsletter.*`, `search.placeholder`, `tools.weekendsUntil.{h1,tagline,disclosure}`; remove the retired "Your stuff lives here →" (`settings/page.tsx:73`) | ~15 hard-coded labels |
| **P16** | Guard `scripts/check-hard-goods.mjs` — **ratchet mode** | `scripts/hard-goods-baseline.json` = offenders per file, **generated as the LAST step of session 1** (after the primitives change strings); fails on any new offender or a growing count; each phase deletes its entries; Phase 10 empties it → strict. Rules: **R1** `bg-accent` + `text-white` + a body size (`text-sm\|base\|lg`) in one class string (white *body* text on orange) · **R2** `rounded-full` with `px-`/`py-` (a pill) · **R3** `bg-accent/N` tints · **R4** `border-faint` · **R5** native `confirm(`/`prompt(`/`alert(` · **R6** raw red/green/orange/purple/blue/amber/stone shades · **R7** an `<input>`/`<textarea>` opening tag (parsed to its `>`; `type` checkbox/radio/hidden/file/range/color excluded) whose className has `text-xs\|sm\|[1x px]` without `text-base` · **R8** `hover:bg-accent-hover` outside `components/ui/Button.tsx` (the hand-rolled-primary tell). Scope: `app/(public)`, `app/(auth)`, `components/**` minus the §1 exclusions. **Armed** in `prebuild` and the pre-commit guard set the day it lands | stops regression while phases land |
| **P17** | `Notice` (`components/ui/Notice.tsx`) | the one banner / toast: `data-theme="dark" bg-chrome border-t-4 border-accent rounded-xl`, `role=status`, optional `IconButton` dismiss; `variant: 'banner' \| 'toast' \| 'inline'`. Replaces `WelcomeToast` + `InstallPrompt` internals, `InstallPWA`, `VotePayoffBanner`, the Thread toast | 5 banner recipes → 1 |
| **P18** | Small controls: `Switch`, `ProgressBar` | Switch: 44px hit area, `aria-checked`, track `rounded-full` (**the one sanctioned pill control** — a dot in a track; document in §4), accent when on. ProgressBar: `rounded-sm`, `bg-surface-sunken` track, `bg-accent` fill, `role=progressbar` | settings toggles; GoalCard / ProgressBlock / goals bars |

**Acceptance:** primitives exported with a header comment in the house style (why, not
what); `npm run check` + `npm test` + `npm run prebuild` green; the guard armed and
passing against its baseline. **Walkthrough:** none yet — primitives aren't visible until
Phase 2/3 adopt them; the homepage must look identical after session 1 except the
launch screen and the bench gap.

---

## 5. Phase 2 — Real bugs + quick wins (small; ship with Phase 1)

| ID | Sev | Where | Fix |
|---|---|---|---|
| B1 | High | `EmailCaptureSection.tsx:59` POSTs to `/api/newsletter/subscribe`, which redirects to `/?newsletter=…`; nothing reads the param — the homepage signup gives **no feedback** | P11 `block` variant (in-block states) |
| B2 | High | `EmailCaptureSection.tsx:36` promises "Sunday morning"; the digest cron is Tuesday 14:00 UTC (`vercel.json`); `NewsletterCard.tsx:6-8` already says copy must match the cron | day-free headline ("One email a week."), one cadence line across every surface |
| B3 | High | `gifts/page.tsx:128` links `/#newsletter`; no element has that id | render the P11 card in place; also `id="newsletter" scroll-mt-24` on the homepage block |
| B4 | High | `CartItems.tsx:204` `className` paints the disabled checkout translucent orange; `:64` `finally` resets the label while the browser is leaving for Stripe | drop the colour override; reset only on error |
| B5 | Med | `gifts/[occasion]/page.tsx:554` "Notify me" saves `interests: ['newsletter']` → silently enrolled in the weekly digest | `intent="notify"`, tag `notify:gift:<slug>` |
| B6 | Med | `app/actions/newsletter.ts:53-55`, `route.ts:76-78` return ok on a DB error (audit-2026-08-16 #18) | return the error; the UI shows it |
| B7 | Med | `api/newsletter/unsubscribe/route.ts` deletes by raw email on **GET** — anyone can unsubscribe any address, and link scanners (Gmail prefetch, Outlook SafeLinks) can do it silently; lands on a plain homepage. **No email carries `List-Unsubscribe` headers** | GET → a confirmation page (reuse the `/tools/email-unsubscribe` layout; add it to the `check:og` allowlist); POST performs; links carry a signed token (HMAC of email), legacy raw-email links accepted but only via the confirm step; `List-Unsubscribe` + `List-Unsubscribe-Post: List-Unsubscribe=One-Click` (RFC 8058) on the digest via Resend `headers` (Phase 9 wires the footers) |
| B8 | Med | `lib/dad-tools/email-actions.ts:53` shows raw DB errors; no unique constraint → duplicate subscriptions | friendly error + already state + unique-index migration from `_TEMPLATE.sql` (**he applies it**) |
| B9 | Med | `ActivityMenu.tsx:229` `sm:right-0 sm:w-80` inside the 240px dashboard sidebar → the panel opens ~100px off-screen | P3 `align="start"` at the `DashboardNav.tsx:193` mount (shared component, one prop) |
| B10 | Low | `order/[id]/page.tsx:56-58` + `OrderPoller`: "taking longer than expected" stacks under "this page will refresh automatically" | hide the auto-refresh line when timed out |
| B11 | — | **Launch screen (decided):** `app/manifest.ts:32-33`, `app/layout.tsx:80` | values per §3; rewrite both comments. Walkthrough: reinstall the PWA (Chrome re-mints the WebAPK) and cold-launch |
| B12 | — | dead code | delete `HeroCarousel`, `TrustBand`, `KidCard` (no importers), Header's dead `userMenuOpen` / `userMenuRef`; `EmailSignup.tsx` retires when P11 lands (Phase 4) |
| B13 | Low | `app/(public)/page.tsx:440-444` wraps `BenchStrip` (which returns null at zero, `:45`) in a padded, bordered `section` → an empty strip between the orange newsletter block and the black About band whenever the bench is empty | move the section + padding inside `BenchStrip`; a self-suppressing component owns its own wrapper |

**Walkthrough:** homepage signup → submit → see the in-block confirmation; `/gifts` "Get on
the list" lands on a form; a cold PWA launch shows the orange hex on white, black status bar.

---

## 6. Phases 3–9 — Surface migrations (ordered by reader reach)

### Phase 3 — Site chrome & menus (every page)
`Header.tsx`, `AccountMenu.tsx`, `ActivityMenu.tsx`, `notifications/NotificationFeed.tsx`,
`CartIcon.tsx`, `GlobalSearch.tsx`, `MobileBottomNav.tsx`, `account/ConnectionBadge.tsx`.
- Topics mega, Account, Activity → `Menu`. **One anchor line:** every panel starts below
  the 4px rule, right-aligned `right-4 sm:right-6` (today Topics opens at ~72px, the other
  two at ~58px, over the rule).
- AccountMenu trigger square `rounded-md` (the only pill in the chrome), avatar stays round.
  Account above Settings (fixes the `:186` comment contradiction).
- Bell, cart, search, hamburger → `IconButton` (cart + bell are 36px today); counts →
  `CountBadge`; cart reserves its slot so the cluster doesn't shift when the count arrives;
  cart uses `BagIcon`.
- Activity: Decline (invisible raised-on-raised, `:279`) → outline; Accept/Decline md; tabs →
  `MenuTabs`; notification rows get hover; "Mark all read" + footer link 44px.
- Dropdown ↔ `/account/notifications` parity: relative time on both, `text-accent-text` links,
  one unread treatment (row fill + always-mounted dot), "Mark read" 44px, bulk bar on
  `buttonVariants`.
- Mobile drawer: 44px tiles, drop the `px-2` className override and the inner span restyles
  (`Header.tsx:503-549`), `maxHeight` accounts for the 4px rule, destinations match AccountMenu.
- Retire the `text-copper` alias (`MENU_HEADING`, Topics icons) → `text-eyebrow` / `text-accent-text`;
  delete `--color-copper` once no caller remains.
- GlobalSearch: P2 edge; row hover (`hover:bg-surface` == the panel today); placeholder from LABELS.
- MobileBottomNav: solid `bg-chrome`.
- Every hard-coded label → `LABELS` (P15).

**Walkthrough:** open each menu on phone and desktop; Esc and outside-tap close it; all three
start on the same line under the orange rule; every target ≥44px; the cart count doesn't shift
the icons when it arrives.

### Phase 4 — Email signups & opt-ins
- `EmailCaptureSection` → P11 `block` (16px field, focus ring visible on orange, `onBlock`,
  `id="newsletter"`).
- `NewsletterCard` (reviews, guides, about) → P11 `card` with the **black primary** — fixes the
  hand-rolled orange 16px button and the two-orange-fills-on-screen with `StickyMobileCta`.
- Empty gift guide, empty `/shop`, `/gifts` hub → P11 `card intent="notify"`, label block, one
  heading case.
- `WeeklyCheckinOptIn`, `YearlyCheckinOptIn`, `ResearchedList` notify → P11 `inline` (label,
  16px, 44px trigger link in `text-accent-text`).
- `SubscribeButton`, `RadarVote` → `buttonVariants('outline')`; on-state by colour only; error
  in a wrapper.
- `PushNotificationSetting` → `Button` primary/secondary; `MessageEmailToggle` → `Switch`,
  eyebrow → "Email"; failures show a line instead of reverting silently.
- Unsubscribe confirmation (B7) and `/tools/email-unsubscribe` → one layout.
- **Copy** (→ `LABELS.newsletter`): digest = "The Weekly Drop"; "Join" is reserved for account
  creation; digest buttons "Boss Up." (block) / "Subscribe" (card, inline); alerts "Notify me";
  one success / already / error set; footnote "Unsubscribe anytime · Privacy" linking
  `/privacy-policy`; placeholder `you@example.com`.

**Walkthrough:** subscribe from the homepage, a review, the about page, an empty gift guide and
the Milestones tool; each shows pending → success without the box changing height; submit
twice → the "already" state; the review page never shows two orange fills at once.

### Phase 5 — Reader-path leftovers, loading/error, auth
- 8 `error.tsx` + `global-error.tsx` → P13; add `loading.tsx` for cart + order; rebuild
  `shop/[slug]/loading.tsx` on `SkeletonPage` (`px-6`, square well).
- `LikeButton` → square chip (PILL recipe), liked = accent fill + filled icon, no raw red.
- `GalleryViewer` / `ImageLightbox` → `Modal size="full"` (native focus trap) + `IconButton
  tone="overlay"`, square counter tag, `bg-chrome/90` scrim. `ShareButtons` → `IconButton`.
- `OffTheBench` image tag → square `bg-chrome text-white rounded-sm` (one mark per image).
- `VotePayoffBanner`, `InstallPWA` → `Notice` (`inline`); the floating `InstallPrompt` is
  suppressed on any route showing the inline one.
- `LoginPromptModal` → `Modal` + `buttonVariants`.
- Auth (`login`, `register`, `forgot-password`, `reset-password`, `(auth)/layout`): P6 header,
  P5 fields, raw colours → tokens, H1s from LABELS.
- `RecentlyViewedStrip`: remove the remaining tint.

**Walkthrough:** throttle the network and open a review, a guide, the shop — skeletons are
visible; force an error (`?fail=1` in dev) on a review — the error box has an edge; like a
review; open the lightbox and tab through it; sign in and register on the phone.

### Phase 6 — Commerce
- **Product page:** buy box in `Card tone="chrome"` — price in ink + tabular, PILL selectors,
  P8 stepper, CTA (P14 keeps "Added" geometry), a persistent outline "View cart" after the first
  add; `BackLink`; gallery chevrons `IconButton`; "Coming soon" → `Badge`.
- **Tiles** (`MerchGrid`, `MerchStrip`, `FeaturedMerchCard`, `MerchCallout`): product-tile recipe
  (`aspect-square bg-surface-sunken border-b-[3px] border-chrome`), 2-col phone grid, no fake
  "Buy" / "Notify me" text on tiles, 👕 emoji → `BagIcon`, eyebrows via `LabelBlock` /
  `EditorialHeader`.
- **Cart:** P6 header; `max-w-6xl`, two columns on lg with a sticky summary; line items in ONE
  chrome card with hairline rows; stepper + Remove on a second 44px row (the name is squeezed to
  ~68px today); prices ink; "Free" shipping in `text-success-ink` and from one constant (confirm
  it's true — claims only when set); qty / remove failures show a danger line; checkout errors on
  the danger recipe; Empty cart via `useConfirm` (or drop it); one up-link.
- **Order:** P6 header (title = order number), chrome boxes, `Badge tone="success"` "Paid" in
  place of the green circle + ✓; B10; a Stripe lookup failure (`page.tsx:31,34`) renders a
  `RouteError` state instead of silently redirecting to `/cart`.

**Walkthrough:** phone, start to finish — shop → product → size → add (button keeps its height)
→ "View cart" → change qty → remove → checkout → order page. Every box has an edge; nothing
orange except the "Paid" chip's absence.

### Phase 7 — Tools
- **Cards:** `ToolCard` everywhere — home, hub main spokes (`panel full`), hub calculators
  (`box compact`), the signed-in launcher `ToolTiles` (compact panel, Montserrat label; it's a 1px
  hairline today). `AskTheBoss` stays a chrome box (stateful entry); its orange icon square keeps
  the white icon (non-text). The hub no-kids panel → ToolCard. Kickers from `LABELS`.
- **Calculators:** Dad Math + Milestones move onto `CalculatorPage` / `ResultCard` — fixes the
  Milestones white card with an invisible `border-faint` edge
  (`weekends-until/_components/Result.tsx:110`) and Dad Math's copy-pasted shell. All inputs →
  P5 (`inputMode`, thousands separators on blur); toggles → `Segmented`; one empty-result rule;
  `ResultLinks` everywhere; Milestones gets its disclaimer + next-step links; share buttons 44px.
- **Hub** (`tools/page.tsx`): full `PageHeader` (it's a listing); grid that doesn't orphan; the
  hero's second line is an `h2` → `p`.
- **Family + dad-tools:** P6 + back; `Avatar`; `border-faint` → `border-soft`, dashed add →
  `border-2 border-dashed border-strong`; Remove visible on phones (no hover-only), 44px;
  forms → P5; `KidHeaderActions` → `buttonVariants`; `AddKidAffordance.tsx:50` `<a href>` → `Link`.
- **Savings** (index, new, detail, edit, invite, accept-invite): P6 + back; `GoalCard` →
  `Card tone="chrome"` + `ProgressBar`; `ProgressBlock` → black panel like `ResultCard`, tabular;
  ActionPills → PILL; header Edit/Pause → outline, drop the duplicate Invite; `GoalForm` toggles →
  PILL / 2px-in-both-states cards; every hand-rolled button → `buttonVariants`; `GoalCardMenu` →
  `Menu` (raise the open card's z-index); confirms → `useConfirm`; avatars → `Avatar`; status chips
  only for non-default states (no orange Badge on every active goal); empty states → `EmptyState
  dashed`; on a phone the Yes panel sits above Members; accept-invite = chrome card + outline buttons.
- **The Boss:** P6 + back; suggestion chips → `PILL_WRAP` (they overflow the chat column today);
  textarea → P5 (16px, 44px); `RecommendationCard` / `GuideCard` / `SourceList` / `ResearchedList`
  → `Card`, whole-card links, `font-extrabold` titles, `text-accent-text` links; PastChats delete →
  `useConfirm`; `dvh` not `vh`.
- **Goals + Today** (`/goals`, `/goals/[id]`, `/today`, `components/goals/*`): P6; round status pills
  → `Badge`; tints out; `ProgressBar`; buttons → `buttonVariants`.

**Walkthrough:** `/tools` signed out and signed in (the launcher tiles are black); run every
calculator on the phone — the result panel is there before the first number, inputs don't zoom,
toggles are square; open a savings goal, log a contribution, open the card menu; ask the Boss
from the suggestion chips.

### Phase 8 — Account, profile, messaging
- **One account anatomy:** P6 header with `back` to `/account`; container
  `max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12` on every page; sections `Card tone="surface" p-6`
  led by `Eyebrow`; P5 fields; `buttonVariants` only (primary save, outline cancel, danger destroy);
  `EmptyState panel` / `dashed`; the danger zone is the last card, on danger tokens. Base files:
  `connections/page.tsx` (header + container), `settings/page.tsx` (sections).
- `/account` hub: a destination strip at the top (Settings, Contacts, Messages, Notifications —
  `ChevronRightIcon` rows; Settings is a bottom-of-page text link today); kids section tone surface;
  chips → `Badge`.
- Settings: identity block → `Card tone="sunken"`; `AvatarUploader` → `Avatar` + `buttonVariants`;
  `ImageCropper` → a `data-theme="dark"` zone so its buttons come from tokens, error strip on danger
  tokens; `AccountDeletion` → danger tokens + `Button danger` + P5 (11 raw red classes today);
  `EditEmailForm` / `EditUsernameForm` / `BioForm` → P5 + 44px actions; toggles → `Switch`.
- Connections + `MemberSearch`: `Act` / `ConnectForm` → `buttonVariants` (Block = danger), one size
  per row; `Avatar`; peach tint out; the inline sign-in → redirect like the sibling pages.
- Messages list: unread fill + `CountBadge`, `Avatar`, `EmptyState`.
- **Thread:** bubbles on the `BossChat` recipe (§3); timestamps ≥AA; back control via `BackLink`
  (a ~20px `←` today on a route with the bottom nav hidden); an `sr-only` H1; options →
  `IconButton` + `Menu`; report dialog → `Modal`; reaction chips 44px square; attach 44px; toast →
  `Notice`.
- `blocked`: nested `<main>` → `<div>`; P6.
- `author/[username]`: H1 onto the lockup; guides rows reuse the review-row recipe. Portrait stays square.

**Walkthrough:** from the account menu visit every destination on the phone — same header, same
column, same panels; edit the bio, change the avatar (cropper), send a DM and react to one; delete
flow stops at the confirm.

### Phase 9 — Off-site brand surfaces
- **Share cards** (`app/api/og/route.tsx`, `app/api/og/weekends/route.tsx`): white wordmark (match
  the masthead), a 4px orange rule, CTA + type tags square 4px (not `borderRadius: 100px`),
  uppercase tracked. Arial stays (brand font in Satori was skipped on purpose). Bump
  `OG_TEMPLATE_VERSION` **once** — a genuine design change is the sanctioned reason; never bump it
  to "flush X". Verify with `Invoke-WebRequest localhost:3000/api/og` per the social-preview memory.
- **Emails** (`emails/_components/EmailLayout.tsx` + 14 templates), per D2: palette constant `C`
  rewritten; masthead strip + 4px rule; 4px radii; black uppercase button; unsubscribe links carry
  the B7 token; `List-Unsubscribe` headers on the digest. Test-send every template to the
  operator inbox (Gmail on Android) before commit — via an existing preview route if one exists,
  else a one-off script under `scripts/`.

**Walkthrough:** share a review link into a chat on the phone — the card shows the white
wordmark and square tags; open the test emails in Gmail on the phone — light body, black
masthead, the "Unsubscribe" link appears in Gmail's header.

---

## 7. Phase 10 — Guard strict + docs

- Baseline empty → `check:hard-goods` strict in `prebuild` + the pre-commit guard set.
- `docs/brand-guide.md`: §2 — the overlay recipe (`border-prose`) replaces the contradictory
  "menus keep border-soft" (line 297/598) vs "border-strong for menu edges" (line 310); the
  block/chip ink split written once as a rule (it's implied today across §2 and §6). §4 — the
  `Switch` track as the one sanctioned pill control. §6 — the new primitives (Menu, MenuTabs,
  IconButton, CountBadge, Field, QtyStepper, useConfirm, Avatar, Segmented, PILL_WRAP,
  NewsletterSignup variants, ToolCard, RouteError, Notice, Switch, ProgressBar, PageHeader
  compact). §8 — app-page anatomy (account / tools / commerce). §9 — file reference.
- `CLAUDE.md` Design System: one line on the app-page anatomy and `check:hard-goods`.
- Brief §6: one roadmap line.

---

## 8. Execution

- **Model per memory (`feedback_skills_to_invoke`):** the main session builds the Phase 1
  primitives itself (design-critical) and writes each phase's spec; Sonnet subagents migrate call
  sites with **disjoint file sets**; the main session re-runs all gates in ONE call
  (`npm run check && npm test && npm run prebuild`) before reporting.
- **No Playwright** unless he grants it — he walks each phase on the phone (Samsung, Chrome).
  **He commits.** Migrations: he applies them (B8's unique index).
- **Sessions** (one focused block each; start by reading only that block):
  1. Phase 1 + Phase 2 — primitives, the bugs, the launch screen; the guard baseline is generated
     LAST, then armed. **Built 2026-10-14** (P1–P18, B1–B13; mig 163 applied). Deliberately left
     for their phases: the 9 `error.tsx` → `RouteError` (Phase 5), `EmailSignup` callers (merch →
     Phase 4/6), call-site adoption of the new `LABELS` nouns (Phases 3/8). B7 needs the
     `NEWSLETTER_UNSUBSCRIBE_SECRET` env var on Vercel — unsigned links + no one-click header until set.
  2. Phases 3–5 — chrome & menus, signups, reader leftovers + auth. **Built 2026-10-14**
     (baseline 162 → 118). Follow-ups found, not yet done: `/tools/email-unsubscribe` still
     unsubscribes on GET (B7's bug class, tool emails); `weekends-until/_components/Result.tsx`
     `border-faint` (Phase 7); `CommentList` row now mixes the 44px like chip with small text links
     (Phase 8); `OffTheBench` card body (hover lift, tint stub) untouched; no `BellIcon`/`UserIcon`
     in `components/icons.tsx` (inline SVGs remain in the menus).
     **Walkthrough flags (judgment calls to confirm on the phone):** cart icon now always shows
     at md+ (badge only when >0) — if the 768px header crowds, `CartIcon.tsx` `max-md:hidden` →
     `max-lg:hidden`; logged-out "Join free" stays 36px (`sm`) to keep md narrow; `app/error.tsx`
     H1 is now "Something went wrong" (was "Unexpected error" — `title=` restores it); LikeButton
     dropped the "Like"→"Liked" label flip and heart scale (state = fill + filled icon); gallery
     swipe works anywhere on screen; `/account/notifications` kept its own H1 (no compact
     PageHeader — the only honest eyebrow repeated "Account"); auth H1s "Welcome back, Boss" /
     "Join the Crew" / "Reset your password" / "Set new password" (`LABELS.auth`); /gifts hub
     card is now notify-intent ("Notify me", tag `notify:gifts:season`); shop launch tag is
     `notify:shop:launch` (admin stat counts both); `Switch` has no `aria-describedby` and
     `PageHeader` `deck` is string-only (helper text lives in the body).
  3. Phases 6–7 — commerce, tools. **Built 2026-10-14** (baseline 118 → 81; gates green, 724 tests).
     Phase 6 complete incl. `MerchImageGallery` (IconButton chevrons, BagIcon, Badge); shipping
     "Free" is one constant (`shop/_lib/shipping.ts`, true — checkout adds no shipping); order
     lookup failure → `RouteError` via `OrderLookupError` (Sentry event on junk ids). Phase 7:
     hub, Dad Math, Milestones, NumberField, ToolTiles, family, savings, the Boss, goals index/detail,
     /today. **Not done:** goals sub-routes (new/edit/share/invite/shared), savings
     `CatchUpPanel` (1px warn box), `MyDestinationPanel`, `NotificationsPanel`,
     `ContributionButton/Log`, family `SectionHeader` cards, `/tools/email-unsubscribe` GET bug.
     **Walkthrough flags:** back-link parent for /goals + /today = Tools; hub 6-col calculator grid at
     tablet; Dad Math verdict Badge dropped; savings delete-goal still uses a typed `prompt`; family
     avatar only from sm up; cart qty "−" stops at 1 (Remove is the only delete).
  4. Phases 8–10 — account & messaging, share cards + emails, guard strict + docs.
- Rough size: ~180 files across all phases (Phase 7 is the largest, ~45).

---

## 9. Checked and not a bug — don't "fix"

- Author portraits are square on purpose (AuthorBio, Hard Goods); member avatars are round.
- The dark dashboard is a deliberate zone (and out of scope).
- Orange chips, score chips, the zone primary button, count badges and avatar initials carry
  white ink — the approved mockup did (`build.mjs` `.sq`, `.chip.hot`, `.tool .btn`). Only
  *body* text on orange is the defect.
- `AskBossFab` is an orange 56px square with a white icon — a button, not a block; it stays.
- The home-screen tile, maskable icon and favicon are dark tiles — the brand edge, not a canvas.
- `color-scheme` is already split correctly (`light` on `:root`, `dark` inside zones) — native
  date pickers and scrollbars follow the page.
- The `CredibilityBreak` "tint" hit was a code comment.
- Android Chrome doesn't zoom on <16px inputs; iPhone Safari does — P5 fixes it for both anyway.
- Large orange numerals (`text-accent` at display sizes, score rings) pass as large text / non-text.
