// Design-commit process, Step 2 (2026-10-13): three directions INSIDE the locked
// brief (light canvas, louder, two lanes, premium / clean / rugged).
//
//   node docs/mockups/directions/build.mjs
//
// Emits index.html + a-hard-goods.html + b-newsstand.html + c-showroom.html next
// to this file. Content is REAL (pulled read-only from the production DB on
// 2026-10-13); product images are public storage URLs; the portrait + logo are
// copied into ./assets. Hand-written CSS, no runtime deps — open on the phone.
//
// One data object, one set of partials, three renderers. The structure is the
// settled Phase 5 front page (brand band → lead package → Boss Approved board →
// Guides → Tools → Newsletter → Bench → About → Shop). What changes per
// direction is the loudness MECHANISM and the utility-lane treatment.

import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT = dirname(fileURLToPath(import.meta.url))
const S = 'https://fsxbertkzcigvkdyqgep.supabase.co/storage/v1/object/public/'

// ── Real content ─────────────────────────────────────────────────────────────
const D = {
  positioning: 'The Boss Dad Standard',
  tagline: 'Dad Like a Boss.',
  creed: "Being a proud, present father who shows up every day isn't a compromise of strength — it's the ultimate expression of it.",
  featured: {
    title: 'Gorilla Playsets Wilderness Gym Swing Set Review: Backyard Boss',
    product: 'Gorilla Playsets Wilderness Gym Swing Set',
    cat: 'Outdoors & Adventure',
    rating: '9.0',
    pct: 90,
    excerpt: 'At $3,599, this 1,181-lb cedar fortress is a serious two-day build — and a serious statement that an actual Boss Daddy lives here.',
    image: S + 'media/products/e7740d4a-8d79-4a20-9692-5ae3afffd2ba/1780186420605-o1m6k0.webp',
    date: 'June 2, 2026',
    paid: '$3,599.99',
  },
  latest: [
    { kind: 'Guide', title: 'Am I Aiming at the Right Goals as a Father?', date: 'Aug 4' },
    { kind: 'Guide', title: "Prayer as a Parenting Tool: A Beginner Dad's Guide", date: 'Aug 4' },
    { kind: 'Guide', title: 'Working the Holiday: The Silent Sacrifice Dads Make', date: 'Aug 4' },
    { kind: 'Guide', title: 'Pro Dad Tactics: Eradicate Ants Like a Pest Expert', date: 'Aug 4' },
    { kind: 'Review', title: "Men's Cotton Athletic Ankle Running Socks", date: 'Jul 29' },
    { kind: 'Review', title: 'Optimum Nutrition Gold Standard 100% Whey Protein', date: 'Jul 29' },
  ],
  picks: [
    { name: 'Weber Genesis E-330 Stealth', cat: 'Grilling & Cooking', rating: '8.0', paid: '$1,199', top: true, image: S + 'media/general/1780278015830-9461tc.webp' },
    { name: "Men's Cotton Athletic Ankle Running Socks", cat: 'Home & Lifestyle', rating: '9.0', paid: '$25.99', image: S + 'media/products/3cefed03-29b2-4f0c-b36f-f1cf7a9740b7/1783964886410-xfjhyq.webp' },
    { name: 'Enfamil Optimum (Enspire) RTF', cat: 'Kids & Family', rating: '9.0', paid: '$96', image: S + 'media/products/13e959bb-fe69-4f8f-93cc-6ccd632d8c82/1780193167936-wlryol.webp' },
    { name: 'Superb Meat Smoking Guide Magnet', cat: 'Grilling & Cooking', rating: '9.0', paid: '$19.99', image: S + 'media/products/40f7cfc0-078c-4d54-a9da-5d128494a489/1780186882063-6jrtos.webp' },
    { name: 'Momentous Vitamin D3 5,000 IU', cat: 'Health & Wellness', rating: '9.0', paid: '$16.95', image: S + 'media/products/9f169fee-fb11-42bb-aacd-cbcf740e84c3/1780190883748-d9xcnc.webp' },
    { name: 'FANHAO Garden Hose Nozzle', cat: 'Home & Lifestyle', rating: '9.0', paid: '$25.80', image: S + 'media/products/cb46cc63-1bbf-447a-b887-f34716a501bf/1780193519856-jqyqnz.webp' },
    { name: 'Gorilla Playsets Wilderness Gym Swing Set', cat: 'Outdoors & Adventure', rating: '9.0', paid: '$3,599.99', image: S + 'media/products/e7740d4a-8d79-4a20-9692-5ae3afffd2ba/1780186420605-o1m6k0.webp' },
    { name: 'Optimum Nutrition Micronized Creatine Monohydrate Powder', cat: 'Health & Wellness', rating: '8.75', paid: '$16', image: S + 'media/products/ec2e0000-dcc3-452a-ab1f-5b12cae69a32/1781798723087-aoy5ub.webp' },
  ],
  topics: ['Kids & Family', 'Tools & DIY', 'Grilling & Cooking', 'Vehicles & Garage', 'Health & Wellness', 'Home & Lifestyle', 'Table Duty'],
  allTopics: ['Kids & Family', 'Tools & DIY', 'Grilling & Cooking', 'Outdoors & Adventure', 'Tech & Gadgets', 'Vehicles & Garage', 'Health & Wellness', 'Home & Lifestyle', 'Table Duty', 'Watch Duty'],
  leadGuide: {
    title: 'Am I Aiming at the Right Goals as a Father?', cat: 'Table Duty', min: 8,
    excerpt: 'Provision versus presence — which one will kids actually remember.',
    image: S + 'guide-images/ai-1785227785324-m5d2zr.webp',
  },
  spotlight: {
    cat: 'Health & Wellness', count: 11,
    lead: { title: 'The Science-Backed Framework for Building Identity-Based Habits', min: 9, excerpt: "Forget willpower — here's the identity-based habit framework, backed by real research, that actually changes who you are.", image: S + 'guide-images/ai-1785639599371-u17l1r.webp' },
    rows: [
      { title: 'The Science Behind Dad Brain And How Fatherhood Changes You', min: 12, image: S + 'guide-images/ai-1783914411804-og7m2u.webp' },
      { title: "Razor Rash? Here's Our #1 Shaving Hack for Men.", min: 5, image: S + 'guide-images/ai-1778710323410-zp8tap.webp' },
      { title: 'Faith, Fatherhood & the Man You Should Become First', min: 7, image: S + 'media/general/1782944423690-rkqxg0.webp' },
    ],
  },
  tools: [
    { kicker: 'Ask · The Boss', title: 'Tell the Boss what you need. Get a straight answer.', blurb: 'How-to, gear questions, a toast you have to give, a hard talk you need to have — plain English, from a voice in your corner.', cta: 'Ask the Boss' },
    { kicker: 'Time · Weekends Until', title: 'How many weekends do you have left with your kid?', blurb: 'Pick a birthdate. Pick a milestone. Get the number. Then make them count.', cta: 'Try it' },
    { kicker: 'Money · Savings', title: 'Small commitments, daily. Watch the dollars stack.', blurb: '$2 a day for a camping trip. $50 a month into a 529. Tiny habits, real progress. Invite your spouse so the streak counts as a team.', cta: 'Try it' },
  ],
  bench: [
    { name: 'Bug Stop Home Barrier', status: 'testing', cat: 'Home & Lifestyle', image: S + 'media/products/c67fc33a-c397-4d9c-8826-734bf03a2862/1783966282231-imll4b.webp' },
    { name: 'NUOBELL Adjustable Dumbbells 5-80 lbs', status: 'testing', cat: 'Health & Wellness', image: S + 'media/products/c802695f-3769-4772-a359-275efbdb4c97/1780226186929-dyji9f.webp' },
    { name: 'SpitJack PULSE Meat Injector Gun', status: 'testing', cat: 'Grilling & Cooking', image: S + 'media/products/d70f23fb-a8f2-402d-8434-c5f1cc83f4d4/1780227214902-2orroo.webp' },
    { name: 'GRILL HEAT AID BBQ Grill Gloves', status: 'testing', cat: 'Grilling & Cooking', image: S + 'media/products/c71e3cbe-66ee-434b-8415-f4cb3b1b986e/1780226938313-5eqasb.webp' },
    { name: 'GROWNSY Nasal Aspirator', status: 'testing', cat: 'Kids & Family', image: S + 'media/products/0024b4e6-0a75-4ae4-a92f-03da397f801a/1780227686152-fzv0vs.webp' },
    { name: '20V MAX XR Brushless Cordless 1/2 in. Drill/Driver', status: 'queued', cat: 'Tools & DIY', image: null },
  ],
  motion: [
    { label: 'Just tested', title: "Men's Cotton Athletic Ankle Running Socks" },
    { label: 'On the bench', title: 'Bug Stop Home Barrier' },
    { label: 'New guide', title: 'Am I Aiming at the Right Goals as a Father?' },
  ],
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const I = {
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 4-6 8-6s8 2 8 6"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M13 7l5 5-5 5M18 12H6"/></svg>',
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M3 11 12 4l9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>',
  explore: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2.5 6-4.5 1.5 2.5-6z"/></svg>',
  ask: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M4 5h16v11H9l-5 4z"/></svg>',
  gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M3 12V4h8l9 9-8 8z"/><circle cx="7" cy="8" r="1.5"/></svg>',
  tools: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 6.5a4 4 0 0 0 5 5L11 20l-3-3z"/><path d="M4 20l3-3"/></svg>',
}

// ── Shared CSS ───────────────────────────────────────────────────────────────
const BASE_CSS = `
:root{--chrome:#09090b;--bg:#fff;--raised:#fafafa;--hover:#f4f4f5;--sunken:#f4f4f5;--soft:#e4e4e7;--strong:#d4d4d8;--text:#18181b;--muted:#52525b;--faint:#71717a;--orange:#CC5500;--orange-hot:#E55A1A;--orange-text:#B85A14;--maxw:1152px}
*{box-sizing:border-box;margin:0;padding:0}
html{color-scheme:light}
body{background:var(--bg);color:var(--text);font-family:Geist,system-ui,-apple-system,sans-serif;-webkit-font-smoothing:antialiased;line-height:1.5;padding-bottom:64px}
@media(min-width:768px){body{padding-bottom:0}}
a{color:inherit;text-decoration:none}
img{display:block;max-width:100%}
ul,ol{list-style:none}
svg{width:1em;height:1em}
.wrap{max-width:var(--maxw);margin:0 auto;padding:0 20px}
@media(min-width:640px){.wrap{padding:0 24px}}
h1,h2,h3,h4{font-family:Montserrat,system-ui,sans-serif;line-height:1.1;letter-spacing:-.01em;font-weight:900}
.dirnote{background:#3f3f46;color:#fff;font-size:11px;font-weight:600;text-align:center;padding:7px 12px;letter-spacing:.04em}
.dirnote b{color:#f48a4a}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;font-family:Montserrat,system-ui,sans-serif;font-weight:800;font-size:14px;min-height:44px;padding:0 20px;border-radius:8px;background:var(--chrome);color:#fff;transition:background .15s;border:2px solid transparent;cursor:pointer;white-space:nowrap}
.btn:hover{background:var(--orange)}
.btn.line{background:transparent;color:var(--text);border-color:var(--text)}
.btn.line:hover{background:var(--text);color:#fff}
.btn svg{width:14px;height:14px}
.mast{background:var(--chrome);color:#fff;position:sticky;top:0;z-index:40}
.mast .in{display:flex;align-items:center;gap:20px;height:64px}
.logo{display:flex;align-items:center;gap:10px}
.logo img{width:36px;height:36px;border-radius:6px}
.logo b{font-family:Montserrat,system-ui,sans-serif;font-weight:900;font-size:17px;letter-spacing:-.02em;text-transform:uppercase;line-height:1}
.nav{display:none;gap:22px;margin-left:8px;align-items:center}
.nav a{font-family:Montserrat,system-ui,sans-serif;font-weight:700;font-size:14px;color:#d4d4d8}
.nav a:hover{color:#fff}
.nav .sep{width:1px;height:18px;background:#3f3f46}
.mast .right{margin-left:auto;display:flex;align-items:center;gap:8px}
.search{display:none;align-items:center;gap:8px;height:38px;padding:0 12px;border:1px solid #3f3f46;border-radius:6px;color:#a1a1aa;font-size:13px;min-width:220px}
.search svg{width:15px;height:15px}
.icon-btn{width:44px;height:44px;display:grid;place-items:center;color:#fff}
.icon-btn svg{width:22px;height:22px}
@media(min-width:1024px){.nav{display:flex}.search{display:flex}.icon-btn.s{display:none}}
.bnav{position:fixed;left:0;right:0;bottom:0;height:64px;background:var(--chrome);border-top:1px solid #27272a;display:flex;z-index:40}
.bnav a{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;font-family:Montserrat,system-ui,sans-serif;font-size:10px;font-weight:700;color:#a1a1aa;text-transform:uppercase;letter-spacing:.06em}
.bnav a.on{color:var(--orange-hot)}
.bnav svg{width:22px;height:22px}
@media(min-width:768px){.bnav{display:none}}
footer{background:var(--chrome);color:#a1a1aa;font-size:13px}
footer .cols{display:grid;grid-template-columns:1fr 1fr;gap:28px;padding:40px 0}
@media(min-width:768px){footer .cols{grid-template-columns:2fr 1fr 1fr 1fr}}
footer .brand{grid-column:1/-1}
@media(min-width:768px){footer .brand{grid-column:auto}}
footer h4{color:#fff;font-size:11px;text-transform:uppercase;letter-spacing:.16em;margin-bottom:12px;font-weight:800}
footer li{margin:7px 0}
footer .tag{font-family:Montserrat,system-ui,sans-serif;font-weight:900;font-size:20px;color:#fff;letter-spacing:-.02em}
footer .tag span{color:var(--orange-hot)}
footer .legal{border-top:1px solid #27272a;padding:18px 0;font-size:12px;display:flex;flex-wrap:wrap;gap:14px}
.kick{font-family:Montserrat,system-ui,sans-serif;font-weight:800;font-size:11px;text-transform:uppercase;letter-spacing:.16em;color:var(--orange-text)}
.ph{display:grid;place-items:center;color:#a1a1aa;background:var(--sunken)}
.ph svg{width:22px;height:22px}
`

// ── Shared partials ──────────────────────────────────────────────────────────
function head(title, css) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="color-scheme" content="light" />
<title>${esc(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@700;800;900&family=Geist:wght@400;500;600;700&family=Fraunces:opsz,wght@9..144,600&display=swap" rel="stylesheet" />
<style>${BASE_CSS}${css}</style>
</head>
<body>`
}

function masthead(dir) {
  // 'b' and 'a2' fold the tagline under the logo; the Hard Goods family keeps
  // the orange Sign-in button, the others use the account icon.
  const wm = dir === 'b' || dir === 'a2'
    ? `<span class="wm"><b>Boss Daddy</b><small>${esc(D.tagline)}</small></span>`
    : `<b>Boss Daddy</b>`
  const account = dir.startsWith('a')
    ? `<a class="btn" href="#">Sign in</a>`
    : `<a class="icon-btn" href="#" aria-label="Account">${I.user}</a>`
  return `<header class="mast"><div class="wrap in">
  <a class="logo" href="#"><img src="assets/bd-logo-icon.png" alt="" />${wm}</a>
  <nav class="nav"><a href="#">Topics ▾</a><a href="#">Gear</a><a href="#">Shop</a><a href="#">Gifts</a><span class="sep"></span><a href="#">Tools</a></nav>
  <div class="right"><div class="search">${I.search} Search reviews, guides, gear</div><a class="icon-btn s" href="#" aria-label="Search">${I.search}</a>${account}</div>
</div></header>`
}

function bottomNav() {
  return `<nav class="bnav"><a class="on" href="#">${I.home}Home</a><a href="#">${I.explore}Explore</a><a href="#">${I.ask}Ask</a><a href="#">${I.gear}Gear</a><a href="#">${I.tools}Tools</a></nav>`
}

function footer() {
  return `<footer><div class="wrap">
  <div class="cols">
    <div class="brand"><p class="tag">Dad Like a <span>Boss.</span></p><p style="margin-top:10px;max-width:34ch">${esc(D.positioning)}. Real Dads. Smart Tools. Better Decisions.</p></div>
    <div><h4>Topics</h4><ul>${D.allTopics.map((t) => `<li><a href="#">${esc(t)}</a></li>`).join('')}</ul></div>
    <div><h4>Site</h4><ul><li><a href="#">Reviews</a></li><li><a href="#">Guides</a></li><li><a href="#">Gear</a></li><li><a href="#">Shop</a></li><li><a href="#">Tools</a></li><li><a href="#">About</a></li><li><a href="#">How I test</a></li></ul></div>
    <div><h4>Account</h4><ul><li><a href="#">Sign in</a></li><li><a href="#">Newsletter</a></li><li><a href="#">Contact</a></li><li><a href="#">Privacy</a></li><li><a href="#">Terms</a></li></ul></div>
  </div>
  <div class="legal"><span>© 2026 Boss Daddy</span><span>Zero paid placements.</span><span>Affiliate links are disclosed on every review.</span></div>
</div></footer>`
}

function topicChips(cls, activeIndex = 4) {
  return `<div class="topics ${cls}">${D.topics.map((t, i) => `<a class="${i === activeIndex ? 'on chip' : 'chip'}" href="#">${esc(t)}</a>`).join('')}</div>`
}

function leadGuide() {
  const g = D.leadGuide
  return `<article class="lead-guide">
  <a class="img" href="#"><img src="${g.image}" alt="" loading="lazy" /></a>
  <div><span class="kick">Newest guide · ${esc(g.cat)}</span><h3>${esc(g.title)}</h3><p>${esc(g.excerpt)}</p><p class="meta" style="margin-top:10px;font-size:12px;color:var(--faint);font-weight:600">${g.min} min read</p></div>
</article>`
}

function benchImg(b, size) {
  if (b.image) return `<img src="${b.image}" alt="" loading="lazy" />`
  // size 0 = let the direction's CSS size the placeholder (C's rail tiles)
  const dims = size ? `width:${size}px;height:${size}px;` : ''
  return `<div class="ph" style="${dims}border-radius:4px">${I.tools}</div>`
}

// ── Direction A — Hard Goods ─────────────────────────────────────────────────
const A_CSS = `
.mast{border-bottom:4px solid var(--orange-hot)}
.mast .btn{min-height:38px;padding:0 14px;font-size:12px;text-transform:uppercase;letter-spacing:.08em;border-radius:4px;background:var(--orange-hot)}
.mast .btn:hover{background:#fff;color:var(--chrome)}
.band{background:var(--orange);color:#09090b}
.band .in{display:flex;align-items:center;justify-content:space-between;gap:16px;min-height:56px;padding-top:10px;padding-bottom:10px}
.band .tag{font-family:Montserrat,system-ui,sans-serif;font-weight:900;font-size:18px;text-transform:uppercase;letter-spacing:-.01em;white-space:nowrap}
.band .pos{font-family:Montserrat,system-ui,sans-serif;font-weight:800;font-size:10px;text-transform:uppercase;letter-spacing:.2em;white-space:nowrap;text-align:right}
.band .tick{display:none;gap:26px;font-size:12px;font-weight:600;min-width:0}
.band .tick li{display:flex;align-items:center;gap:6px;min-width:0}
.band .tick b{font-family:Montserrat,system-ui,sans-serif;font-weight:900;font-size:10px;text-transform:uppercase;letter-spacing:.14em;white-space:nowrap}
.band .tick span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:260px}
@media(min-width:1024px){.band .in{min-height:72px}.band .tag{font-size:26px}.band .pos{display:none}.band .tick{display:flex}}
.catbar{display:none;border-bottom:1px solid var(--soft)}
.catbar .in{display:flex;height:44px;align-items:stretch}
.catbar a{font-family:Montserrat,system-ui,sans-serif;font-weight:800;font-size:11px;text-transform:uppercase;letter-spacing:.1em;display:flex;align-items:center;padding:0 14px;border-right:1px solid var(--soft);border-bottom:3px solid transparent;margin-bottom:-1px}
.catbar a:first-child{padding-left:0}.catbar a:last-child{border-right:0}.catbar a:hover{border-bottom-color:var(--orange)}
@media(min-width:1024px){.catbar{display:block}}
.sec{padding:36px 0;border-bottom:1px solid var(--soft)}
@media(min-width:768px){.sec{padding:52px 0}}
.sh{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;margin-bottom:22px;border-bottom:3px solid var(--text);padding-bottom:12px}
.lbl{display:inline-block;background:var(--text);color:#fff;font-family:Montserrat,system-ui,sans-serif;font-weight:900;font-size:11px;text-transform:uppercase;letter-spacing:.16em;padding:6px 10px;line-height:1.2}
.sh h2{font-size:26px;text-transform:uppercase;letter-spacing:-.01em;margin-top:10px}
@media(min-width:768px){.sh h2{font-size:34px}}
.btn{border-radius:4px;text-transform:uppercase;letter-spacing:.08em;font-size:13px}
.btn.sm{min-height:38px;padding:0 14px;font-size:11px}
.lead{display:grid;gap:28px}
@media(min-width:1024px){.lead{grid-template-columns:3fr 2fr;gap:48px}}
.cover .img{display:block;position:relative;aspect-ratio:16/10;background:var(--sunken);overflow:hidden;border-radius:4px}
.cover .img img{width:100%;height:100%;object-fit:cover}
.score-block{position:absolute;left:0;bottom:0;width:76px;height:76px;background:var(--orange);color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:Montserrat,system-ui,sans-serif;font-weight:900}
.score-block b{font-size:28px;line-height:1}.score-block small{font-size:9px;letter-spacing:.18em;text-transform:uppercase;margin-top:4px}
.cover .kick{display:block;margin-top:18px}
.cover h2{font-size:28px;line-height:1.05;margin-top:8px;letter-spacing:-.02em}
@media(min-width:768px){.cover h2{font-size:40px}}
.cover p{margin-top:12px;color:var(--muted);font-size:16px;max-width:60ch}
.chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}
.chip{font-family:Montserrat,system-ui,sans-serif;font-weight:800;font-size:11px;text-transform:uppercase;letter-spacing:.1em;padding:7px 10px;border:2px solid var(--text);border-radius:3px;line-height:1.2}
.chip.fill,.chip.on{background:var(--text);color:#fff}
.chip.hot{background:var(--orange);border-color:var(--orange);color:#fff}
.cover .cta{margin-top:18px}
.author{margin-top:22px;border:2px solid var(--text);border-radius:4px;padding:14px;display:flex;gap:14px;align-items:center}
.author img{width:52px;height:52px;object-fit:cover;object-position:bottom;border-radius:3px;flex-shrink:0}
.author b{font-family:Montserrat,system-ui,sans-serif;font-weight:900;font-size:13px;text-transform:uppercase;letter-spacing:.06em;display:block}
.author p{font-size:13px;color:var(--muted);margin-top:2px}
.author a{margin-left:auto;font-family:Montserrat,system-ui,sans-serif;font-weight:800;font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:var(--orange-text);white-space:nowrap}
.latest ol{border-top:3px solid var(--text)}
.latest li{display:flex;gap:14px;padding:14px 0;border-bottom:1px solid var(--soft);align-items:baseline}
.latest .n{font-family:Montserrat,system-ui,sans-serif;font-weight:900;font-size:22px;color:var(--text);width:38px;flex-shrink:0;line-height:1}
.latest .k{font-family:Montserrat,system-ui,sans-serif;font-weight:800;font-size:10px;text-transform:uppercase;letter-spacing:.14em;color:var(--orange-text);display:block}
.latest .t{font-weight:600;font-size:15px;line-height:1.3;margin-top:2px;display:block}
.board{display:grid;grid-template-columns:1fr 1fr;gap:20px 16px}
@media(min-width:768px){.board{grid-template-columns:repeat(4,1fr);gap:28px 20px}}
.tile .img{position:relative;aspect-ratio:1;background:var(--sunken);border-radius:4px;overflow:hidden;border-bottom:3px solid var(--text)}
.tile .img img{width:100%;height:100%;object-fit:cover}
.tile .tag{position:absolute;top:0;left:0;background:var(--text);color:var(--orange-hot);font-family:Montserrat,system-ui,sans-serif;font-weight:900;font-size:9px;letter-spacing:.14em;text-transform:uppercase;padding:5px 8px}
.tile .cat{margin-top:10px;font-family:Montserrat,system-ui,sans-serif;font-weight:800;font-size:10px;text-transform:uppercase;letter-spacing:.14em;color:var(--faint)}
.tile h3{font-weight:800;font-size:15px;line-height:1.25;margin-top:4px;letter-spacing:-.01em}
.tile .row{display:flex;align-items:center;justify-content:space-between;margin-top:10px;gap:8px}
.sq{display:inline-grid;place-items:center;min-width:40px;height:30px;padding:0 6px;background:var(--orange);color:#fff;font-family:Montserrat,system-ui,sans-serif;font-weight:900;font-size:13px;border-radius:3px}
.tile .paid{font-size:12px;font-weight:600}
.topics{display:flex;gap:8px;overflow-x:auto;padding-bottom:4px;margin-bottom:22px;scrollbar-width:none}
.topics::-webkit-scrollbar{display:none}
.topics .chip{white-space:nowrap}
.lead-guide{display:grid;gap:18px;padding-bottom:28px;margin-bottom:28px;border-bottom:1px solid var(--soft)}
@media(min-width:768px){.lead-guide{grid-template-columns:1fr 1fr;gap:36px;align-items:center}}
.lead-guide .img{aspect-ratio:16/10;border-radius:4px;overflow:hidden;background:var(--sunken);display:block}
.lead-guide .img img{width:100%;height:100%;object-fit:cover}
.lead-guide h3{font-size:26px;line-height:1.08;letter-spacing:-.02em;margin-top:8px}
@media(min-width:768px){.lead-guide h3{font-size:34px}}
.lead-guide p{color:var(--muted);margin-top:10px;font-size:16px}
.spot{border-left:4px solid var(--text);padding-left:18px}
.spot .head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px}
.spot .head b{font-family:Montserrat,system-ui,sans-serif;font-weight:900;font-size:16px;text-transform:uppercase;letter-spacing:.02em}
.spot .head span{font-size:12px;color:var(--faint);font-weight:600}
.spot li{display:flex;gap:14px;align-items:center;padding:12px 0;border-top:1px solid var(--soft)}
.spot li img{width:72px;height:54px;object-fit:cover;border-radius:3px;flex-shrink:0;background:var(--sunken)}
.spot li b{font-weight:800;font-family:Montserrat,system-ui,sans-serif;font-size:15px;line-height:1.25;display:block;letter-spacing:-.01em}
.spot li span{font-size:12px;color:var(--faint)}
.tools{display:grid;gap:14px}
@media(min-width:768px){.tools{grid-template-columns:repeat(3,1fr);gap:20px}}
.tool{background:var(--chrome);color:#fff;border-top:4px solid var(--orange-hot);padding:22px;border-radius:4px;display:flex;flex-direction:column}
.tool .kick{color:#f48a4a}
.tool h3{font-size:21px;line-height:1.1;margin-top:10px;letter-spacing:-.02em}
.tool p{color:#a1a1aa;font-size:14px;margin-top:10px;flex:1}
.tool .btn{align-self:flex-start;margin-top:18px;background:var(--orange-hot);color:#fff}
.tool .btn:hover{background:#fff;color:var(--chrome)}
.news{background:var(--orange);color:#09090b;padding:44px 0}
@media(min-width:768px){.news{padding:64px 0}}
.news .in{display:grid;gap:18px}
@media(min-width:900px){.news .in{grid-template-columns:1fr 1fr;align-items:center;gap:40px}}
.news h2{font-size:40px;letter-spacing:-.03em;line-height:.95;text-transform:uppercase}
@media(min-width:768px){.news h2{font-size:56px}}
.news p{font-weight:600;font-size:15px;margin-top:10px;max-width:46ch}
.news form{display:flex;gap:8px}
.news input{flex:1;min-width:0;min-height:48px;border:2px solid #09090b;border-radius:4px;padding:0 14px;font-size:15px;background:#fff;font-family:inherit}
.news .btn{background:#09090b;color:#fff}
.news .btn:hover{background:#fff;color:#09090b}
.bench{border:2px solid var(--text);border-radius:4px;overflow:hidden}
.bench .head{background:var(--text);color:#fff;display:flex;align-items:center;gap:10px;padding:12px 16px}
.bench .head .dot{width:10px;height:10px;border-radius:50%;background:var(--orange-hot);box-shadow:0 0 0 4px rgba(229,90,26,.25)}
.bench .head b{font-family:Montserrat,system-ui,sans-serif;font-weight:900;font-size:12px;text-transform:uppercase;letter-spacing:.16em}
.bench .head a{margin-left:auto;font-family:Montserrat,system-ui,sans-serif;font-weight:800;font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:#f48a4a}
.bench li{display:flex;align-items:center;gap:14px;padding:12px 16px;border-top:1px solid var(--soft)}
.bench li:first-child{border-top:0}
.bench li img,.bench li .ph{width:56px;height:56px;object-fit:cover;border-radius:3px;background:var(--sunken);flex-shrink:0}
.bench li b{font-weight:700;font-size:14px;line-height:1.3;display:block}
.bench li span.c{font-size:12px;color:var(--faint)}
.bench .st{margin-left:auto;font-family:Montserrat,system-ui,sans-serif;font-weight:900;font-size:10px;text-transform:uppercase;letter-spacing:.14em;padding:6px 9px;border-radius:3px;color:#fff;background:var(--text);white-space:nowrap}
.bench .st.hot{background:var(--orange)}
.about{background:var(--chrome);color:#fff;border-top:4px solid var(--orange-hot);padding:44px 0}
@media(min-width:768px){.about{padding:64px 0}}
.about .in{display:grid;gap:24px}
@media(min-width:768px){.about .in{grid-template-columns:2fr 3fr;gap:48px;align-items:center}}
.about .img{aspect-ratio:4/5;overflow:hidden;border-radius:4px;background:#27272a}
.about .img img{width:100%;height:100%;object-fit:cover;object-position:bottom}
.about .lbl{background:var(--orange-hot);color:#fff}
.about blockquote{font-family:Fraunces,Georgia,serif;font-weight:600;font-size:24px;line-height:1.3;margin-top:18px;letter-spacing:-.01em}
@media(min-width:768px){.about blockquote{font-size:30px}}
.about blockquote span{display:block;color:var(--orange-hot);margin-top:10px}
.about .sig{margin-top:18px;font-family:Montserrat,system-ui,sans-serif;font-weight:800;font-size:11px;text-transform:uppercase;letter-spacing:.16em;color:#71717a}
.about .links{display:flex;gap:10px;margin-top:22px;flex-wrap:wrap}
.about .btn{background:#fff;color:#09090b}
.about .btn:hover{background:var(--orange-hot);color:#fff}
.about .btn.line{background:transparent;color:#fff;border-color:#fff}
.shop{background:#18181b;color:#fff;padding:22px 0;border-top:1px solid #27272a}
.shop .in{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap}
.shop b{font-family:Montserrat,system-ui,sans-serif;font-weight:900;font-size:18px;text-transform:uppercase;letter-spacing:-.01em}
.shop b span{color:var(--orange-hot)}
.shop .btn{background:#fff;color:#09090b}
footer{border-top:4px solid var(--orange-hot)}
`

// Step 4 refinements (2026-10-14). His Step 2 read: Hard Goods wins on colour and
// contrast, but on the phone the black masthead + orange stripe read as two nav
// bands. He liked Newsstand's masthead handling (tagline under the logo, topics
// row beneath). Both refinements keep the orange band + ticker on DESKTOP (he
// said it works there) and replace it on the phone:
//   a2 — "folded masthead": B's tagline-under-logo signature + a topics row.
//   a3 — "masthead as band": a tagline row fused into the black masthead (orange
//        type on black, the 4px orange rule under it) + the same topics row.
const CATROW_CSS = `
.catrow{border-bottom:1px solid var(--soft)}
.catrow .in{display:flex;height:44px;align-items:stretch;overflow-x:auto;scrollbar-width:none}
.catrow .in::-webkit-scrollbar{display:none}
.catrow a{font-family:Montserrat,system-ui,sans-serif;font-weight:800;font-size:11px;text-transform:uppercase;letter-spacing:.12em;display:flex;align-items:center;padding:0 12px;white-space:nowrap;border-bottom:3px solid transparent;margin-bottom:-1px}
.catrow a:first-child{padding-left:0}
.catrow a.on{border-bottom-color:var(--orange)}
.band{display:none}
@media(min-width:1024px){.band{display:block}.catrow{display:none}}
`
const A2_CSS = CATROW_CSS + `
.logo .wm{display:flex;flex-direction:column;line-height:1}
.logo .wm small{font-family:Montserrat,system-ui,sans-serif;font-weight:800;font-size:9px;letter-spacing:.22em;text-transform:uppercase;color:var(--orange-hot);margin-top:4px}
@media(min-width:1024px){.logo .wm small{display:none}}
`
const A3_CSS = CATROW_CSS + `
.mast{border-bottom:0}
.tagrow{background:var(--chrome);color:#fff;border-bottom:4px solid var(--orange-hot)}
.tagrow .in{display:flex;align-items:baseline;justify-content:space-between;gap:12px;padding-bottom:10px}
.tagrow .tag{font-family:Montserrat,system-ui,sans-serif;font-weight:900;font-size:18px;text-transform:uppercase;letter-spacing:-.01em;color:var(--orange-hot);white-space:nowrap}
.tagrow .pos{font-family:Montserrat,system-ui,sans-serif;font-weight:800;font-size:9px;letter-spacing:.2em;text-transform:uppercase;color:#a1a1aa;white-space:nowrap;text-align:right}
@media(min-width:1024px){.mast{border-bottom:4px solid var(--orange-hot)}.tagrow{display:none}}
`

function renderA(variant = 'a') {
  const f = D.featured
  const note = {
    a: '<b>DIRECTION A · HARD GOODS</b> — loud through blocks · STIHL / DeWalt · strongest on rugged',
    a2: '<b>A2 · HARD GOODS, FOLDED MASTHEAD</b> — tagline under the logo + topics row on the phone (from B) · orange band is desktop-only',
    a3: '<b>A3 · HARD GOODS, MASTHEAD AS BAND</b> — tagline row fused into the black masthead + topics row on the phone · orange band is desktop-only',
  }[variant]
  const css = A_CSS + (variant === 'a2' ? A2_CSS : variant === 'a3' ? A3_CSS : '')
  const tagrow = variant === 'a3'
    ? `<div class="tagrow"><div class="wrap in"><span class="tag">${esc(D.tagline)}</span><span class="pos">${esc(D.positioning)}</span></div></div>`
    : ''
  const catrow = variant === 'a'
    ? ''
    : `<div class="catrow"><div class="wrap in">${D.allTopics.map((t, i) => `<a class="${i === 6 ? 'on' : ''}" href="#">${esc(t)}</a>`).join('')}</div></div>`
  return head(`Direction ${variant.toUpperCase()} — Hard Goods · Boss Daddy`, css) + `
<div class="dirnote">${note}</div>
${masthead(variant)}
${tagrow}
<div class="band"><div class="wrap in">
  <span class="tag">${esc(D.tagline)}</span>
  <span class="pos">${esc(D.positioning)}</span>
  <ul class="tick">${D.motion.map((m) => `<li><b>${esc(m.label)}</b><span>${esc(m.title)}</span></li>`).join('')}</ul>
</div></div>
${catrow}
<div class="catbar"><div class="wrap in">${D.allTopics.map((t) => `<a href="#">${esc(t)}</a>`).join('')}</div></div>

<section class="sec"><div class="wrap">
  <div class="sh"><div><span class="lbl">Featured review</span></div><a class="btn line sm" href="#">All reviews</a></div>
  <div class="lead">
    <article class="cover">
      <a class="img" href="#"><img src="${f.image}" alt="" /><div class="score-block"><b>${f.rating}</b><small>Score</small></div></a>
      <span class="kick">${esc(f.cat)} · Bought it</span>
      <h2>${esc(f.title)}</h2>
      <p>${esc(f.excerpt)}</p>
      <div class="chips"><span class="chip fill">Paid ${f.paid}</span><span class="chip">Two-day build</span><span class="chip hot">Boss Approved</span></div>
      <div class="cta"><a class="btn" href="#">Read the review ${I.arrow}</a></div>
      <div class="author"><img src="assets/hero-workshop-mobile.webp" alt="" /><div><b>Reviewed by The Boss</b><p>Founder. Buys what he reviews. Zero paid placements.</p></div><a href="#">How I test</a></div>
    </article>
    <aside class="latest">
      <span class="lbl" style="margin-bottom:12px">Latest</span>
      <ol>${D.latest.map((l, i) => `<li><span class="n">${String(i + 1).padStart(2, '0')}</span><div><span class="k">${l.kind}</span><a class="t" href="#">${esc(l.title)}</a></div></li>`).join('')}</ol>
    </aside>
  </div>
</div></section>

<section class="sec"><div class="wrap">
  <div class="sh"><div><span class="lbl">Boss Approved</span><h2>Rated 8+. Bought with my own money.</h2></div><a class="btn line sm" href="#">All gear</a></div>
  <ul class="board">${D.picks.map((p) => `<li class="tile"><a href="#"><div class="img"><img src="${p.image}" alt="" loading="lazy" />${p.top ? '<span class="tag">Top pick</span>' : ''}</div><p class="cat">${esc(p.cat)}</p><h3>${esc(p.name)}</h3><div class="row"><span class="sq">${p.rating}</span><span class="paid">Paid ${p.paid}</span></div></a></li>`).join('')}</ul>
</div></section>

<section class="sec"><div class="wrap">
  <div class="sh"><div><span class="lbl">Guides</span><h2>How a Boss Dad gets it done</h2></div><a class="btn line sm" href="#">All guides</a></div>
  ${topicChips('')}
  ${leadGuide()}
  <div class="spot">
    <div class="head"><b>${esc(D.spotlight.cat)}</b><span>${D.spotlight.count} guides · See all</span></div>
    <ul>${[D.spotlight.lead, ...D.spotlight.rows].map((g) => `<li><img src="${g.image}" alt="" loading="lazy" /><div><b>${esc(g.title)}</b><span>${g.min} min read</span></div></li>`).join('')}</ul>
  </div>
</div></section>

<section class="sec"><div class="wrap">
  <div class="sh"><div><span class="lbl">Tools</span><h2>Built for the job</h2></div></div>
  <div class="tools">${D.tools.map((t) => `<div class="tool"><span class="kick">${esc(t.kicker)}</span><h3>${esc(t.title)}</h3><p>${esc(t.blurb)}</p><a class="btn" href="#">${esc(t.cta)}</a></div>`).join('')}</div>
</div></section>

<section class="news"><div class="wrap in">
  <div><h2>Boss Up.</h2><p>One email a week. The newest review, the guide worth your time, and a straight answer to one question dads keep asking.</p></div>
  <form onsubmit="return false"><input type="email" placeholder="you@email.com" /><button class="btn" type="submit">Subscribe</button></form>
</div></section>

<section class="sec"><div class="wrap">
  <div class="bench">
    <div class="head"><span class="dot"></span><b>On the bench</b><a href="#">See the bench</a></div>
    <ul>${D.bench.map((b) => `<li>${benchImg(b, 56)}<div><b>${esc(b.name)}</b><span class="c">${esc(b.cat)}</span></div><span class="st ${b.status === 'testing' ? 'hot' : ''}">${b.status === 'testing' ? 'Testing' : 'Queued'}</span></li>`).join('')}</ul>
  </div>
</div></section>

<section class="about"><div class="wrap in">
  <div class="img"><img src="assets/hero-workshop-mobile.webp" alt="The Boss at the workbench" /></div>
  <div><span class="lbl">About the Boss</span><blockquote>${esc(D.creed)}<span>That's ${esc(D.positioning)}.</span></blockquote><p class="sig">— The Boss</p>
  <div class="links"><a class="btn" href="#">Meet the Boss</a><a class="btn line" href="#">How I test</a></div></div>
</div></section>

<section class="shop"><div class="wrap in"><b>Boss Stuff for <span>Boss Dads</span></b><a class="btn sm" href="#">Shop the merch ${I.arrow}</a></div></section>
${footer()}
${bottomNav()}
</body></html>`
}

// ── Direction B — Newsstand ──────────────────────────────────────────────────
const B_CSS = `
.mast .in{height:66px}
.logo .wm{display:flex;flex-direction:column;line-height:1}
.logo .wm small{font-family:Montserrat,system-ui,sans-serif;font-weight:800;font-size:9px;letter-spacing:.22em;text-transform:uppercase;color:var(--orange-hot);margin-top:4px}
.search{min-width:280px;background:#18181b;border-color:#27272a;border-radius:4px}
.catrow{border-bottom:1px solid var(--soft)}
.catrow .in{display:flex;height:42px;align-items:stretch;overflow-x:auto;scrollbar-width:none}
.catrow .in::-webkit-scrollbar{display:none}
.catrow a{font-family:Montserrat,system-ui,sans-serif;font-weight:800;font-size:11px;text-transform:uppercase;letter-spacing:.12em;display:flex;align-items:center;padding:0 12px;white-space:nowrap;border-bottom:3px solid transparent;margin-bottom:-1px}
.catrow a:first-child{padding-left:0}.catrow a.on{border-bottom-color:var(--orange)}
.tickrow{display:none;border-bottom:1px solid var(--soft);background:var(--raised)}
.tickrow .in{display:flex;gap:28px;height:40px;align-items:center;font-size:12px}
.tickrow ul{display:flex;gap:28px;min-width:0}
.tickrow li{display:flex;align-items:center;gap:6px;min-width:0}
.tickrow b{font-family:Montserrat,system-ui,sans-serif;font-weight:900;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--orange-text);white-space:nowrap}
.tickrow span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:260px;font-weight:600}
.tickrow .zp{font-family:Montserrat,system-ui,sans-serif;font-weight:900;font-size:11px;text-transform:uppercase;letter-spacing:.1em;margin-right:4px}
@media(min-width:1024px){.tickrow{display:block}}
.sec{padding:32px 0;border-bottom:1px solid var(--soft)}
@media(min-width:768px){.sec{padding:48px 0}}
.sh{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;margin-bottom:22px;padding-bottom:12px;border-bottom:1px solid var(--text)}
.sh .kick{display:block;margin-bottom:6px}
.sh h2{font-size:34px;letter-spacing:-.03em;line-height:.95}
@media(min-width:768px){.sh h2{font-size:48px}}
.sh a{font-family:Montserrat,system-ui,sans-serif;font-weight:800;font-size:11px;text-transform:uppercase;letter-spacing:.12em;color:var(--orange-text);white-space:nowrap;padding-bottom:4px}
.btn{border-radius:6px}
.lead{display:grid;gap:28px}
@media(min-width:1024px){.lead{grid-template-columns:7fr 4fr;gap:56px}}
.cover{display:grid;gap:16px}
@media(min-width:768px){.cover{grid-template-columns:1fr 1fr;gap:28px;align-items:center}}
.cover .img{aspect-ratio:3/2;overflow:hidden;border-radius:6px;background:var(--sunken);display:block}
.cover .img img{width:100%;height:100%;object-fit:cover}
.cover h2{font-size:36px;line-height:.98;letter-spacing:-.035em;margin-top:8px}
@media(min-width:768px){.cover h2{font-size:44px}}
@media(min-width:1024px){.cover h2{font-size:52px}}
.cover p{font-size:17px;color:var(--muted);margin-top:14px;line-height:1.5}
.scoreline{display:flex;align-items:baseline;gap:6px;margin-top:16px}
.scoreline b{font-family:Montserrat,system-ui,sans-serif;font-weight:900;font-size:56px;line-height:.9;letter-spacing:-.04em;color:var(--orange)}
.scoreline span{font-family:Montserrat,system-ui,sans-serif;font-weight:800;font-size:13px;color:var(--faint);letter-spacing:.06em;text-transform:uppercase}
.byline{display:flex;align-items:center;gap:12px;margin-top:16px;padding-top:14px;border-top:1px solid var(--soft);font-size:13px;color:var(--muted);flex-wrap:wrap}
.byline img{width:40px;height:40px;border-radius:50%;object-fit:cover;object-position:bottom}
.byline b{color:var(--text);font-weight:700}
.byline a{color:var(--orange-text);font-weight:700}
.cover .cta{margin-top:18px}
.latest ol{counter-reset:n}
.latest li{display:flex;gap:12px;padding:12px 0;border-bottom:1px solid var(--soft)}
.latest .n{font-family:Montserrat,system-ui,sans-serif;font-weight:900;font-size:13px;color:var(--orange);width:22px;flex-shrink:0;padding-top:3px}
.latest .k{font-family:Montserrat,system-ui,sans-serif;font-weight:800;font-size:10px;text-transform:uppercase;letter-spacing:.14em;color:var(--orange-text)}
.latest .d{font-size:11px;color:var(--faint);margin-left:8px;font-weight:600}
.latest .t{font-weight:700;font-size:15px;line-height:1.3;margin-top:3px;display:block}
.board{display:grid;grid-template-columns:1fr 1fr;gap:22px 16px}
@media(min-width:768px){.board{grid-template-columns:repeat(4,1fr);gap:30px 24px}}
.tile .rank{font-family:Montserrat,system-ui,sans-serif;font-weight:900;font-size:40px;line-height:.8;letter-spacing:-.04em;margin-bottom:10px}
.tile .img{aspect-ratio:4/3;overflow:hidden;border-radius:6px;background:#fff;border:1px solid var(--soft)}
.tile .img img{width:100%;height:100%;object-fit:cover}
.tile .cat{margin-top:10px;font-family:Montserrat,system-ui,sans-serif;font-weight:800;font-size:10px;text-transform:uppercase;letter-spacing:.14em;color:var(--orange-text)}
.tile h3{font-weight:800;font-size:16px;line-height:1.2;margin-top:4px;letter-spacing:-.02em}
.tile .row{display:flex;align-items:baseline;gap:10px;margin-top:8px}
.tile .num{font-family:Montserrat,system-ui,sans-serif;font-weight:900;font-size:22px;letter-spacing:-.03em;color:var(--orange)}
.tile .paid{font-size:12px;color:var(--faint);font-weight:600}
.topics{display:flex;gap:18px;overflow-x:auto;scrollbar-width:none;margin-bottom:24px;border-bottom:1px solid var(--soft);padding-bottom:10px}
.topics::-webkit-scrollbar{display:none}
.topics a{font-family:Montserrat,system-ui,sans-serif;font-weight:800;font-size:12px;text-transform:uppercase;letter-spacing:.1em;white-space:nowrap}
.topics a.on{color:var(--orange-text);text-decoration:underline;text-underline-offset:6px;text-decoration-thickness:2px}
.lead-guide{display:grid;gap:16px;padding-bottom:28px;margin-bottom:28px;border-bottom:1px solid var(--soft)}
@media(min-width:768px){.lead-guide{grid-template-columns:5fr 7fr;gap:36px;align-items:center}}
.lead-guide .img{aspect-ratio:3/2;border-radius:6px;overflow:hidden;background:var(--sunken);display:block}
.lead-guide .img img{width:100%;height:100%;object-fit:cover}
.lead-guide h3{font-size:30px;line-height:1;letter-spacing:-.03em;margin-top:8px}
@media(min-width:768px){.lead-guide h3{font-size:40px}}
.lead-guide p{color:var(--muted);margin-top:12px;font-size:16px}
.spot .head{display:flex;align-items:baseline;gap:12px;margin-bottom:6px}
.spot .head b{font-family:Montserrat,system-ui,sans-serif;font-weight:900;font-size:22px;letter-spacing:-.02em}
.spot .head span{font-family:Montserrat,system-ui,sans-serif;font-weight:800;font-size:11px;text-transform:uppercase;letter-spacing:.12em;color:var(--orange-text)}
.spot li{display:flex;gap:14px;align-items:center;padding:14px 0;border-top:1px solid var(--soft)}
.spot li .n{font-family:Montserrat,system-ui,sans-serif;font-weight:900;font-size:26px;color:var(--strong);width:34px;flex-shrink:0;letter-spacing:-.04em;line-height:1}
.spot li img{width:88px;height:60px;object-fit:cover;border-radius:4px;flex-shrink:0;background:var(--sunken)}
.spot li b{font-family:Montserrat,system-ui,sans-serif;font-weight:800;font-size:16px;line-height:1.2;display:block;letter-spacing:-.02em}
.spot li span{font-size:12px;color:var(--faint)}
.tools-mod{border-top:3px solid var(--text);border-bottom:3px solid var(--text);padding:22px 0}
.tools-mod .head{display:flex;align-items:baseline;justify-content:space-between;margin-bottom:6px}
.tools-mod .head b{font-family:Montserrat,system-ui,sans-serif;font-weight:900;font-size:11px;text-transform:uppercase;letter-spacing:.18em;background:var(--text);color:#fff;padding:5px 9px}
.tools{display:grid}
@media(min-width:768px){.tools{grid-template-columns:repeat(3,1fr)}}
.tool{padding:18px 0;border-top:1px solid var(--soft)}
.tool:first-child{border-top:0}
@media(min-width:768px){.tool{border-top:0;border-left:1px solid var(--soft);padding:10px 24px}.tool:first-child{border-left:0;padding-left:0}.tool:last-child{padding-right:0}}
.tool h3{font-size:24px;line-height:1;letter-spacing:-.03em;margin-top:8px}
.tool p{color:var(--muted);font-size:14px;margin-top:10px}
.tool a.go{display:inline-flex;align-items:center;gap:4px;margin-top:12px;min-height:32px;font-family:Montserrat,system-ui,sans-serif;font-weight:800;font-size:11px;text-transform:uppercase;letter-spacing:.12em;color:var(--orange-text)}
.news{padding:36px 0;border-bottom:1px solid var(--soft)}
.news .box{border-top:3px solid var(--text);border-bottom:3px solid var(--text);padding:28px 0;display:grid;gap:18px}
@media(min-width:900px){.news .box{grid-template-columns:1fr 1fr;align-items:center;gap:40px;padding:36px 0}}
.news h2{font-size:48px;letter-spacing:-.04em;line-height:.9}
@media(min-width:768px){.news h2{font-size:64px}}
.news h2 span{color:var(--orange)}
.news p{color:var(--muted);font-size:15px;margin-top:10px}
.news form{display:flex;gap:8px}
.news input{flex:1;min-width:0;min-height:48px;border:1px solid var(--strong);border-radius:6px;padding:0 14px;font-size:15px;font-family:inherit}
.bench ul{border-top:1px solid var(--text)}
.bench li{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:14px;padding:10px 0;border-bottom:1px solid var(--soft)}
.bench li img,.bench li .ph{width:44px;height:44px;object-fit:cover;border-radius:4px;background:var(--sunken)}
.bench .st{font-family:Montserrat,system-ui,sans-serif;font-weight:900;font-size:10px;text-transform:uppercase;letter-spacing:.14em;color:var(--faint);width:70px;text-align:right}
.bench .st.hot{color:var(--orange-text)}
.bench li b{font-weight:700;font-size:15px;line-height:1.3;display:block}
.bench li span.c{font-size:12px;color:var(--faint)}
.about{background:var(--chrome);color:#fff;padding:44px 0}
@media(min-width:768px){.about{padding:64px 0}}
.about .in{display:grid;gap:24px}
@media(min-width:768px){.about .in{grid-template-columns:2fr 3fr;gap:48px;align-items:center}}
.about .img{aspect-ratio:4/5;overflow:hidden;border-radius:6px;background:#27272a}
.about .img img{width:100%;height:100%;object-fit:cover;object-position:bottom}
.about .kick{color:#f48a4a}
.about blockquote{font-family:Fraunces,Georgia,serif;font-weight:600;font-size:26px;line-height:1.25;margin-top:16px;letter-spacing:-.01em}
@media(min-width:768px){.about blockquote{font-size:34px}}
.about blockquote span{display:block;color:var(--orange-hot);margin-top:10px}
.about .sig{margin-top:18px;font-family:Montserrat,system-ui,sans-serif;font-weight:800;font-size:11px;text-transform:uppercase;letter-spacing:.16em;color:#71717a}
.about .links{display:flex;gap:22px;margin-top:22px;flex-wrap:wrap}
.about .links a{font-family:Montserrat,system-ui,sans-serif;font-weight:800;font-size:13px;color:#fff;display:inline-flex;align-items:center;gap:6px;min-height:44px}
.about .links a:hover{color:#f48a4a}
.shop{padding:28px 0;border-bottom:1px solid var(--soft)}
.shop .in{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap}
.shop b{font-family:Montserrat,system-ui,sans-serif;font-weight:900;font-size:24px;letter-spacing:-.03em}
.shop b span{color:var(--orange)}
`

function renderB() {
  const f = D.featured
  return head('Direction B — Newsstand · Boss Daddy', B_CSS) + `
<div class="dirnote"><b>DIRECTION B · NEWSSTAND</b> — loud through type and density · Men's Health / AppleInsider · strongest on authority</div>
${masthead('b')}
<div class="catrow"><div class="wrap in">${D.allTopics.map((t, i) => `<a class="${i === 6 ? 'on' : ''}" href="#">${esc(t)}</a>`).join('')}</div></div>
<div class="tickrow"><div class="wrap in"><span class="zp">Zero paid placements.</span><ul>${D.motion.map((m) => `<li><b>${esc(m.label)}</b><span>${esc(m.title)}</span></li>`).join('')}</ul></div></div>

<section class="sec"><div class="wrap">
  <div class="lead">
    <article class="cover">
      <a class="img" href="#"><img src="${f.image}" alt="" /></a>
      <div>
        <span class="kick">Featured review · ${esc(f.cat)}</span>
        <h2>${esc(f.title)}</h2>
        <div class="scoreline"><b>${f.rating}</b><span>/ 10 · Boss Approved</span></div>
        <p>${esc(f.excerpt)}</p>
        <div class="byline"><img src="assets/hero-workshop-mobile.webp" alt="" /><span>By <b>The Boss</b> · ${f.date} · Paid ${f.paid} · <a href="#">How I test</a></span></div>
        <div class="cta"><a class="btn" href="#">Read the review ${I.arrow}</a></div>
      </div>
    </article>
    <aside class="latest">
      <div class="sh" style="margin-bottom:6px"><div><span class="kick">Just in</span><h2 style="font-size:28px">Latest</h2></div><a href="#">All</a></div>
      <ol>${D.latest.map((l, i) => `<li><span class="n">${i + 1}</span><div><span class="k">${l.kind}</span><span class="d">${l.date}</span><a class="t" href="#">${esc(l.title)}</a></div></li>`).join('')}</ol>
    </aside>
  </div>
</div></section>

<section class="sec"><div class="wrap">
  <div class="sh"><div><span class="kick">Rated 8 or higher · Bought with my own money</span><h2>Boss Approved</h2></div><a href="#">All gear</a></div>
  <ul class="board">${D.picks.map((p, i) => `<li class="tile"><a href="#"><div class="rank">${i + 1}</div><div class="img"><img src="${p.image}" alt="" loading="lazy" /></div><p class="cat">${p.top ? 'Top pick · ' : ''}${esc(p.cat)}</p><h3>${esc(p.name)}</h3><div class="row"><span class="num">${p.rating}</span><span class="paid">Paid ${p.paid}</span></div></a></li>`).join('')}</ul>
</div></section>

<section class="sec"><div class="wrap">
  <div class="sh"><div><span class="kick">${D.topics.length} topics · 28 guides</span><h2>Guides</h2></div><a href="#">All guides</a></div>
  ${topicChips('')}
  ${leadGuide()}
  <div class="spot">
    <div class="head"><b>${esc(D.spotlight.cat)}</b><span>${D.spotlight.count} guides · See all</span></div>
    <ol>${[D.spotlight.lead, ...D.spotlight.rows].map((g, i) => `<li><span class="n">${i + 1}</span><img src="${g.image}" alt="" loading="lazy" /><div><b>${esc(g.title)}</b><span>${g.min} min read</span></div></li>`).join('')}</ol>
  </div>
</div></section>

<section class="sec"><div class="wrap">
  <div class="tools-mod">
    <div class="head"><b>Tools</b><span class="kick">Free · No sign-up wall for the first use</span></div>
    <div class="tools">${D.tools.map((t) => `<div class="tool"><span class="kick">${esc(t.kicker)}</span><h3>${esc(t.title)}</h3><p>${esc(t.blurb)}</p><a class="go" href="#">${esc(t.cta)} ${I.arrow}</a></div>`).join('')}</div>
  </div>
</div></section>

<section class="news"><div class="wrap"><div class="box">
  <div><h2>Boss Up<span>.</span></h2><p>One email a week. The newest review, the guide worth your time, and a straight answer to one question dads keep asking.</p></div>
  <form onsubmit="return false"><input type="email" placeholder="you@email.com" /><button class="btn" type="submit">Subscribe</button></form>
</div></div></section>

<section class="sec"><div class="wrap">
  <div class="sh"><div><span class="kick">Testing now</span><h2>On the bench</h2></div><a href="#">See the bench</a></div>
  <div class="bench"><ul>${D.bench.map((b) => `<li>${benchImg(b, 44)}<div><b>${esc(b.name)}</b><span class="c">${esc(b.cat)}</span></div><span class="st ${b.status === 'testing' ? 'hot' : ''}">${b.status === 'testing' ? 'Testing' : 'Queued'}</span></li>`).join('')}</ul></div>
</div></section>

<section class="about"><div class="wrap in">
  <div class="img"><img src="assets/hero-workshop-mobile.webp" alt="The Boss at the workbench" /></div>
  <div><span class="kick">About the Boss</span><blockquote>${esc(D.creed)}<span>That's ${esc(D.positioning)}.</span></blockquote><p class="sig">— The Boss</p>
  <div class="links"><a href="#">Meet the Boss ${I.arrow}</a><a href="#">How I test ${I.arrow}</a></div></div>
</div></section>

<section class="shop"><div class="wrap in"><b>Boss Stuff for Boss Dads<span>.</span></b><a class="btn" href="#">Shop the merch ${I.arrow}</a></div></section>
${footer()}
${bottomNav()}
</body></html>`
}

// ── Direction C — Showroom ───────────────────────────────────────────────────
const C_CSS = `
.mast .in{height:68px}
.brandstrip{border-bottom:1px solid var(--soft);font-family:Montserrat,system-ui,sans-serif;font-weight:800;font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:var(--faint);text-align:center;height:36px;display:flex;align-items:center;justify-content:center;gap:10px}
.brandstrip b{color:var(--text)}
.band{display:none}
@media(min-width:1024px){
  .brandstrip{display:none}
  .band{display:block;background:var(--chrome);color:#fff}
  .band .in{display:flex;align-items:center;justify-content:space-between;height:64px}
  .band .tag{font-family:Montserrat,system-ui,sans-serif;font-weight:900;font-size:22px;letter-spacing:-.02em}
  .band .tag span{color:var(--orange-hot)}
  .band .tick{display:flex;gap:28px;font-size:12px;color:#d4d4d8}
  .band .tick li{display:flex;align-items:center;gap:6px;min-width:0}
  .band .tick b{font-family:Montserrat,system-ui,sans-serif;font-weight:800;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:#f48a4a;white-space:nowrap}
  .band .tick span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:260px}
}
.sec{padding:40px 0}
@media(min-width:768px){.sec{padding:72px 0}}
.sec+.sec{border-top:1px solid var(--soft)}
.sh{margin-bottom:28px;display:flex;align-items:flex-end;justify-content:space-between;gap:16px}
.sh h2{font-weight:800;font-size:30px;letter-spacing:-.03em;line-height:1}
@media(min-width:768px){.sh h2{font-size:40px}}
.sh h2::before{content:"";display:block;width:40px;height:3px;background:var(--orange);margin-bottom:14px}
.sh a{font-family:Montserrat,system-ui,sans-serif;font-weight:700;font-size:14px;display:inline-flex;align-items:center;gap:6px;white-space:nowrap;padding-bottom:4px}
.btn{font-weight:700}
.cover-m{position:relative;margin:0 -20px;aspect-ratio:4/5;background:#18181b;overflow:hidden}
@media(min-width:640px){.cover-m{margin:0 -24px;aspect-ratio:16/10}}
.cover-m img{width:100%;height:100%;object-fit:cover}
.cover-m .scrim{position:absolute;inset:0;background:linear-gradient(to top,rgba(9,9,11,.94) 0%,rgba(9,9,11,.6) 38%,rgba(9,9,11,0) 68%)}
.cover-m .txt{position:absolute;left:20px;right:20px;bottom:22px;color:#fff;display:flex;gap:16px;align-items:flex-end;justify-content:space-between}
@media(min-width:640px){.cover-m .txt{left:24px;right:24px}}
.cover-m .kick{color:#f48a4a}
.cover-m h2{font-size:30px;line-height:1;letter-spacing:-.03em;margin-top:8px}
@media(min-width:640px){.cover-m h2{font-size:40px}}
.cover-m .paid{font-size:13px;color:#d4d4d8;margin-top:10px;font-weight:600}
.cover-d{display:none}
@media(min-width:1024px){.cover-m{display:none}.cover-d{display:grid;grid-template-columns:7fr 5fr;gap:48px;align-items:center}}
.cover-d .img{aspect-ratio:4/3;border-radius:8px;overflow:hidden;background:var(--sunken);display:block}
.cover-d .img img{width:100%;height:100%;object-fit:cover}
.cover-d h2{font-size:40px;line-height:1;letter-spacing:-.03em;margin-top:10px}
.cover-d p{font-size:17px;color:var(--muted);margin-top:16px;line-height:1.55}
.cover-d .meta{display:flex;align-items:center;gap:18px;margin-top:20px}
.cover-d .paid{font-size:13px;color:var(--muted);font-weight:600}
.cover-d .cta{margin-top:22px}
.below{display:grid;gap:28px;margin-top:22px}
@media(min-width:1024px){.below{grid-template-columns:1fr 1fr;gap:48px;margin-top:40px}}
.author{display:flex;gap:16px;align-items:center;padding:18px;border:1px solid var(--soft);border-radius:8px;align-self:start}
.author img{width:60px;height:60px;border-radius:50%;object-fit:cover;object-position:bottom;flex-shrink:0}
.author b{font-family:Montserrat,system-ui,sans-serif;font-weight:800;font-size:16px;display:block;letter-spacing:-.01em}
.author p{font-size:14px;color:var(--muted);margin-top:2px}
.author .btn{margin-left:auto;min-height:40px;padding:0 14px;font-size:13px}
.latest h3{font-family:Montserrat,system-ui,sans-serif;font-weight:800;font-size:12px;text-transform:uppercase;letter-spacing:.14em;color:var(--faint);margin-bottom:4px}
.latest li{padding:13px 0;border-bottom:1px solid var(--soft)}
.latest .k{font-size:11px;font-weight:700;color:var(--faint);text-transform:uppercase;letter-spacing:.1em}
.latest .t{font-weight:600;font-size:16px;line-height:1.35;margin-top:2px;display:block}
.ring{--p:90;width:72px;height:72px;border-radius:50%;background:conic-gradient(var(--orange-hot) calc(var(--p)*1%),rgba(255,255,255,.18) 0);display:grid;place-items:center;flex-shrink:0}
.ring span{width:calc(100% - 12px);height:calc(100% - 12px);border-radius:50%;background:var(--chrome);display:grid;place-items:center;font-family:Montserrat,system-ui,sans-serif;font-weight:900;font-size:22px;color:#fff}
.ring.light{background:conic-gradient(var(--orange) calc(var(--p)*1%),var(--soft) 0);width:88px;height:88px}
.ring.light span{background:#fff;color:var(--text);font-size:26px}
.ring.sm{width:40px;height:40px}
.ring.sm span{font-size:12px;width:calc(100% - 8px);height:calc(100% - 8px)}
.board{display:grid;grid-template-columns:1fr 1fr;gap:16px}
@media(min-width:768px){.board{grid-template-columns:repeat(4,1fr);gap:24px}}
.tile{border:1px solid var(--soft);border-radius:8px;padding:14px;display:flex;flex-direction:column;transition:border-color .15s}
.tile:hover{border-color:var(--text)}
.tile a{display:flex;flex-direction:column;flex:1}
.tile .img{aspect-ratio:1;overflow:hidden;border-radius:6px;background:#fff}
.tile .img img{width:100%;height:100%;object-fit:cover}
.tile .cat{margin-top:12px;font-size:11px;font-weight:700;color:var(--faint);text-transform:uppercase;letter-spacing:.1em}
.tile .cat.top{color:var(--orange-text)}
.tile h3{font-weight:700;font-size:15px;line-height:1.3;margin-top:4px;letter-spacing:-.01em;flex:1}
.tile .row{display:flex;align-items:center;justify-content:space-between;margin-top:12px}
.tile .paid{font-weight:700;font-size:15px}
.topics{display:flex;gap:8px;overflow-x:auto;scrollbar-width:none;margin-bottom:28px;padding-bottom:2px}
.topics::-webkit-scrollbar{display:none}
.topics a{white-space:nowrap;font-family:Montserrat,system-ui,sans-serif;font-weight:700;font-size:13px;padding:10px 14px;border:1px solid var(--strong);border-radius:8px}
.topics a.on{background:var(--text);color:#fff;border-color:var(--text)}
.lead-guide{display:grid;gap:18px;padding-bottom:36px;margin-bottom:36px;border-bottom:1px solid var(--soft)}
@media(min-width:768px){.lead-guide{grid-template-columns:3fr 2fr;gap:40px;align-items:center}}
.lead-guide .img{aspect-ratio:16/10;border-radius:8px;overflow:hidden;background:var(--sunken);display:block}
.lead-guide .img img{width:100%;height:100%;object-fit:cover}
.lead-guide h3{font-size:28px;line-height:1.05;letter-spacing:-.03em;margin-top:10px}
@media(min-width:768px){.lead-guide h3{font-size:36px}}
.lead-guide p{color:var(--muted);margin-top:12px;font-size:16px}
.spot .head{display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin-bottom:16px}
.spot .head b{font-family:Montserrat,system-ui,sans-serif;font-weight:800;font-size:20px;letter-spacing:-.02em}
.spot .head a{font-family:Montserrat,system-ui,sans-serif;font-weight:700;font-size:13px}
.spot ul{display:grid;gap:18px}
@media(min-width:768px){.spot ul{grid-template-columns:repeat(3,1fr);gap:24px}}
.spot li img{width:100%;aspect-ratio:16/10;object-fit:cover;border-radius:6px;background:var(--sunken)}
.spot li b{font-family:Montserrat,system-ui,sans-serif;font-weight:800;font-size:16px;line-height:1.25;display:block;margin-top:10px;letter-spacing:-.01em}
.spot li span{font-size:12px;color:var(--faint);display:block;margin-top:4px}
.tools-band{background:var(--chrome);color:#fff;padding:44px 0;border-top:3px solid var(--orange-hot)}
@media(min-width:768px){.tools-band{padding:72px 0}}
.tools-band .sh h2{color:#fff}
.tools-band .sh h2::before{background:var(--orange-hot)}
.tools-band .sh a{color:#fff}
.tools{display:grid;gap:28px}
@media(min-width:768px){.tools{grid-template-columns:repeat(3,1fr);gap:40px}}
.tool .kick{color:#f48a4a}
.tool h3{font-size:24px;line-height:1.05;letter-spacing:-.03em;margin-top:10px;color:#fff}
.tool p{color:#a1a1aa;font-size:15px;margin-top:12px;line-height:1.55}
.tool a.go{display:inline-flex;align-items:center;gap:6px;margin-top:14px;font-family:Montserrat,system-ui,sans-serif;font-weight:700;font-size:14px;color:#fff;min-height:44px}
.tool a.go:hover{color:#f48a4a}
.news{padding:48px 0;text-align:center;border-top:1px solid var(--soft)}
@media(min-width:768px){.news{padding:80px 0}}
.news h2{font-size:40px;letter-spacing:-.04em;line-height:.95}
@media(min-width:768px){.news h2{font-size:56px}}
.news h2 span{color:var(--orange)}
.news p{color:var(--muted);font-size:16px;margin-top:12px}
.news form{display:flex;gap:8px;max-width:520px;margin:24px auto 0}
.news input{flex:1;min-width:0;min-height:48px;border:1px solid var(--strong);border-radius:8px;padding:0 16px;font-size:15px;font-family:inherit}
.rail{display:flex;gap:14px;overflow-x:auto;scrollbar-width:none;margin:0 -20px;padding:0 20px 4px}
.rail::-webkit-scrollbar{display:none}
@media(min-width:640px){.rail{margin:0 -24px;padding:0 24px 4px}}
@media(min-width:768px){.rail{display:grid;grid-template-columns:repeat(6,1fr);gap:20px;margin:0;padding:0;overflow:visible}}
.rail li{flex:0 0 150px;border:1px solid var(--soft);border-radius:8px;padding:12px}
.rail li img,.rail li .ph{width:100%;aspect-ratio:1;height:auto;object-fit:cover;border-radius:6px;background:#fff}
.rail .st{display:flex;align-items:center;gap:6px;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.12em;color:var(--faint);margin-top:10px;font-family:Montserrat,system-ui,sans-serif}
.rail .st::before{content:"";width:7px;height:7px;border-radius:50%;background:var(--strong);flex-shrink:0}
.rail .st.hot{color:var(--orange-text)}.rail .st.hot::before{background:var(--orange)}
.rail b{font-weight:700;font-size:13px;line-height:1.3;display:block;margin-top:4px}
.about{background:var(--chrome);color:#fff;padding:48px 0}
@media(min-width:768px){.about{padding:80px 0}}
.about .in{display:grid;gap:28px}
@media(min-width:768px){.about .in{grid-template-columns:2fr 3fr;gap:64px;align-items:center}}
.about .img{aspect-ratio:4/5;overflow:hidden;border-radius:8px;background:#27272a}
.about .img img{width:100%;height:100%;object-fit:cover;object-position:bottom}
.about .kick{color:#f48a4a}
.about blockquote{font-family:Fraunces,Georgia,serif;font-weight:600;font-size:26px;line-height:1.25;margin-top:18px;letter-spacing:-.01em}
@media(min-width:768px){.about blockquote{font-size:36px}}
.about blockquote span{display:block;color:var(--orange-hot);margin-top:12px}
.about .sig{margin-top:20px;font-family:Montserrat,system-ui,sans-serif;font-weight:800;font-size:11px;text-transform:uppercase;letter-spacing:.16em;color:#71717a}
.about .links{display:flex;gap:10px;margin-top:26px;flex-wrap:wrap}
.about .btn{background:var(--orange-hot);color:#fff}
.about .btn:hover{background:#fff;color:var(--chrome)}
.about .btn.line{background:transparent;color:#fff;border-color:#fff}
.about .btn.line:hover{background:#fff;color:var(--chrome)}
.shop{background:var(--raised);padding:36px 0;border-top:1px solid var(--soft)}
.shop .in{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap}
.shop b{font-family:Montserrat,system-ui,sans-serif;font-weight:800;font-size:22px;letter-spacing:-.02em}
`

function renderC() {
  const f = D.featured
  return head('Direction C — Showroom · Boss Daddy', C_CSS) + `
<div class="dirnote"><b>DIRECTION C · SHOWROOM</b> — loud through scale · Brickell / STIHL product pages · strongest on premium and clean</div>
${masthead('c')}
<div class="brandstrip"><b>${esc(D.tagline)}</b> · ${esc(D.positioning)}</div>
<div class="band"><div class="wrap in"><span class="tag">Dad Like a <span>Boss.</span></span><ul class="tick">${D.motion.map((m) => `<li><b>${esc(m.label)}</b><span>${esc(m.title)}</span></li>`).join('')}</ul></div></div>

<section class="sec" style="padding-top:0"><div class="wrap">
  <article class="cover-m">
    <img src="${f.image}" alt="" />
    <div class="scrim"></div>
    <div class="txt"><div><span class="kick">Featured review · ${esc(f.cat)}</span><h2>${esc(f.product)}</h2><p class="paid">Paid ${f.paid} · ${f.date}</p></div><div class="ring" style="--p:${f.pct}"><span>${f.rating}</span></div></div>
  </article>
  <article class="cover-d" style="padding-top:56px">
    <a class="img" href="#"><img src="${f.image}" alt="" /></a>
    <div>
      <span class="kick">Featured review · ${esc(f.cat)}</span>
      <h2>${esc(f.title)}</h2>
      <p>${esc(f.excerpt)}</p>
      <div class="meta"><div class="ring light" style="--p:${f.pct}"><span>${f.rating}</span></div><div><p class="paid">Paid ${f.paid}</p><p class="paid">${f.date} · Boss Approved</p></div></div>
      <div class="cta"><a class="btn" href="#">Read the review ${I.arrow}</a></div>
    </div>
  </article>
  <div class="below">
    <div class="author"><img src="assets/hero-workshop-mobile.webp" alt="" /><div><b>The Boss</b><p>Founder. Buys what he reviews. Zero paid placements.</p></div><a class="btn line" href="#">How I test</a></div>
    <aside class="latest"><h3>Latest</h3><ol>${D.latest.map((l) => `<li><span class="k">${l.kind}</span><a class="t" href="#">${esc(l.title)}</a></li>`).join('')}</ol></aside>
  </div>
</div></section>

<section class="sec"><div class="wrap">
  <div class="sh"><h2>Boss Approved</h2><a href="#">All gear ${I.arrow}</a></div>
  <ul class="board">${D.picks.map((p) => `<li class="tile"><a href="#"><div class="img"><img src="${p.image}" alt="" loading="lazy" /></div><p class="cat ${p.top ? 'top' : ''}">${p.top ? 'Top pick · ' : ''}${esc(p.cat)}</p><h3>${esc(p.name)}</h3><div class="row"><span class="paid">${p.paid}</span><div class="ring light sm" style="--p:${Math.round(parseFloat(p.rating) * 10)}"><span>${p.rating}</span></div></div></a></li>`).join('')}</ul>
</div></section>

<section class="sec"><div class="wrap">
  <div class="sh"><h2>Guides</h2><a href="#">All guides ${I.arrow}</a></div>
  ${topicChips('')}
  ${leadGuide()}
  <div class="spot">
    <div class="head"><b>${esc(D.spotlight.cat)}</b><a href="#">${D.spotlight.count} guides ${I.arrow}</a></div>
    <ul>${[D.spotlight.lead, ...D.spotlight.rows].slice(0, 3).map((g) => `<li><a href="#"><img src="${g.image}" alt="" loading="lazy" /><b>${esc(g.title)}</b><span>${g.min} min read</span></a></li>`).join('')}</ul>
  </div>
</div></section>

<section class="tools-band"><div class="wrap">
  <div class="sh"><h2>Tools</h2><a href="#">All tools ${I.arrow}</a></div>
  <div class="tools">${D.tools.map((t) => `<div class="tool"><span class="kick">${esc(t.kicker)}</span><h3>${esc(t.title)}</h3><p>${esc(t.blurb)}</p><a class="go" href="#">${esc(t.cta)} ${I.arrow}</a></div>`).join('')}</div>
</div></section>

<section class="news"><div class="wrap">
  <h2>Boss Up<span>.</span></h2><p>One email a week. The newest review, the guide worth your time, and a straight answer to one question dads keep asking.</p>
  <form onsubmit="return false"><input type="email" placeholder="you@email.com" /><button class="btn" type="submit">Subscribe</button></form>
</div></section>

<section class="sec"><div class="wrap">
  <div class="sh"><h2>On the bench</h2><a href="#">See the bench ${I.arrow}</a></div>
  <ul class="rail">${D.bench.map((b) => `<li>${benchImg(b, 0)}<span class="st ${b.status === 'testing' ? 'hot' : ''}">${b.status === 'testing' ? 'Testing' : 'Queued'}</span><b>${esc(b.name)}</b></li>`).join('')}</ul>
</div></section>

<section class="about"><div class="wrap in">
  <div class="img"><img src="assets/hero-workshop-mobile.webp" alt="The Boss at the workbench" /></div>
  <div><span class="kick">About the Boss</span><blockquote>${esc(D.creed)}<span>That's ${esc(D.positioning)}.</span></blockquote><p class="sig">— The Boss</p>
  <div class="links"><a class="btn" href="#">Meet the Boss</a><a class="btn line" href="#">How I test</a></div></div>
</div></section>

<section class="shop"><div class="wrap in"><b>Boss Stuff for Boss Dads</b><a class="btn" href="#">Shop the merch ${I.arrow}</a></div></section>
${footer()}
${bottomNav()}
</body></html>`
}

// ── Index ────────────────────────────────────────────────────────────────────
function renderIndex() {
  const css = `
body{padding:0 0 60px}
.hero{background:var(--chrome);color:#fff;padding:36px 0}
.hero h1{font-size:28px;letter-spacing:-.03em}
.hero p{color:#a1a1aa;margin-top:8px;max-width:60ch}
.grid{display:grid;gap:16px;margin-top:28px}
@media(min-width:768px){.grid{grid-template-columns:repeat(3,1fr)}}
.card{border:1px solid var(--soft);border-radius:8px;padding:20px;display:flex;flex-direction:column;gap:10px}
.card .kick{color:var(--orange-text)}
.card h2{font-size:22px;letter-spacing:-.02em}
.card p{font-size:14px;color:var(--muted)}
.card .btn{align-self:flex-start;margin-top:auto}
.brief{margin-top:36px;border-top:3px solid var(--text);padding-top:18px}
.brief h2{font-size:18px;margin-bottom:10px}
.brief table{border-collapse:collapse;width:100%;font-size:14px}
.brief td{padding:8px 10px 8px 0;border-bottom:1px solid var(--soft);vertical-align:top}
.brief td:first-child{font-weight:700;white-space:nowrap;width:120px}
.how{margin-top:28px;font-size:14px;color:var(--muted)}
.how code{font-family:ui-monospace,Menlo,monospace;background:var(--sunken);padding:2px 6px;border-radius:4px;color:var(--text)}
`
  return head('Boss Daddy — design directions (Step 2)', css) + `
<div class="hero"><div class="wrap"><span class="kick" style="color:#f48a4a">Design-commit process · Step 2 · 2026-10-13</span><h1>Three directions, one brief</h1><p>Light canvas, louder, two lanes, premium / clean / rugged. Same real content, same settled page structure. What changes is the loudness mechanism and how the utility lane (tools, bench, author) is treated. Open each on your phone first.</p></div></div>
<div class="wrap">
  <div class="grid">
    <div class="card"><span class="kick">Direction A</span><h2>Hard Goods</h2><p>Loud through <b>blocks</b>. Solid black and orange panels for the utility lane, grey product tiles, thick rules, square corners. STIHL and DeWalt. Strongest on rugged.</p><p><b>Mobile band:</b> a 56px orange stripe.</p><a class="btn" href="a-hard-goods.html">Open A</a></div>
    <div class="card"><span class="kick">Direction B</span><h2>Newsstand</h2><p>Loud through <b>type and density</b>. Oversized black headlines, orange kickers, ranked lists, ruled modules. Men's Health and AppleInsider. Strongest on authority.</p><p><b>Mobile band:</b> none. The tagline folds into the masthead; a category row sits under it.</p><a class="btn" href="b-newsstand.html">Open B</a></div>
    <div class="card"><span class="kick">Direction C</span><h2>Showroom</h2><p>Loud through <b>scale</b>. Full-bleed cover on the phone, showroom product tiles, one black tools band, generous space. Brickell and STIHL product pages. Strongest on premium and clean.</p><p><b>Mobile band:</b> a hairline brand strip; the cover photo is the first screen.</p><a class="btn" href="c-showroom.html">Open C</a></div>
  </div>
  <div class="brief"><h2>Step 4 refinements (2026-10-14)</h2>
  <p style="font-size:14px;color:var(--muted);margin-bottom:14px">His Step 2 read: <b>Hard Goods wins</b> on colour and contrast, all three beat the current site, but on the phone A's black masthead plus orange stripe read as two nav bands. He liked Newsstand's masthead handling. Two ways to fix it, both keeping A's desktop orange band and ticker:</p>
  <div class="grid" style="margin-top:0">
    <div class="card"><span class="kick">A2</span><h2>Folded masthead</h2><p>The tagline sits under the logo as a small orange signature, and a topics row scrolls beneath the masthead. One band. Brand as a signature.</p><a class="btn" href="a2-hard-goods-folded.html">Open A2</a></div>
    <div class="card"><span class="kick">A3</span><h2>Masthead as band</h2><p>A tagline row in orange type fuses into the black masthead with the 4px orange rule under it, then the topics row. Still one band, taller. Brand as a statement.</p><a class="btn" href="a3-hard-goods-fused.html">Open A3</a></div>
  </div></div>
  <div class="brief"><h2>The locked brief</h2><table>
    <tr><td>Canvas</td><td>Light. White page, near-black text. Decided, not reopened.</td></tr>
    <tr><td>Volume</td><td>Louder than shipped. Solid black and orange moments on the white page, never a dark canvas.</td></tr>
    <tr><td>Feel</td><td>Premium, clean, rugged.</td></tr>
    <tr><td>Lanes</td><td>Editorial surfaces are type-led and photo-led. Utility and product surfaces (tools, bench, radar, author) are tool-like and heavier. That is where the dark and orange moments live.</td></tr>
    <tr><td>Type</td><td>Montserrat heavy, sans only. Fraunces stays the Creed.</td></tr>
    <tr><td>Accent</td><td>One orange, in solid blocks as well as rules. Black is the second color.</td></tr>
    <tr><td>Out</td><td>Dark canvas, reader toggle, serif headlines, warm tints, per-category color.</td></tr>
  </table></div>
  <p class="how">Serve this folder and open it on the phone over the LAN: <code>npx -y serve docs/mockups/directions -l 3100</code> then <code>http://&lt;your-LAN-IP&gt;:3100/</code>. Images come from the live storage bucket, fonts from Google Fonts, so the phone needs internet.</p>
</div>
</body></html>`
}

writeFileSync(join(OUT, 'index.html'), renderIndex())
writeFileSync(join(OUT, 'a-hard-goods.html'), renderA('a'))
writeFileSync(join(OUT, 'a2-hard-goods-folded.html'), renderA('a2'))
writeFileSync(join(OUT, 'a3-hard-goods-fused.html'), renderA('a3'))
writeFileSync(join(OUT, 'b-newsstand.html'), renderB())
writeFileSync(join(OUT, 'c-showroom.html'), renderC())
console.log('wrote index + A + B + C to', OUT)
