// Connections — the consent gate (migrations 140 + 141).
//
// Baseline the fixture guarantees: A and B are connected (grandfathered from
// their DM thread), C is a stranger to both. `npm run e2e:accounts -- --clean`
// restores that, and these tests assume it.

import { test, expect } from '@playwright/test'

const A = { email: 'bd-verify-a@example.com', password: 'VerifyPass!A1' }
// B is the grandfathered partner. Referenced by email in the search assertions
// rather than signed in as, so the credentials stay here for symmetry and for
// whoever adds the next test.
const _B = { email: 'bd-verify-b@example.com', password: 'VerifyPass!B1' }
const C = { email: 'bd-verify-c@example.com', password: 'VerifyPass!C1' }

async function signIn(page, acct, path = '/account/connections') {
  await page.goto(`/login?next=${encodeURIComponent(path)}`)
  await page.getByLabel('Email').fill(acct.email)
  await page.getByLabel('Password').fill(acct.password)
  await page.getByRole('button', { name: /sign in/i }).click()
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 })
}

/** The other party's user id, read out of the member search that the UI itself uses. */
async function findMember(page, term) {
  const res = await page.request.get(`/api/members/search?q=${encodeURIComponent(term)}`)
  const json = await res.json()
  return json.members?.[0] ?? null
}

async function post(page, op, userId) {
  return page.request.post('/api/connections', {
    form: { op, userId }, maxRedirects: 0,
  })
}

/**
 * The `msg` the route redirected with.
 *
 * Via URL.searchParams, NOT decodeURIComponent — form encoding writes spaces as
 * `+` and decodeURIComponent leaves them, so "already asked" comes back as
 * "already+asked" and every substring assertion silently fails.
 */
function msgOf(res) {
  const location = res.headers()['location'] ?? ''
  if (!location) return ''
  return new URL(location, 'http://localhost:3000').searchParams.get('msg') ?? ''
}

