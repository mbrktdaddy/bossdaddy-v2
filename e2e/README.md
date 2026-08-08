# e2e — the browser pass

Playwright against a **running dev server** and the **real Supabase project**. This
is not part of `npm run build`, `npm run check`, or CI: it writes rows.

Everything is `.mjs` on purpose, so `tsc --noEmit` and the prebuild guards never
see it.

## Running it

```powershell
cd C:\Users\msb1c\bossdaddy-v2
npm run dev                       # terminal 1
npm run e2e:accounts              # once — two confirmed throwaway users
npm run test:e2e                  # terminal 2
```

Mobile is the source of truth here, so `playwright.config.mjs` has exactly one
project: Pixel 5, 393×851, Chrome-on-Android UA, touch on.

## The accounts

`bd-verify-a@example.com` (owner) and `bd-verify-b@example.com` (partner), created
straight through the admin API with `email_confirm: true` so nothing waits on a
mailbox. They are **real rows in production**.

```powershell
npm run e2e:accounts -- --clean      # drop the "E2E …" goals, keep the users
npm run e2e:accounts -- --teardown   # delete both users (cascades everything)
```

## What it covers

1. The sensitive-share trigger — witness without the acknowledgement is refused, with
   it succeeds, and promoting a cheer partner afterwards without it is refused too
   (the trigger fires on UPDATE, and that's the bypass worth guarding).
2. Invite → sign in → accept → step out, across two browser contexts, including that
   the invite token survives the trip through `/login`.
3. `/today` — the number input, **Log it**, **Not today**, and the rows disappearing.
4. `/goals/new` template prefill and the votes line.
5. The `.ics` feed's bytes: CRLF, the 75-**octet** fold, no U+FFFD, `TZID` on every
   `DTSTART`, and UIDs stable across two polls. **A real calendar client is still not
   covered** — subscribing in Google Calendar is a manual step.
6. The tier boundary actually moving: cheer gets no per-day calendar and never the
   identity statement; promoting to witness turns the calendar on.
7. No horizontal overflow on any goals surface at 393px.

`inspect.mjs` is an ad-hoc peek at one goal's schedules, occurrences and entries:

```powershell
node --env-file=.env.local e2e/inspect.mjs <goalId>
```
