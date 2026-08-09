// The browser pass the goals spine never got. Ordered highest-risk first, exactly
// as the debt note lists them:
//
//   1. the sensitive-share trigger (invite + promote)
//   2. invite → accept → leave, two accounts, token surviving sign-in
//   3. /today — the number input, both buttons, and the row disappearing
//   4. /goals/new prefill and the votes line
//   5. the .ics feed's bytes (a real calendar client is still the operator's job)
//
// Serial and single-worker: these share one goal against the real database.

import { test, expect } from '@playwright/test'

const A = { email: 'bd-verify-a@example.com', password: 'VerifyPass!A1' }
const B = { email: 'bd-verify-b@example.com', password: 'VerifyPass!B1' }

/** Carried between steps. */
const state = {
  goalId: null, cheerToken: null, witnessToken: null, calendarUrl: null,
  loggedGoalId: null, skippedGoalId: null,
}

async function signIn(page, acct) {
  await page.getByLabel('Email').fill(acct.email)
  await page.getByLabel('Password').fill(acct.password)
  await page.getByRole('button', { name: /sign in/i }).click()
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 })
}

async function signInVia(page, acct, path = '/goals') {
  await page.goto(`/login?next=${encodeURIComponent(path)}`)
  await signIn(page, acct)
}

/** The invite form on /goals/[id]/share, scoped so the per-partner forms don't match. */
const inviteForm = (page) => page.locator('form:has(input[name="op"][value="invite"])')

/** A quit-smoking taper whose reminder time is `minsAgo` in the past, so it's due now. */
async function createTaper(page, tag, minsAgo) {
  const past = new Date(Math.max(Date.now() - minsAgo * 60_000, new Date().setHours(0, 5, 0, 0)))
  const hhmm = `${String(past.getHours()).padStart(2, '0')}:${String(past.getMinutes()).padStart(2, '0')}`
  await page.goto('/goals/new?t=quit-smoking-taper')
  await page.locator('input[name="title"]').fill(`E2E ${tag} ${Date.now().toString().slice(-6)}`)
  await page.locator('input[name="localTime"]').fill(hhmm)
  await page.getByRole('button', { name: /start|create|save|begin/i }).last().click()
  await page.waitForURL(/\/goals\/[0-9a-f-]{36}/, { timeout: 30_000 })
  const id = page.url().match(/\/goals\/([0-9a-f-]{36})/)[1]
  console.log(`   ${tag} goal ${id} @ ${hhmm}`)
  return id
}

