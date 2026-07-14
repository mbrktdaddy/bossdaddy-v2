# Pillar Taxonomy & Tag Governance

> **Authoritative source for how content is filed.** When a review, guide, or product
> could plausibly live in more than one pillar, this doc decides. Update it when the
> boundaries move — do **not** re-litigate placement per-piece.
>
> Pillars are defined in `lib/categories.ts`. Tags live in the `tags` table (migrations
> 041, 047, and later seeds). Display labels route through `lib/labels.ts` per the
> Naming Doctrine — this doc governs *meaning*, not wording.

---

## 1. The model in one sentence

**Every piece has exactly one canonical pillar (its home) + unlimited tags for everything
cross-cutting.** Additional relevance is expressed with tags and cross-links — never with a
second primary pillar.

This is the standard content/commerce shape (Wirecutter, The Verge, REI, Amazon): one
canonical shelf drives the URL, breadcrumb, and SEO; facets/tags handle the rest. Letting a
piece have two equal homes ("polyhierarchy") breaks canonical URLs, creates duplicate-content
SEO problems, and makes breadcrumbs ambiguous. We don't do it.

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
5. **`tag_group` is fixed:** `life-stage`, `price`, `use-case`, `editorial`, `topic`. New groups
   are a schema decision, not an authoring one.

**Requesting a new tag:** an author who needs a missing tag requests it → admin adds it once →
everyone uses the same slug. Keep the batch deliberate; expand against real + planned content,
not a generic mega-taxonomy import.

---

## 7. Known taxonomy debt (cleanup candidates, not urgent)

- `topic` tags aren't consistently pillar-organized. 041 seeded broad ones (`home-improvement`,
  `workshop`, `yard-work`, `automotive`…); 047 added pillar-grouped ones (`power-tools`,
  `hand-tools`, `camping`…). Some overlap (`home-improvement` vs `power-tools`/`hand-tools`).
  Worth a consolidation pass once tag usage data exists — don't guess now.
- Products became taggable via `product_tags` (migration adding it) — backfill product tags from
  their linked review's tags where a review exists.