test.describe.serial('connections', () => {
  const state = { aId: null, cId: null }

  test('the fixture baseline is what the tests assume', async ({ page }) => {
    await signIn(page, A)
    const c = await findMember(page, 'bd-verify-c')
    expect(c, 'account C should exist — run npm run e2e:accounts').toBeTruthy()
    state.cId = c.id
    expect(c.connectionState, 'A and C must start as strangers').toBe('none')

    const b = await findMember(page, 'bd-verify-b')
    expect(b.connectionState, 'A and B are grandfathered from their DM thread').toBe('accepted')
  })

  // ── the gate ──────────────────────────────────────────────────────────────
  test('an unconnected pair cannot open a DM, and the copy says why', async ({ page }) => {
    await signIn(page, A, '/account/messages')
    await page.goto('/account/messages')

    await page.getByPlaceholder(/search by name/i).fill('bd-verify-c');
    await expect(page.getByText('@bd-verify-c')).toBeVisible()

    // The row must offer Connect, not Message — the point is that you learn this
    // BEFORE clicking, not from an error afterwards.
    const row = page.locator('div').filter({ hasText: '@bd-verify-c' }).last()
    await expect(row.getByRole('button', { name: /^connect$/i })).toBeVisible()
    await expect(row.getByRole('button', { name: /^message$/i })).toHaveCount(0)
  })

  test('a grandfathered pair still opens — messaging did not break', async ({ page }) => {
    await signIn(page, A, '/account/messages')
    await page.goto('/account/messages')
    await page.getByPlaceholder(/search by name/i).fill('bd-verify-b')
    await expect(page.getByText('@bd-verify-b')).toBeVisible()

    const row = page.locator('div').filter({ hasText: '@bd-verify-b' }).last()
    await row.getByRole('button', { name: /^message$/i }).click()
    await page.waitForURL(/\/account\/messages\/[0-9a-f-]{36}/, { timeout: 20_000 })
    console.log('   grandfathered thread opened:', page.url())
  })

  // ── request → accept ──────────────────────────────────────────────────────
  test('request, accept, and the DM unlocks', async ({ browser, page }) => {
    await signIn(page, A)
    const res = await post(page, 'request', state.cId)
    expect(res.status()).toBe(303)
    console.log('   after request:', msgOf(res))

    // A sees it as outgoing.
    await page.goto('/account/connections')
    await expect(page.getByRole('heading', { name: /you asked/i })).toBeVisible()

    // C sees it waiting, and accepts.
    const ctx = await browser.newContext()
    const c = await ctx.newPage()
    await signIn(c, C)
    await c.goto('/account/connections')
    await expect(c.getByRole('heading', { name: /waiting on you/i })).toBeVisible()
    await c.getByRole('button', { name: /^accept$/i }).first().click()
    await c.waitForURL(/connections/)
    await expect(c.getByRole('heading', { name: /in your corner/i })).toBeVisible()

    // And now the DM works both ways.
    const after = await findMember(c, 'bd-verify-a')
    expect(after.connectionState).toBe('accepted')
    await ctx.close()
  })

  // ── the cascade ───────────────────────────────────────────────────────────
  test('disconnecting removes goal participation', async ({ browser, page }) => {
    // A shares a goal with C, C accepts, then A disconnects.
    await signIn(page, A, '/goals/new?t=quit-smoking-taper')
    await page.goto('/goals/new?t=quit-smoking-taper')
    await page.locator('input[name="title"]').fill(`E2E cascade ${Date.now().toString().slice(-6)}`)
    await page.getByRole('button', { name: /start|create|save|begin/i }).last().click()
    await page.waitForURL(/\/goals\/[0-9a-f-]{36}/, { timeout: 30_000 })
    const goalId = page.url().match(/\/goals\/([0-9a-f-]{36})/)[1]

    await page.goto(`/goals/${goalId}/share`)
    const form = page.locator('form:has(input[name="op"][value="invite"])')
    await form.locator('select[name="contactUserId"]').selectOption(state.cId)
    await form.locator('input[name="tier"][value="cheer"]').check()
    await form.getByRole('button', { name: /send the invite/i }).click()
    await page.waitForURL(/token=/)
    const token = new URL(page.url()).searchParams.get('token')

    const ctx = await browser.newContext()
    const c = await ctx.newPage()
    await signIn(c, C, `/goals/invite/${token}`)
    await c.goto(`/goals/invite/${token}`)
    await c.getByRole('button', { name: /accept|join|count me in|i'm in/i }).first().click()
    await c.waitForURL(/\/goals\/shared/)
    await expect(c.locator(`a[href="/goals/shared/${goalId}"]`).first().or(c.locator('body')))
      .toBeVisible()
    console.log('   C is watching the goal')

    // THE CASCADE. A disconnects; the goal must leave C's shared list.
    await page.goto('/account/connections')
    await post(page, 'remove', state.cId)

    await c.goto('/goals/shared')
    await expect(
      c.locator(`a[href="/goals/shared/${goalId}"]`),
      'ending the connection must end the sharing built on it',
    ).toHaveCount(0)
    console.log('   cascade confirmed — goal gone from C\'s shared list')
    await ctx.close()
  })

  // ── a stale token cannot undo the cascade ─────────────────────────────────
  test('an old invite link will not re-establish a severed connection', async ({ browser, page }) => {
    await signIn(page, A, '/goals/new?t=quit-smoking-taper')
    await page.goto('/goals/new?t=quit-smoking-taper')
    await page.locator('input[name="title"]').fill(`E2E stale ${Date.now().toString().slice(-6)}`)
    await page.getByRole('button', { name: /start|create|save|begin/i }).last().click()
    await page.waitForURL(/\/goals\/[0-9a-f-]{36}/, { timeout: 30_000 })
    const goalId = page.url().match(/\/goals\/([0-9a-f-]{36})/)[1]

    // Mint a link while A and C are NOT connected (the previous test severed it).
    await page.goto(`/goals/${goalId}/share`)
    const form = page.locator('form:has(input[name="op"][value="invite"])')
    await form.locator('input[name="tier"][value="cheer"]').check()
    await form.getByRole('button', { name: /send the invite/i }).click()
    await page.waitForURL(/token=/)
    const token = new URL(page.url()).searchParams.get('token')

    const ctx = await browser.newContext()
    const c = await ctx.newPage()
    await signIn(c, C, `/goals/invite/${token}`)
    await c.goto(`/goals/invite/${token}`)
    await c.getByRole('button', { name: /accept|join|count me in|i'm in/i }).first().click()
    await c.waitForLoadState('networkidle')

    const body = (await c.locator('body').innerText()).toLowerCase()
    expect(body, 'accept must refuse without an accepted connection').toContain('connect with them first')
    console.log('   stale-token hole is closed')
    await ctx.close()
  })

  // ── decline is silent, and cools down ─────────────────────────────────────
  test('a decline tells the requester nothing, and blocks a re-ask', async ({ browser, page }) => {
    await signIn(page, A)
    const asked = await post(page, 'request', state.cId)
    // Surfaced explicitly: this is the step most likely to be eaten by the
    // connection-request rate limit across repeated suite runs, and without the
    // message the failure looks like "C never got the request" instead of
    // "A was throttled".
    console.log('   request outcome:', msgOf(asked))

    const ctx = await browser.newContext()
    const c = await ctx.newPage()
    await signIn(c, C)
    await c.goto('/account/connections')
    await c.getByRole('button', { name: /not now/i }).first().click()
    await c.waitForURL(/connections/)

    // The requester must not learn it. It still reads as waiting.
    await page.goto('/account/connections')
    const aSees = (await page.locator('body').innerText()).toLowerCase()
    expect(aSees, 'a decline is never announced').not.toContain('declined')
    expect(aSees, 'it still looks like it is waiting').toContain('you asked')

    // And re-asking inside the cooldown is refused.
    const again = await post(page, 'request', state.cId)
    const msg = msgOf(again)
    console.log('   re-ask:', msg)
    expect(msg).toMatch(/already asked|give it some time/i)
    await ctx.close()
  })

  // ── block, with no prior DM ───────────────────────────────────────────────
  test('you can block a stranger who asked — the path that did not exist before', async ({ browser, page }) => {
    const ctx = await browser.newContext()
    const c = await ctx.newPage()
    await signIn(c, C)
    // C asks A this time, so A has an incoming request from someone they have
    // never messaged. Before connections there was no way to block that person.
    const a = await findMember(c, 'bd-verify-a')
    state.aId = a.id
    await post(c, 'request', state.aId)

    await signIn(page, A)
    await page.goto('/account/connections')

    // SCOPE TO C'S CARD. `.first()` here previously grabbed the Block button on
    // B's "In your corner" card and blocked the wrong person entirely — the test
    // passed its own assertions right up until it didn't, having quietly
    // destroyed the fixture. Every action button on this page belongs to a card,
    // so address the card.
    const card = page.locator('div.rounded-xl').filter({ hasText: '@bd-verify-c' }).last()
    await expect(card, 'C\'s request should be waiting on A').toBeVisible()
    await card.getByRole('button', { name: /^block$/i }).click()
    await page.waitForURL(/connections/)

    await expect(page.getByRole('heading', { name: /^blocked$/i })).toBeVisible()
    const body = await page.locator('body').innerText()
    expect(body).toContain('bd-verify-c')

    // And they're now mutually invisible in search.
    const gone = await findMember(page, 'bd-verify-c')
    expect(gone, 'a blocked member must not appear in search at all').toBeNull()
    const alsoGone = await findMember(c, 'bd-verify-a')
    expect(alsoGone, 'blocking is mutual in search, both directions').toBeNull()
    await ctx.close()
  })

  // ── the entry point that was missing ──────────────────────────────────────
  test('account settings surfaces the connection count and links to the list', async ({ page }) => {
    await signIn(page, A, '/account/settings')
    await page.goto('/account/settings')

    const card = page.locator('a[href="/account/connections"]')
    await expect(card, 'settings must offer a way INTO the list, not just the toggles').toHaveCount(1)

    const text = await card.innerText()
    console.log('   corner card:', text.replace(/\s+/g, ' ').trim())
    expect(text).toMatch(/connection/i)

    // The policy switches stay here too, and stay separate from the list.
    await expect(page.getByText(/who can reach you/i)).toBeVisible()
    await expect(page.getByRole('switch', { name: /let people ask to connect/i })).toBeVisible()
    await expect(page.getByRole('switch', { name: /findable by my email/i })).toBeVisible()

    await card.click()
    await page.waitForURL(/\/account\/connections/)
    await expect(page.getByRole('heading', { name: /who you're connected to/i })).toBeVisible()
  })

  // ── email discovery ───────────────────────────────────────────────────────
  test('email search matches only exact, and never returns the address', async ({ page }) => {
    await signIn(page, A)

    const exact = await findMember(page, 'bd-verify-b@example.com')
    expect(exact, 'the whole address should find them').toBeTruthy()
    expect(JSON.stringify(exact), 'the address must never come back in the payload')
      .not.toContain('@example.com')

    const partial = await findMember(page, 'bd-verify-b@exam')
    expect(partial, 'a partial address must find nobody — that is enumeration').toBeNull()

    const stem = await findMember(page, 'bd-verify-b@')
    expect(stem, 'a stem must find nobody either').toBeNull()
  })
})
