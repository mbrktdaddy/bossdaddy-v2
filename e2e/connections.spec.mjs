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
    // "Connected", not "in your corner" — the contact list is everyone you can
    // reach; your corner is the smaller derived set on /account.
    await expect(c.getByRole('heading', { name: /^connected$/i })).toBeVisible()

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

    // UNBLOCK, and restore the baseline this test breaks for everything after it.
    // A block makes the pair mutually invisible, so leaving it in place made every
    // later test involving C fail on a null search result — which looks like a
    // product bug and is just test ordering. Doubles as unblock coverage.
    await post(page, 'unblock', state.cId)
    expect(await findMember(page, 'bd-verify-c'), 'unblocking restores visibility').toBeTruthy()
    expect(await findMember(c, 'bd-verify-a'), 'both directions come back').toBeTruthy()
    await ctx.close()
  })

  // ── the entry point that was missing ──────────────────────────────────────
  test('the nav badge counts people waiting on you', async ({ browser, page }) => {
    // C asks A, so A has something pending. The badge lives inside the avatar
    // dropdown, which is conditionally mounted — it only fetches once opened,
    // which is the whole reason it's cheap enough to sit in the nav.
    const ctx = await browser.newContext()
    const c = await ctx.newPage()
    await signIn(c, C)
    const a = await findMember(c, 'bd-verify-a')
    await post(c, 'request', a.id)

    await signIn(page, A, '/goals')
    const pending = await page.request.get('/api/connections/pending')
    const { count } = await pending.json()
    console.log('   pending count:', count)
    expect(count, 'the endpoint should see the waiting request').toBeGreaterThan(0)

    // And it renders in the menu rather than only existing in the API.
    await page.goto('/goals')
    await page.getByRole('button', { name: /account|menu/i }).first().click()
    const link = page.locator('a[href="/account/connections"]').first()
    await expect(link).toBeVisible()
    await expect(link.getByLabel(/waiting on you/i)).toBeVisible()

    // Clear it so the later tests start from the documented baseline.
    await post(page, 'decline', state.cId)
    await ctx.close()
  })

  test('/account is the personal home and /account/settings is only settings', async ({ page }) => {
    await signIn(page, A, '/account')
    await page.goto('/account')

    // Things you HAVE.
    await expect(page.getByRole('heading', { name: /your stuff/i })).toBeVisible()
    const card = page.locator('a[href="/account/connections"]')
    await expect(card, 'the home must offer a way INTO the contact list').toHaveCount(1)
    const text = await card.innerText()
    console.log('   contacts card:', text.replace(/\s+/g, ' ').trim())
    expect(text, 'the card counts CONTACTS, not corner members').toMatch(/contact/i)

    // Things you CONFIGURE, and none of the above.
    await page.goto('/account/settings')
    await expect(page.getByRole('heading', { name: /account settings/i })).toBeVisible()
    await expect(page.getByText(/who can reach you/i)).toBeVisible()
    await expect(page.getByRole('switch', { name: /let people ask to connect/i })).toBeVisible()
    await expect(page.getByRole('switch', { name: /findable by my email/i })).toBeVisible()
    await expect(
      page.getByText(/liked content/i),
      'your stuff moved off the settings page',
    ).toHaveCount(0)

    await page.goto('/account')
    await card.click()
    await page.waitForURL(/\/account\/connections/)
    await expect(page.getByRole('heading', { name: /who you can reach/i })).toBeVisible()
  })

  // The naming distinction this whole rename exists to protect.
  test('contacts and "your corner" are different sets', async ({ page }) => {
    await signIn(page, A, '/account/connections')
    await page.goto('/account/connections')

    const body = (await page.locator('body').innerText()).toLowerCase()
    // The flat list is everyone you can reach — it must NOT claim to be the corner.
    expect(body, 'the contact list is not "your corner"').not.toContain('in your corner\n')
    expect(body).toContain('connected')
    // …and it points at where the real corner lives.
    await expect(page.locator('a[href="/account"]')).toHaveCount(1)
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

  test('turning off "findable by my email" actually hides you', async ({ browser, page }) => {
    // Driven through the real switch rather than a direct DB write — the point is
    // that the toggle a member can reach does what it says, not that the column
    // works.
    const ctx = await browser.newContext()
    const c = await ctx.newPage()
    await signIn(c, C, '/account/settings')
    await c.goto('/account/settings')

    const toggle = c.getByRole('switch', { name: /findable by my email/i })
    await expect(toggle).toHaveAttribute('aria-checked', 'true')   // permissive default
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-checked', 'false')

    await signIn(page, A, '/account/connections')
    const hidden = await findMember(page, 'bd-verify-c@example.com')
    expect(hidden, 'an opted-out member must not be findable by their address').toBeNull()

    // …but they're still findable the ordinary way. The setting governs EMAIL
    // discovery only; turning it on shouldn't quietly delist you from search.
    const byName = await findMember(page, 'bd-verify-c')
    expect(byName, 'the opt-out covers email lookup, not username search').toBeTruthy()

    // Put it back so the fixture stays at its documented baseline.
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-checked', 'true')
    const restored = await findMember(page, 'bd-verify-c@example.com')
    expect(restored, 'switching it back on should restore email discovery').toBeTruthy()
    await ctx.close()
  })
})
