# Pillar Taxonomy & Tag Governance

> **Authoritative source for how content is filed.** When a review, guide, or product
> could plausibly live in more than one pillar, this doc decides. Update it when the
> boundaries move — do **not** re-litigate placement per-piece.
>
> Pillars (10) are defined in `lib/categories.ts` — 8 gear pillars plus two non-gear essay
> pillars, **Table Duty** (timeless) and **Watch Duty** (timely). Tags live in the `tags` table
> (migrations 041, 047, 121, and 127 — which adds the tier hierarchy). Display labels route
> through `lib/labels.ts` per the Naming Doctrine — this doc governs *meaning*, not wording.

---

## 1. The model in one sentence

**Every piece has exactly one canonical pillar (its home) + unlimited tags for everything
cross-cutting.** Additional relevance is expressed with tags and cross-links — never with a
second primary pillar.

This is the standard content/commerce shape (Wirecutter, The Verge, REI, Amazon): one
canonical shelf drives the URL, breadcrumb, and SEO; facets/tags handle the rest. Letting a
piece have two equal homes ("polyhierarchy") breaks canonical URLs, creates duplicate-content
SEO problems, and makes breadcrumbs ambiguous. We don't do it.

**Tags are organized as a 3-tier subject hierarchy** (pillar → subject group → leaf) plus
separate cross-cutting facets — see §8 for the schema. The hierarchy structures the *vocabulary*;
it does **not** create second homes. A piece still has exactly one canonical pillar.

---

## 2. The Prime Rule — "What job is the reader doing?"

When a piece feels like it fits several pillars, don't ask *"what is this product?"* — ask
**"what job is the reader doing when they reach for it?"** The job picks the pillar.

| Pillar | The reader's job |
|---|---|
| **Kids & Family** | Raising / caring for a kid |
| **Tools & DIY** | Building, repairing, or making something with tools |
| **Grilling & Cooking** | Making a meal (indoor or outdoor) |
| **Outdoors & Adventure** | **Recreation away from home** — camping, hiking, fishing, adventure |
| **Tech & EDC** | Staying productive/prepared with gadgets & everyday carry |
| **Vehicles & Garage** | Owning, driving, or maintaining a vehicle |
| **Health & Wellness** | Taking care of body & mind |
| **Home & Lifestyle** | **Maintaining the house & property** — including the yard/lawn |
| **Table Duty** | **Thinking through the big questions** — meaning, faith, culture, duty (timeless) |
| **Watch Duty** | **Reacting to what's happening now** — current events at the family table (timely) |

The two boundaries that cause the most collisions are bolded: **Outdoors is recreation away
from home; Home & Lifestyle owns property upkeep (yard included).** See §4.

---

## 3. Per-pillar scope

Each pillar below lists **what belongs**, **what does NOT**, and where the near-misses route.

### Kids & Family — `kids-family`
- **Belongs:** baby/toddler gear, parenting tools, gear tested by/for kids.
- **Not:** a family SUV (→ Vehicles), a family tent (→ Outdoors), kids' vitamins framed as
  wellness (→ Health & Wellness). Family *context* doesn't make it a Kids pick — the *job* does.

### Tools & DIY — `tools-diy`
- **Belongs:** power tools, hand tools, home-repair and building projects, workshop/storage.
- **Not:** **lawn & yard care** (→ Home & Lifestyle — see §4), automotive tools used for vehicle
  maintenance (→ Vehicles & Garage), kitchen knives (→ Grilling & Cooking).
- The job is *building/repairing with tools*, not ongoing property maintenance.

### Grilling & Cooking — `grilling-cooking`
- **Belongs:** grills, smokers, knives, cookware, kitchen gadgets — indoor and outdoor cooking.
- **Not:** camp stoves framed around a camping trip (→ Outdoors, tag `outdoor-cooking`), kitchen
  furniture/organization (→ Home & Lifestyle).

### Outdoors & Adventure — `outdoors-adventure`
- **Belongs:** camping, hiking, fishing, hunting, water sports — **recreation away from home.**
- **Not:** yard/garden gear used at home (→ Home & Lifestyle), truck overlanding accessories
  (→ Vehicles & Garage, tag as needed), backyard grilling (→ Grilling & Cooking).
- Litmus test: *do you leave the property to use it for fun?* If not, it's probably Home.

### Tech & EDC — `tech-edc`
- **Belongs:** gadgets, everyday carry (wallets, knives, flashlights, watches, bags, earbuds,
  chargers), smart-home tech, wearables, audio.
