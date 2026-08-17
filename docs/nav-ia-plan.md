# Navigation & information architecture — one sequence

**Status:** planned, no code. Written 2026-08-15 after an operator review of the goals
surfaces ("almost like I am on a completely different website").

**What this fixes.** Not styling. Two structural problems and the redundancies they
produce:

1. **Two chromes for one class of page.** `/account/*` is as private as `/goals`, and it
   lives in `(public)` with the full site Header, bottom nav and footer. `/goals`,
   `/today` and `/tools` live in `(tools)` with a bespoke minimal header and **no bottom
   nav**. The split is not public-vs-private — it is historical
   (`docs/dad-tools-plan.md` §5 designed tools as a standalone mini-app before
   `/account` existed). Walking Your Stuff → Goals swaps the entire chrome and drops
   the only way to navigate out.
2. **State was put in the nav.** "Today" is not a place, it is a condition — what is
   unresolved right now. It was added to the tools chrome as a link (this session) and
   that is the wrong instrument; a nav bar answers "where can I go".

> **THE PRINCIPLE: nav is for places, cards are for state.**
> One `TodayCard`, several placements. The chrome goes back to destinations.

---

## What is verified, so nobody "consolidates" the wrong thing

| Suspicion | Reality |
|---|---|
| `/account/blocked` duplicates `/account/connections` | **No.** `/account/blocked` is the *"Your account is on hold"* suspension notice. The blocked-CONTACTS list correctly lives inside `/account/connections`. Different concepts, similar names. |
| `/account/settings` duplicates the working-on list | **No.** Settings is Profile + Account only. `WorkingOnSection` renders on `/account`. (An older memory claimed otherwise; it was stale.) |
| The bell and Today do the same job | **No.** Notifications are an EVENT LOG — something happened, possibly by someone else, and a reminder you already tapped still sits there. Today is a WORK QUEUE — unresolved, yours, actionable. Never merge them, and never make the bell the way work is found. |
| The homepage could carry a Today card | **Ruled out by the operator.** Home stays static, no auth read, no added JS. It is the most LCP-sensitive page and has open bundle work. |

---

## The sequence

Five phases. A and B are small and independent; C is the one with real risk; D and E
are the deeper merges. Each phase ends green on `npm run check` + `npm test` +
`npm run prebuild`, and each is separately shippable.

### Phase A — undo what shouldn't exist

The nav links added to the tools chrome this session are removed. They were the wrong
instrument and they are what pushed the mobile header into a collision.

- `app/(tools)/layout.tsx` — drop the `Today` and `Goals` links.
- **Restore the "BOSS DADDY" wordmark at all widths.** It was hidden below `sm` only to
  buy back ~130px for those links. With the links gone the row is icon + wordmark +
  bell + avatar ≈ 265px in ~361px of usable width at 393px, which fits. The brand
  lockup should not pay for a mistake that has been reverted.
- **Keep** the `AccountMenu` fix (`@username` is `hidden sm:inline`). That one is correct
  on its own merits: the trigger ran ~180px, and the panel it opens already leads with
  the handle. Avatar + chevron is what every app chrome does on a phone.

Net effect: chrome returns to its pre-session state, plus one genuine bug fix.

### Phase B — one `TodayCard`, three placements

- **`lib/goals/today.ts`** — extract the open-work query that currently lives inline in
  `app/(tools)/today/page.tsx` into `loadTodayWork(client, userId)`. The card and the
  page then read the same function, so a card can never disagree with the page it links
  to. This is the same anti-drift move as `lib/goals/revalidate.ts`.
- **`components/goals/TodayCard.tsx`** — a Server Component. Shows the count due now,
  the next item's title, and a CTA into `/today`. **Always renders, never gated on a
  count** — the old `/goals` panel was hidden when nothing was due, which removed the
  only entrance at exactly the moment a man wants the reassurance of a clear day. Quiet
  styling when clear (`border-soft bg-surface`), raised when something is waiting.
- Placements: **`/goals`** (replaces the existing panel), **`/tools`** (above the
  spokes — the front door currently has zero personalization), **`/account`** (above
  `WorkingOnSection`, which lists what you're working on but never what's due).
- **NOT the homepage.** Operator decision, recorded above.
- Deferred decision, called out rather than assumed: whether the card logs inline (a
  form posting the same Server Action) or only links through. Inline saves a navigation
  and `revalidateGoal` already covers the paths — but it puts medication logging on a
  settings-adjacent page. v1 links through.

### Phase C — one chrome for every authenticated surface (shipped 2026-08-17)

**Done via option (i).** `tools/`, `goals/` and `today/` moved into `(public)/` and
`app/(tools)/layout.tsx` is deleted; the group no longer exists. 21 pages, URLs unchanged.

**The four gates, resolved:**