test.describe.serial('goals spine — browser pass', () => {
  // ──────────────────────────────────────────────────────────────────────────
  // 4a. Template prefill (does the setup for everything below, so it runs first)
  // ──────────────────────────────────────────────────────────────────────────
  test('/goals/new → Quit smoking prefills the taper', async ({ page }) => {
    await signInVia(page, A, '/goals/new')
    await page.goto('/goals/new')

    const shelfLink = page.locator('a[href="/goals/new?t=quit-smoking-taper"]')
    await expect(shelfLink, 'the quit-smoking card should be on the shelf').toHaveCount(1)
    await shelfLink.click()
    await page.waitForURL(/\/goals\/new\?t=quit-smoking-taper/)

    await expect(page.locator('input[name="baseline"]')).toHaveValue('20')
    await expect(page.locator('input[name="target"]')).toHaveValue('0')
    await expect(page.locator('input[name="stepDays"]')).toHaveValue('7')
    await expect(page.locator('input[name="weeks"]')).toHaveValue('8')
    await expect(page.locator('input[name="localTime"]')).toHaveValue('20:00')

    const identity = await page.locator('[name="identityStatement"]').inputValue()
    expect(identity.trim(), 'identity statement should be prefilled').not.toBe('')
    console.log('   identity prefill:', JSON.stringify(identity))

    // Unique title so re-runs don't collide with an earlier pass.
    const title = `E2E quit smoking ${Date.now().toString().slice(-6)}`
    await page.locator('input[name="title"]').fill(title)

    await page.getByRole('button', { name: /start|create|save|begin/i }).last().click()
    await page.waitForURL(/\/goals\/[0-9a-f-]{36}/, { timeout: 30_000 })
    state.goalId = page.url().match(/\/goals\/([0-9a-f-]{36})/)[1]
    console.log('   created goal:', state.goalId)
  })

  // ──────────────────────────────────────────────────────────────────────────
  // 1. The sensitive-share trigger
  // ──────────────────────────────────────────────────────────────────────────
  test('witness WITHOUT the acknowledgement is refused', async ({ page }) => {
    await signInVia(page, A, `/goals/${state.goalId}/share`)
    await page.goto(`/goals/${state.goalId}/share`)

    const ack = inviteForm(page).locator('input[name="sensitiveAck"]')
    await expect(ack, 'the ack checkbox must render on a sensitive goal').toHaveCount(1)
    await expect(ack).not.toBeChecked()

    await inviteForm(page).locator('input[name="tier"][value="witness"]').check()
    await inviteForm(page).getByRole('button', { name: /send the invite/i }).click()
    await page.waitForURL(/\/share/)

    expect(page.url(), 'refusal should NOT mint a token').not.toContain('token=')
    await expect(page.getByText(/sensitive/i).first()).toBeVisible()
    console.log('   refusal msg:', new URL(page.url()).searchParams.get('msg'))
  })

  test('witness WITH the acknowledgement succeeds', async ({ page }) => {
    await page.goto(`/goals/${state.goalId}/share`)
    await signInVia(page, A, `/goals/${state.goalId}/share`)
    await page.goto(`/goals/${state.goalId}/share`)

    await inviteForm(page).locator('input[name="tier"][value="witness"]').check()
    await inviteForm(page).locator('input[name="sensitiveAck"]').check()
    await inviteForm(page).getByRole('button', { name: /send the invite/i }).click()
    await page.waitForURL(/token=/, { timeout: 15_000 })

    state.witnessToken = new URL(page.url()).searchParams.get('token')
    expect(state.witnessToken).toBeTruthy()
    await expect(page.getByText(/invite ready/i)).toBeVisible()
  })

  test('a cheer invite needs no acknowledgement', async ({ page }) => {
    await signInVia(page, A, `/goals/${state.goalId}/share`)
    await page.goto(`/goals/${state.goalId}/share`)

    await inviteForm(page).locator('input[name="tier"][value="cheer"]').check()
    await inviteForm(page).getByRole('button', { name: /send the invite/i }).click()
    await page.waitForURL(/token=/, { timeout: 15_000 })

    state.cheerToken = new URL(page.url()).searchParams.get('token')
    expect(state.cheerToken).toBeTruthy()
    console.log('   cheer token:', state.cheerToken)
  })

  // ──────────────────────────────────────────────────────────────────────────
  // 2. Invite → accept → (promote attempt) → leave
  // ──────────────────────────────────────────────────────────────────────────
  test('the invite token survives sign-in and accept lands on the shared goal', async ({ browser }) => {
    const ctx = await browser.newContext()
    const page = await ctx.newPage()

    // Signed out first — the token is in the path, so this is where it can be lost.
    await page.goto(`/goals/invite/${state.cheerToken}`)
    const signInCta = page.getByRole('link', { name: /sign in to accept/i })
    await expect(signInCta, 'signed-out invite should offer sign-in').toBeVisible()
    await signInCta.click()
    await page.waitForURL(/\/login/)
    console.log('   login href:', page.url())

    await signIn(page, B)
    await expect(page, 'sign-in must return to the invite, not /goals')
      .toHaveURL(new RegExp(`/goals/invite/${state.cheerToken}`))

    await page.getByRole('button', { name: /accept|join|count me in|i'm in/i }).first().click()
    await page.waitForURL(/\/goals\/shared/, { timeout: 20_000 })
    await expect(page).toHaveURL(new RegExp(`/goals/shared/${state.goalId}`))

    await ctx.close()
  })

  test('promoting to witness afterwards WITHOUT the ack also fails', async ({ page }) => {
    await signInVia(page, A, `/goals/${state.goalId}/share`)
    await page.goto(`/goals/${state.goalId}/share`)

    const details = page.locator('details:has(input[name="op"][value="set_tier"])').first()
    await expect(details, 'the partner should be listed with a tier control').toHaveCount(1)
    await details.locator('summary').click()

    const form = details.locator('form')
    await form.locator('input[name="tier"][value="witness"]').check()
    await expect(form.locator('input[name="sensitiveAck"]')).not.toBeChecked()
    await form.getByRole('button', { name: /save/i }).click()
    await page.waitForURL(/\/share/)

    const msg = new URL(page.url()).searchParams.get('msg')
    console.log('   promote refusal msg:', msg)
    expect(msg, 'the UPDATE trigger should refuse the promotion').toBeTruthy()
    expect(msg).toMatch(/sensitive/i)

    // And the tier must actually still be cheer.
    await expect(page.getByText(/cheer him on/i).first()).toBeVisible()
  })

  test('the partner can step out, and the goal leaves /goals/shared', async ({ browser }) => {
    const ctx = await browser.newContext()
    const page = await ctx.newPage()
    await signInVia(page, B, '/goals/shared')

    await page.goto(`/goals/shared/${state.goalId}`)
    await page.getByRole('button', { name: /step out/i }).click()
    await page.waitForURL(/\/goals\/shared/)

    await page.goto('/goals/shared')
    await expect(page.locator(`a[href="/goals/shared/${state.goalId}"]`)).toHaveCount(0)
    await ctx.close()
  })

  // ──────────────────────────────────────────────────────────────────────────
  // 3. /today
  // ──────────────────────────────────────────────────────────────────────────
  test('/today: the number input, Log it, Not today, and the row disappearing', async ({ page }) => {
    await signInVia(page, A, '/goals')

    // The 20:00 goal above is correctly in "Later on" at the time this usually
    // runs, and "Later on" is links by design. To exercise the log form we need
    // occurrences whose time has already passed today — two of them, so both
    // buttons get pressed.
    state.loggedGoalId = await createTaper(page, 'log', 60)
    state.skippedGoalId = await createTaper(page, 'skip', 90)

    await page.goto('/today')

    const evening = page.locator(`a[href="/goals/${state.goalId}"]`)
    if (await evening.count()) console.log('   evening goal is in "Later on" (link, no form) — as designed')

    // ── Log it, with a number ────────────────────────────────────────────────
    const logCard = page.locator(`form:has(input[name="goalId"][value="${state.loggedGoalId}"])`).first()
    await expect(logCard, 'a passed-time occurrence should be waiting on you').toHaveCount(1)

    const number = logCard.locator('input[name="value"]')
    await expect(number, 'a taper measures something, so the number should render').toHaveCount(1)
    console.log('   number prefilled with the day target:', await number.inputValue())
    await number.fill('6')
    await logCard.getByRole('button', { name: /^log/i }).click()
    await page.waitForLoadState('networkidle')

    // ── Not today ────────────────────────────────────────────────────────────
    await page.goto('/today')
    const skipCard = page.locator(`form:has(input[name="goalId"][value="${state.skippedGoalId}"])`).first()
    await expect(skipCard).toHaveCount(1)
    await skipCard.getByRole('button', { name: /not today/i }).click()
    await page.waitForLoadState('networkidle')

    // ── both rows gone ───────────────────────────────────────────────────────
    await page.goto('/today')
    await expect(
      page.locator(`form:has(input[name="goalId"][value="${state.loggedGoalId}"])`),
      'a logged occurrence should be gone from /today',
    ).toHaveCount(0)
    await expect(
      page.locator(`form:has(input[name="goalId"][value="${state.skippedGoalId}"])`),
      'a skipped occurrence should be gone from /today',
    ).toHaveCount(0)
  })

  // ──────────────────────────────────────────────────────────────────────────
  // 4b. The votes line
  // ──────────────────────────────────────────────────────────────────────────
  test('the goal page shows the votes line after a log', async ({ page }) => {
    await signInVia(page, A, `/goals/${state.loggedGoalId}`)
    await page.goto(`/goals/${state.loggedGoalId}`)
    const votes = page.getByText(/vote(s)? toward this plan/i)
    await expect(votes).toBeVisible()
    const line = (await votes.textContent()).trim()
    console.log('   votes line:', line)
    // The template is 8 weeks, so the plan is 56 days — not 57. planDays is a
    // duration, coupled to create's `weeks * 7` span. See lib/goals/progress.ts.
    expect(line).toMatch(/Day 1 of 56\b/)
  })

  // ──────────────────────────────────────────────────────────────────────────
  // 5. The .ics feed
  // ──────────────────────────────────────────────────────────────────────────
  test('the calendar panel mints a feed and the bytes are RFC-5545 clean', async ({ page, request }) => {
    await signInVia(page, A, '/goals')
    await page.goto('/goals')

    const panel = page.locator('details#calendar')
    await expect(panel).toHaveCount(1)
    await panel.locator('summary').click()

    const makeBtn = panel.getByRole('button', { name: /make me a calendar link/i })
    if (await makeBtn.count()) {
      await makeBtn.click()
      await page.waitForURL(/\/goals/)
      await page.locator('details#calendar summary').click()
    }

    const feedText = await page.locator('details#calendar').innerText()
    const m = feedText.match(/webcal:\/\/\S+/)
    expect(m, 'the panel should show a webcal:// URL').toBeTruthy()
    state.calendarUrl = m[0]
    console.log('   feed:', state.calendarUrl)

    const httpUrl = 'http://localhost:3000' + new URL(state.calendarUrl.replace('webcal://', 'https://')).pathname
    const res = await request.get(httpUrl)
    expect(res.status()).toBe(200)
    const body = await res.text()

    expect(res.headers()['content-type']).toContain('text/calendar')
    expect(body.startsWith('BEGIN:VCALENDAR')).toBe(true)
    expect(body.includes('\r\n'), 'RFC 5545 requires CRLF').toBe(true)
    expect(/[^\r]\n/.test(body), 'no bare LF allowed').toBe(false)
    for (const line of body.split('\r\n')) {
      expect(Buffer.byteLength(line, 'utf8'), `line over 75 octets: ${line}`).toBeLessThanOrEqual(75)
    }
    expect(body).not.toContain('�')

    const dt = [...body.matchAll(/^DTSTART[^:]*:[^\r\n]*/gm)].map((x) => x[0])
    console.log('   DTSTARTs:', dt.slice(0, 3))
    expect(dt.length, 'the feed should carry at least one event').toBeGreaterThan(0)

    // ── all-day chips, not blocks on the grid ────────────────────────────────
    // Timed events made a real week view unreadable with two or three daily
    // goals. A DATE-valued DTSTART carries no TZID, and RFC 5545 §3.3.6 requires
    // a day-or-week DURATION to go with it.
    for (const line of dt) {
      expect(line, 'reminders are all-day chips now').toContain('VALUE=DATE:')
      expect(line, 'a DATE value must not carry a TZID').not.toContain('TZID')
    }
    expect(body, 'a DATE start needs a day-scale duration').toContain('DURATION:P1D')
    expect(body, 'PT15M against an all-day start is invalid').not.toContain('DURATION:PT')

    // The time moved into the title when the grid position went away.
    const summaries = [...body.matchAll(/^SUMMARY:([^\r\n]*)/gm)].map((x) => x[1])
    console.log('   summaries:', summaries.slice(0, 3))
    for (const s of summaries) {
      expect(s, 'every chip should still say what time it is for').toMatch(/·\s*\d{1,2}:\d{2}(am|pm)/)
    }

    // ── bounded ──────────────────────────────────────────────────────────────
    // These fixtures are 8-week tapers, so every rule must terminate. Unbounded
    // recurrence is what kept finished plans in the calendar forever.
    const rules = [...body.matchAll(/^RRULE:([^\r\n]*)/gm)].map((x) => x[1])
    console.log('   rules:', rules.slice(0, 3))
    for (const r of rules) {
      expect(r, 'a goal with a target date must stop').toMatch(/UNTIL=\d{8}(?!T)/)
    }

    // UIDs must be stable across polls or every refresh re-creates every event.
    const uids = (s) => [...s.matchAll(/^UID:(.*)$/gm)].map((x) => x[1]).sort()
    const second = await (await request.get(httpUrl)).text()
    expect(uids(second)).toEqual(uids(body))
    console.log('   UIDs stable across two polls:', uids(body).length)
  })

  // ──────────────────────────────────────────────────────────────────────────
  // 6. The tier boundary is a COLUMN decision — prove it actually moves
  // ──────────────────────────────────────────────────────────────────────────
  test('cheer sees no calendar and no identity; witness sees the calendar', async ({ browser, page }) => {
    // Share the goal that has a real logged day on it.
    await signInVia(page, A, `/goals/${state.loggedGoalId}/share`)
    await page.goto(`/goals/${state.loggedGoalId}/share`)
    await inviteForm(page).locator('input[name="tier"][value="cheer"]').check()
    await inviteForm(page).getByRole('button', { name: /send the invite/i }).click()
    await page.waitForURL(/token=/)
    const token = new URL(page.url()).searchParams.get('token')

    const ctx = await browser.newContext()
    const b = await ctx.newPage()
    await signInVia(b, B, `/goals/invite/${token}`)
    await b.goto(`/goals/invite/${token}`)
    await b.getByRole('button', { name: /accept|join|count me in|i'm in/i }).first().click()
    await b.waitForURL(/\/goals\/shared/)

    // ── cheer ────────────────────────────────────────────────────────────────
    // innerText comes back CSS-uppercased on the eyebrow, so match loosely.
    const atCheer = (await b.locator('body').innerText()).toLowerCase()
    expect(atCheer).toContain('cheer him on')
    expect(atCheer, 'the per-day calendar is above cheer').not.toContain('last few weeks')
    expect(atCheer, 'the identity statement must never cross the boundary')
      .not.toContain('i am becoming')

    // ── promote to witness, with the acknowledgement this time ───────────────
    await page.goto(`/goals/${state.loggedGoalId}/share`)
    const details = page.locator('details:has(input[name="op"][value="set_tier"])').first()
    await details.locator('summary').click()
    const form = details.locator('form')
    await form.locator('input[name="tier"][value="witness"]').check()
    await form.locator('input[name="sensitiveAck"]').check()
    await form.getByRole('button', { name: /save/i }).click()
    await page.waitForURL(/\/share/)
    expect(new URL(page.url()).searchParams.get('msg'), 'an acknowledged promotion should go through').toBeNull()

    // ── witness ──────────────────────────────────────────────────────────────
    await b.goto(`/goals/shared/${state.loggedGoalId}`)
    const atWitness = (await b.locator('body').innerText()).toLowerCase()
    expect(atWitness, 'witness should now get the per-day calendar').toContain('last few weeks')
    expect(atWitness, 'still no identity at witness').not.toContain('i am becoming')
    console.log('   tier boundary moves: cheer → no calendar, witness → calendar')

    await ctx.close()
  })

  // ──────────────────────────────────────────────────────────────────────────
  // 8. Getting the invite to the person it's for
  // ──────────────────────────────────────────────────────────────────────────
  test('the invite link is absolute, not a bare path', async ({ page }) => {
    await signInVia(page, A, `/goals/${state.goalId}/share`)
    await page.goto(`/goals/${state.goalId}/share`)
    await inviteForm(page).locator('input[name="tier"][value="cheer"]').check()
    await inviteForm(page).getByRole('button', { name: /send the invite/i }).click()
    await page.waitForURL(/token=/)

    const shown = await page.locator('body').innerText()
    const link = shown.match(/https?:\/\/\S+\/goals\/invite\/\S+/)
    expect(link, 'a bare "/goals/invite/…" is dead the moment it leaves the app').toBeTruthy()
    console.log('   copy link:', link[0])

    // The pending list must be absolute too — that's the one you come back for.
    await page.goto(`/goals/${state.goalId}/share`)
    const pending = await page.locator('body').innerText()
    expect(pending).not.toMatch(/^\s*\/goals\/invite\//m)
  })

  test('a contact can be picked by name, and the invite reaches them in-app', async ({ browser, page }) => {
    await signInVia(page, A, `/goals/${state.goalId}/share`)
    await page.goto(`/goals/${state.goalId}/share`)

    const picker = inviteForm(page).locator('select[name="contactUserId"]')
    await expect(picker, 'the DM fixture should put a name in the picker').toHaveCount(1)
    const names = await picker.locator('option').allInnerTexts()
    console.log('   contacts offered:', names.join(', '))
    // selectOption's label matcher is an exact string, not a regex. The label is
    // whatever lib/goals/contacts.ts built — display name, else @username.
    await picker.selectOption({ label: '@bd-verify-b' })

    await inviteForm(page).locator('input[name="tier"][value="cheer"]').check()
    await inviteForm(page).getByRole('button', { name: /send the invite/i }).click()
    await page.waitForURL(/token=/)

    const outcome = new URL(page.url()).searchParams.get('sent')
    console.log('   delivery outcome:', outcome)
    expect(outcome, 'a member invite must reach their notifications').toBe('member')
    await expect(page.getByText(/sent\./i).first()).toBeVisible()

    // And the partner actually has it.
    const ctx = await browser.newContext()
    const b = await ctx.newPage()
    await signInVia(b, B, '/account/notifications')
    await b.goto('/account/notifications')
    await expect(
      b.getByText(/wants you in his corner/i).first(),
      'the invite should be sitting in the partner\'s notifications',
    ).toBeVisible()
    await ctx.close()
  })

  test('an unknown contact id is refused, not delivered', async ({ page, request }) => {
    await signInVia(page, A, `/goals/${state.goalId}/share`)
    const cookies = await page.context().cookies()
    const jar = cookies.map((c) => `${c.name}=${c.value}`).join('; ')

    // A hand-rolled POST naming a uuid that is not one of his DM partners. The
    // <select> can't produce this; a curl can.
    const res = await request.post('/api/goals/share', {
      headers: { cookie: jar, 'content-type': 'application/x-www-form-urlencoded' },
      form: {
        op: 'invite', goalId: state.goalId, tier: 'cheer',
        contactUserId: '00000000-0000-0000-0000-000000000001',
      },
      maxRedirects: 0,
    })
    const location = res.headers()['location'] ?? ''
    expect(location, 'a stranger id must not mint a delivered invite').not.toContain('token=')

    // searchParams, not decodeURIComponent — form encoding writes spaces as `+`
    // and decodeURIComponent leaves them, so every phrase assertion silently
    // fails on a message that is actually correct.
    const msg = new URL(location, 'http://localhost:3000').searchParams.get('msg') ?? ''
    console.log('   refusal msg:', msg)
    expect(msg).toMatch(/connected to/i)
  })

  // ──────────────────────────────────────────────────────────────────────────
  // 9. Losing signal mid-session
  // ──────────────────────────────────────────────────────────────────────────
  test('a log made offline is queued and flushes when signal returns', async ({ page, context }) => {
    await signInVia(page, A, '/goals')
    const goalId = await createTaper(page, 'offline', 120)

    await page.goto('/today')
    const card = page.locator(`form:has(input[name="goalId"][value="${goalId}"])`).first()
    await expect(card).toHaveCount(1)
    await card.locator('input[name="value"]').fill('4')

    // Drop the connection AFTER the page is open — the exact case this covers.
    await context.setOffline(true)
    await card.getByRole('button', { name: /^log/i }).click()

    await expect(
      page.getByText(/waiting/i).first(),
      'an offline log should say it is held on the phone',
    ).toBeVisible()

    // Nothing private in the queue: an occurrence id and a number, no goal title.
    const stored = await page.evaluate(() => localStorage.getItem('bd_goal_log_queue_v1'))
    console.log('   queued:', stored)
    expect(stored).toContain('completed')
    expect(stored, 'the queue must not carry the goal title').not.toMatch(/quit|smok|E2E/i)

    // Signal back — the queue drains on its own and the row is gone.
    await context.setOffline(false)
    await page.waitForFunction(
      () => localStorage.getItem('bd_goal_log_queue_v1') === null,
      undefined, { timeout: 20_000 },
    )
    await page.goto('/today')
    await expect(
      page.locator(`form:has(input[name="goalId"][value="${goalId}"])`),
      'the flushed occurrence should be resolved',
    ).toHaveCount(0)
    console.log('   queue drained and the occurrence resolved')
  })

  // ──────────────────────────────────────────────────────────────────────────
  // 7. Mobile is the source of truth — nothing may scroll sideways at 393px
  // ──────────────────────────────────────────────────────────────────────────
  test('no horizontal overflow on any goals surface at 393px', async ({ page }) => {
    await signInVia(page, A, '/goals')
    const paths = [
      '/goals', '/today', '/goals/new', '/goals/new?t=quit-smoking-taper',
      `/goals/${state.loggedGoalId}`, `/goals/${state.loggedGoalId}/share`,
      `/goals/${state.loggedGoalId}/edit`, '/goals/shared',
    ]
    const bad = []
    for (const path of paths) {
      await page.goto(path)
      const { scroll, client } = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        client: document.documentElement.clientWidth,
      }))
      if (scroll > client + 1) bad.push(`${path} — ${scroll}px in a ${client}px viewport`)
    }
    expect(bad, `sideways scroll:\n${bad.join('\n')}`).toEqual([])
  })
})