- **Not:** physical home goods/furniture (→ Home & Lifestyle — the *smart-home* split lives here,
  the *furniture* split lives there), vehicle electronics bolted to a truck (→ Vehicles & Garage).

### Vehicles & Garage — `vehicles-garage`
- **Belongs:** cars/trucks/motorcycles, maintenance, detailing, truck accessories, overlanding,
  garage tools used *on vehicles*.
- **Not:** general power tools (→ Tools & DIY), a portable power station used mainly for camping
  (→ Outdoors) or the house (→ Home & Lifestyle). Tag `automotive`/`truck-gear` for cross-cut.

### Health & Wellness — `health-wellness`
- **Belongs:** fitness gear, supplements, sleep, mental health, mindfulness, personal growth, faith
  as it relates to wellbeing.
- **Not:** a smartwatch reviewed as a gadget (→ Tech & EDC, tag `wearables`), a bike reviewed as
  outdoor recreation (→ Outdoors).

### Home & Lifestyle — `home-lifestyle`
- **Belongs:** furniture, organization, comfort, appliances, cleaning, **and all lawn/yard/garden
  property maintenance** (mowing, weeds, watering, outdoor cleaning).
- **Not:** the *smart-home/tech* layer (→ Tech & EDC), building projects with tools (→ Tools & DIY).
- This is the catch-all for "maintaining the place you live." If a job is done *to the house or
  yard* and isn't a build project or a gadget, it lands here.

### Table Duty — `table-duty`  *(non-gear / essay pillar)*
- **Belongs:** timeless discussion of meaning & purpose, faith & doubt, culture & media,
  citizenship & duty, and the tough talks (death, money, sex, failure). Essays and
  thought-experiments, not gear.
- **Not:** a product review (→ its gear pillar), a timely news reaction (→ Watch Duty).
- **Voice:** the student-first, Socratic *inquiry register* — see brand-guide §1.6. Never the
  confident reviewer voice. Every piece answers: *why does this matter at the family table?*

### Watch Duty — `watch-duty`  *(non-gear / essay pillar)*
- **Belongs:** timely current events — family impact, cultural shifts, policy & power, technology
  & screens, safety & security, generational stakes — read through the family-table lens.
- **Not:** timeless reflection (→ Table Duty), a product review (→ its gear pillar).
- **Freshness:** pieces stay prominent ~2–6 weeks, then archive or grow into a Table Duty essay.
- **Voice:** same inquiry register as Table Duty. High bar: if it doesn't move fathers, kids, or
  the future, it doesn't run. A Watch Duty piece may also carry a cross-cutting subject tag.

---

## 4. The yard / lawn / garden decision (settled)

Historically "yard maintenance" appeared in the Tools & DIY description, "property" in Home &
Lifestyle, and "outside" in Outdoors — so lawn gear felt like a 3-way tie. **Settled:**

> **Lawn, yard, and garden property maintenance is Home & Lifestyle.** Tag it `yard-work`
> (already in the taxonomy) and `watering` where relevant.

Rationale via the Prime Rule: weeding, mowing, and watering are *maintaining your property* —
the Home & Lifestyle job. Outdoors is recreation you leave home for; Tools & DIY is building with
tools. The phrase "yard maintenance" has been removed from the Tools & DIY description to stop
manufacturing the collision.

**Worked examples:**

| Piece | Canonical pillar | Tags | Cross-link from |
|---|---|---|---|
| *Beginner's guide to getting rid of crabgrass* | Home & Lifestyle | `yard-work` | any Tools or Outdoors piece |
| *Fanhao garden hose nozzle review* | Home & Lifestyle | `yard-work`, `watering` | Vehicles (car wash), Outdoors (camp water) |

Neither needs a second pillar. The tags carry the cross-cutting signal; cross-link tokens
(`[[REVIEW:]]` / `[[GUIDE:]]`) carry the editorial "see also."

---

## 5. Expressing cross-pillar relevance (without a second home)

Three tools, in order of preference:

1. **Tags** — a piece may carry topic tags conceptually associated with *other* pillars. The
   hose nozzle lives in Home but tagging `watering` surfaces it in that facet feed regardless of
   pillar. This is the primary mechanism.
2. **Cross-link tokens** — `[[REVIEW:slug]]` / `[[GUIDE:slug]]` render a ContentLinkCard for
   editorial "see also." Use when another piece is genuinely the next thing to read.