1. **`data-theme="dark"`** — clear. `app/layout.tsx:137` sets it on `<html>`, so the
   deleted wrapper `div` was redundant. Nothing lost.
2. **What `Header` assumes** — nothing that breaks; `/account/*` already proved it over a
   private surface, and `PublicMain` adds the `pb-14 md:pb-0` bottom-nav clearance those
   pages now need.
3. **`HideOnImmersive` / `isImmersiveRoute`** — only DM threads match, so no goals or
   tools page hides the strip. Checked specifically that nothing under `/tools/the-boss`
   pins a composer to the bottom, which is the case that would have needed the immersive
   list extended.
4. **`alwaysShow`** — dropped from `AccountMenu` entirely; the deleted chrome was its only
   caller.

**One trap found, and it cost a round trip:** `AccountMenu` renders `ActivityMenu`
**outside** its own `hidden md:block` wrapper, so the bell has always shown at every
width while the avatar trigger is desktop-only. Adding a "mobile bell" to `Header` to
compensate for the lost `alwaysShow` therefore rendered **two bells**. There is now a
warning at both sites. The asymmetry is correct: a drawer can repeat a link, not a badge.

**Also updated:** `scripts/check-og-coverage.mjs` `GROUPS` is `['(public)']` — its ALLOW
patterns match PATHS, not groups, so every private-page exemption survived the move
untouched (37 pages still covered). Stale `app/(tools)/…` paths in five `lib/` comments
were repointed.

**Left for its own pass:** the bottom nav's tab set was changed with this (see Phase G),
and the Ask FAB remains desktop-only with the mobile center slot as its counterpart.

<details>
<summary>Original plan for Phase C, kept for the reasoning</summary>

The fix for "different website". Two ways to do it:

- **(i) RECOMMENDED — one layout.** Move `tools/`, `goals/`, `today/` into `(public)/`
  and delete `app/(tools)/layout.tsx`. URLs are unchanged (route groups add no path
  segment). Relative imports inside the tree (`../actions`) survive because the whole
  tree moves together.
- **(ii) Fallback — keep the group, swap its layout** to render `Header` +
  `MobileBottomNav` + `Footer`. Smaller diff, but it leaves two layout files that must
  stay identical, which is the exact drift that produced this problem.

**Checks before the move, in this order:**

1. **`data-theme="dark"`.** `(tools)/layout.tsx` sets it on its own wrapper div. If the
   root layout does not set it on `<html>`, moving these pages out of that wrapper loses
   the dark theme entirely. CLAUDE.md says it belongs on `<html>` — verify, don't assume.
2. **What `Header` assumes.** Editorial nav, search, category menus — confirm nothing in
   it breaks or looks absurd over `/goals`. `/account/*` already proves the Header works
   over a private surface.
3. **`HideOnImmersive`** wraps the footer in `(public)`; confirm the behaviour it exists
   for doesn't now apply to goals pages.
4. **`alwaysShow`** can be dropped from `AccountMenu` once a drawer exists again — but
   only if the Header's drawer really does repeat the links at narrow widths.

**Known consequence to decide in Phase E, not here:** the bottom nav is Home / Reviews /
Guides / Gear + an Ask-the-Boss FAB. A signed-in dad logging a taper will have four
editorial tabs at his thumb. That is not worse than today (he currently has *no* bottom
nav), so it ships as-is and gets revisited.

</details>

### Phase G — the mobile tab set (shipped 2026-08-17)

Phase C gave the goals spine a bottom nav for the first time; it pointed at four reading
surfaces and had no entry to Tools at all. **Operator's call, and the reasoning is his:**

- **Five slots, not six.** Six is crowded at 393px, and the elevated Ask FAB has to sit
  dead centre — an even tab count can't give it that. So a tab had to yield.
- **Home yielded.** The wordmark in the header goes home from every page, so the tab was
  the one item on the strip whose job was already done elsewhere. **Gear and Ask were
  explicitly protected** — neither is negotiable.
- **Order: Reviews · Guides · [Ask] · Tools · Gear.** Reading on the left, doing and
  shopping on the right, the concierge in the middle.

`match` was added to the tab shape for the one tab that owns more than its own subtree:
Tools lights up across `/tools`, `/goals` and `/today` but **not** `/tools/the-boss`,
which belongs to the Ask slot — otherwise two things light up for one page. The label
reads from `LABELS.tools.short`, so the paused Vault/Keep rename lands here for free.

Icon is a toolbox drawn from a rect + a handle + a clasp, not a traced wrench — the same
call the launcher tiles made, because at 20px a multi-path wrench turns to mush.

### Phase D — one signed-in home

> **The rule that settled it, from the operator:** *management stays on `/account`;
> state and work move to `/tools`.* Contacts is managing people, Family is managing
> family — both stay. "What you're working on" and "In your corner" are live state
> about goals — both move. That one line decides every section on both pages, and it's
> sharper than the "what you can use vs what you have" framing this phase started with.