3. **Collections** — for a curated set that spans pillars (e.g. "Dad's first apartment kit").

If you're ever tempted to set a second primary pillar: don't. Pick the home by the Prime Rule
and reach for one of the three above.

---

## 6. Tag taxonomy governance

Tags are a **curated controlled vocabulary, not an open folksonomy.** The whole value of a tag
is that it's the *same* slug everywhere — free-text creation produces synonyms (`lawn` vs
`lawn-care` vs `yard`) and dead-end pages, which destroys navigation and hurts SEO.

**Rules:**

1. **Authors select; only admin mints.** The `TagPicker` lets authors choose from presets. New
   tags are added by admin through one controlled surface (the `tags` table, via migration or an
   admin Tags manager) — never inline during authoring.
2. **Slug is stable forever; label is free.** `tags.slug` is an internal name (Naming Doctrine —
   never rename). `tags.label` is display and can change anytime. Adding a tag = `INSERT` a row.
3. **Every tag is a promise to fill.** Only create a tag you'll have **≥3 pieces** for soon. Tag
   pages are in the sitemap — a thin/empty tag page is an SEO liability and advertises how little
   sits behind it (see the no-vanity-metrics rule). Prune tags that stay empty.
4. **AI suggests from presets only.** Draft generation *proposes* tags, but every suggestion is
   validated server-side against the live `tags` table (`draft` / `guide-draft` routes) before it
   reaches the client — a hallucinated or stale slug is dropped. Suggestions are pre-attached to
   the **draft** (unpublished) for the author to curate in the workspace TagPicker before
   publishing. The model never invents tags that survive validation.
5. **`tag_group` is fixed:** `life-stage`, `price`, `use-case`, `editorial`, `topic`, `audience`.
   New groups are a schema decision, not an authoring one.

**Requesting a new tag:** an author who needs a missing tag requests it → admin adds it once →
everyone uses the same slug. Keep the batch deliberate; expand against real + planned content,
not a generic mega-taxonomy import.

---

## 7. Known taxonomy debt (cleanup candidates, not urgent)

- The pillar-organization consolidation (once deferred here) **shipped in migration 127**: every
  `topic` tag now carries a `category_slug` (its pillar) and, where nested, a `parent_slug`. Some
  historical overlap remains benign (`home-improvement` as a Tier-2 sibling of `power-tools`/
  `hand-tools`) — prune with real usage data, don't churn now.
- Products are taggable via `product_tags` (mig 122); merch (table `merch`, renamed from
  shop_products in mig 033) via `merch_tags` (mig 127).
  Backfill product tags from a linked review's tags where a review exists.
- Every tag is a **promise to fill (≥3 pieces)**. The full tier build was seeded against committed
  planned content (all pillars/groups get content soon). Prune any group/leaf that stays empty.

---

## 8. Subject hierarchy & facets (the tag model)

As of migration 127 the `tags` vocabulary is a **3-tier subject tree plus separate facets**. This
organizes the *vocabulary*; it does not change §1 — a piece still has exactly one canonical pillar
(its `category`).

**Tiers (only `tag_group = 'topic'` tags):**
- **Tier 1 — Pillar:** the 10 categories in `lib/categories.ts`. NOT a tag row; a tag points at
  its pillar via `category_slug`.
- **Tier 2 — Subject group:** a topic tag with `parent_slug = NULL` and `category_slug = <pillar>`
  (e.g. `baby-gear`, `kitchen-tools`, `meaning-purpose`).
- **Tier 3 — Leaf:** a topic tag with `parent_slug = <group>` (e.g. `strollers` under `baby-gear`,
  `cast-iron` under `kitchen-tools`).
- **Cross-cutting subject:** a topic tag with `category_slug = NULL` — belongs to no single pillar
  and surfaces across many. Current set: `faith` (also anchors Table Duty), `storage-org`,
  `smart-home`, `backup-power`, `safety-first-aid`.

**Facets (every non-`topic` group)** cut across all pillars and answer *how / who / how much /
stance* — never mixed into the subject tree:
`life-stage`, `price`, `use-case`, `editorial`, and **`audience`** (`first-time-dad`).

`category_slug` is a plain TEXT pointer to a code-defined pillar — intentionally not a FK/CHECK
(Naming Doctrine: pillars are owned by `lib/categories.ts`, not the DB). Build the pillar → group
→ leaf tree with `buildTagTree()` in `lib/tags.ts`.