`/tools` lists *what you can use*; `/account` ("Your Stuff") lists *what you have*. Two
half-built front doors, and the user has to know which to pick.

- **`/tools` becomes the signed-in home**: `TodayCard`, then your active stuff, then the
  tool shelf. `MyKidsSection`, `WorkingOnSection` and `YourCornerSection` move here.
- **`/account/*` reduces to account management**: profile, settings, connections,
  notifications. Its `AccountMenu` label changes from "Your Stuff" to "Account"
  (`lib/labels.ts`).
- **NO RENAMING OF ROUTES IN THIS PHASE.** There is a paused decision about the tools
  naming ("Vault" vs "The Keep") that says ask the operator first. This phase re-scopes
  what a page contains; it does not touch a URL.

### Phase E — the remaining merges

- **`/goals/shared` folds into `/goals`** as a second group ("Yours" / "In their
  corner"). Both pages list goals, and the shared list is currently behind a conditional
  link, so it can go missing entirely.
- **Bottom-nav tabs for signed-in users** — revisit after C has settled.
- **Separate pass, not this plan:** the public content side has six collection-ish
  surfaces (`/bench`, `/vault`, `/picks`, `/stacks`, `/comparisons`, `/gifts`). Same
  smell, different domain, and `/vault` is inside the paused rename decision.

### Phase F — where the card sits, and what `/account` is for (shipped 2026-08-17)

Phase B put one `TodayCard` on three pages and Phase D made `/tools` the signed-in home.
Reviewing the result with the operator surfaced that the placements had drifted from both
decisions, and that D's own rename never happened.

**What was wrong**

1. **`/tools` buried the day.** Order was hero → launcher → PWA banner → family rows →
   *then* the card. On a 393px phone with two kids, "3 things waiting on you" started
   ~700px down — under an install advert, on the page whose whole job is answering "what
   now".
2. **`/goals` stated "what's open" twice, from two sources.** The full card previews the
   next four items while every goal row below carries its own `Due` / `N open` badge and
   today's target — and the card counts **live occurrences** where the badges read
   **`goal_stats`**, which is only as fresh as the last sweep tick.
3. **`/account` contradicted its own stated rule.** The page comment says *"management
   lives here; state and work live on /tools"*, then kept the card as a self-declared
   exception. Three identical cards pointing at one door; a card that appears everywhere
   is read nowhere.
4. **"Your Stuff" was hardcoded in four places** — `AccountMenu`, the `Header` drawer, the
   H1 and the metadata — with no `account` block in `lib/labels.ts` at all. Phase D
   specified this rename and it never shipped.

**What shipped**

- **`/tools`** — the card leads the page, launcher second, `InstallPWA` moved below the
  personalized stack (signed-out keeps it high; it's one `installCta` binding rendered in
  one of two places). **Card-first even when the day is clear** — the quiet state is
  reassurance, and reordering by state would mean preloading the query just to learn the
  tone.
- **`/goals`** — `<TodayCard variant="compact">`: verdict, week strip, CTA. No preview
  rows. **One number per page**; on a page whose unit is the goal, the row badges own it.
  The week strip survives because a list of goals cannot show it.
- **`/account`** — card off. Sections reordered to family → people → saved → activity.
- **`lib/labels.ts`** — new `account` block; all four call sites read from it.

**Decisions recorded, so they don't get re-opened**

- **`/account` is NOT renamed to "Profile".** A profile is what other people see — the
  `display_name` / `tagline` / `bio` / avatar fields that feed member search, which live
  on `/account/settings`. This page is the opposite: family, contacts, saved links, none
  of it readable by anyone else. `/dashboard/profile` already owns the word for authors.
- **`/account` is NOT folded into `/account/settings`.** Wrong direction: `/account` is
  the shorter URL, it's what `proxy.ts`'s auth guard and the avatar menu point at, and
  `/account/settings` is linked from `NewMessageEmail` and `WishlistStatusEmail` — folding
  the good URL into the longer one buys a 301 and worse addresses. The split that stands
  is **`/account` = what you have, `/account/settings` = what you configure**, which is
  the Facebook/LinkedIn/GitHub split the page was built on.
- **Cards never log inline.** Closes the deferred question in Phase B. `/today` is the
  only surface that resolves work; two surfaces that both log is how "did that save?"
  starts, and it would put medication logging on a settings-adjacent page.

**Still open after F**

- **Fold the settings FORM sections up into `/account`?** Only worth it if `/account`
  stays thin. Revisit when either saved list outgrows a screen — at which point `Saved`
  (liked reviews + guides, Bench follows) probably wants to be its own `/account/saved`
  rather than two cards on a hub.
- **The Activity tile** (Comments Left / Likes Given) is the least useful thing on
  `/account`. Kept — it's your own record, not a public scale metric — but it is the
  first thing to cut if the page needs room.
- **`/today` row density** — the reason this review started. Multiple open occurrences
  each render a full ~200px card with a form, and a twice-daily medication goal renders as
  two or three near-identical cards. Two changes are agreed in principle and NOT built:
  **group by goal** (one row, a time chip per slot, each chip its own submit) and **hide
  the number field behind a disclosure** (it defaults to `target_value`, so the fast path
  is already one tap). The row-shape choice — compact rows vs first-expanded — is
  undecided. Constraint: `/today` has **no client JS** (plain forms + the inert
  `OfflineLogQueue` island); chips-as-submits and `<details>` preserve that, a
  state-driven accordion would not.

---

---

## Next session

Phases A, B, D shipped 2026-08-15 (`c636c11`, `79a0cce`, `bbc7a20`, `1348606`);
F shipped 2026-08-17. What's left, in the order I'd take it:

### 1. Phase C — unify the chrome (the one that matters)

The "different website" feeling is still there. Full detail above; the gate is unchanged
and must be checked FIRST: **`(tools)/layout.tsx` sets `data-theme="dark"` on its own
wrapper div.** If the root layout doesn't set it on `<html>`, moving those pages out of
that wrapper loses the dark theme on every one of them. CLAUDE.md says it belongs on
`<html>` — verify, don't assume.

### 2. Phase E — `/goals/shared` folds into `/goals`

Two pages that both list goals; the shared one hides behind a conditional link.

### 3. DECIDE: does the URL follow the name? — `/tools/weekends-until` → ?

The tool is called **Milestones** as of `bbc7a20`. The label changed; the route did not.
That was the right default (internal names are permanent, display labels are free) but it
leaves a mismatch anyone reading a URL or sharing a link will see. **This is a decision
to make deliberately, not a leftover.**

**Measured scope:** 21 references to `tools/weekends-until` across 15 code files, plus
`docs/dad-tools-plan.md`.

| Option | Cost | Risk |
|---|---|---|
| **Leave it** | none | permanent name/URL mismatch, visible in the address bar and in every shared link |
| **Rename to `/tools/milestones` + 301** | move the directory, a redirect in `proxy.ts`, update 21 call sites | low IF the redirect lands in the same commit |
| Rename with no redirect | — | **reject.** Breaks live links, splits the OG cache, and 404s the emails below |

**The thing that makes the redirect non-optional:**
`app/api/cron/yearly-weekends-checkin/route.ts` emails a link into this tool, so the old
URL is already sitting in people's inboxes — and OG cards are immutable-cached for up to
a year per POP. A rename without a 301 breaks both.

**Sub-decisions if we rename:**
- `/api/og/weekends` — rename to match, or leave? It's an internal image path nobody
  reads. Renaming it changes every card URL (fresh renders, cold caches) and must keep
  `check:og` green. Leaving it is invisible to users and cheaper.
- The directory `app/(tools)/tools/weekends-until/_components/` and the
  `LABELS.tools.weekendsUntil` KEY both stay regardless — those are internal names.
- Is "milestones" too generic for a URL, given it could collide with a future content
  type? Worth ten seconds of thought before committing to it.

---

## Explicitly not merging, and why

- **`/goals/[id]/share` stays a page.** It carries consent language and tier
  explanations, and it is where somebody hands another person access to medication logs.
  That must not become a cramped modal on a phone.
- **`/goals/[id]/edit` stays a page.** It doesn't need merging; it needs the value-row
  treatment (`Repeat — Weekdays ›`) from the goals metrics plan.
- **The bell dropdown AND `/account/notifications` both stay.** Peek versus history is a
  standard pair.
- **`/today` stays a real route even after it leaves the IA.** Reminder emails, the PWA
  long-press shortcut and the one-tap `/g/[token]` flow all land there. It stops being a
  place you navigate *to*; it does not stop existing.

## Invariants

1. **Nav is for places, cards are for state.**
2. **One layout for authenticated surfaces.** A second chrome will drift; that is how
   this started.
3. **The homepage takes no auth read and no new JS.**
4. **Notifications are events; Today is a work queue.** Two systems, two jobs.
5. **Any new surface rendering goal state must be added to `lib/goals/revalidate.ts`** —
   it is the one list, and a mutation that doesn't revalidate a surface makes edits look
   like they didn't save.
6. **No route renames** while the tools naming decision is paused.
7. **One number per page.** If two components on one screen can both claim "what's open",
   one of them is wrong — and they will disagree, because live occurrences and
   `goal_stats` have different freshness. Decide which owns it by the page's unit.
8. **`/tools` is the signed-in home.** The day leads it. Nothing gets inserted above the
   `TodayCard` — not a launcher, not a promo.
