#!/usr/bin/env node
/**
 * codemod-role-tokens.mjs
 * Converts raw Tailwind color classes → semantic role tokens.
 *
 * Usage:
 *   node scripts/codemod-role-tokens.mjs --dry-run   # preview only
 *   node scripts/codemod-role-tokens.mjs             # write files
 *
 * Scope: all app/ and components/ TSX/TS files.
 *
 * What it converts (safe/unambiguous):
 *   orange-400/600  → accent-text-soft / accent
 *   orange-500      → text-eyebrow (if uppercase+tracking context) or text-accent-text
 *   orange-500/600  → bg-accent-hover / bg-accent, border-accent, ring-accent
 *   orange-800-950  → bg-accent-tint (opacity preserved)
 *   orange-700-950  → border-accent-border (opacity preserved)
 *   neutral/gray 950/900/800 → surface-sunken / surface / surface-raised
 *   neutral/gray text 100-200 → text-prose
 *   neutral/gray text 400     → text-prose-muted
 *   neutral/gray text 500-600 → text-prose-faint
 *   neutral/gray border 700-800 → border-strong / border-soft
 *
 * What it SKIPS (ambiguous / light-surface contexts):
 *   neutral-50/100/200/300 bg — light surfaces, needs manual review
 *   neutral-700+ text — dark text on light bg
 *   neutral-600+ border — check manually
 *   stone-*, zinc-* — low usage, manual
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, extname } from 'path';

const DRY_RUN = process.argv.includes('--dry-run');
const ROOT = process.cwd();

// Discover all .tsx/.ts files under app/ and components/, excluding generated dirs.
function findFiles(dir, exts = ['.tsx', '.ts']) {
  const results = [];
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return results; }
  for (const e of entries) {
    if (['.next', 'node_modules', 'out', 'build'].includes(e.name)) continue;
    const full = join(dir, e.name);
    if (e.isDirectory()) results.push(...findFiles(full, exts));
    else if (exts.includes(extname(e.name))) results.push(full);
  }
  return results;
}

const FILES = [
  ...findFiles(join(ROOT, 'app')),
  ...findFiles(join(ROOT, 'components')),
  ...findFiles(join(ROOT, 'lib')),
].map(f => f.replace(ROOT + '\\', '').replace(ROOT + '/', ''));

// Legacy explicit list kept as reference — dynamic discovery above supersedes it.
const _LEGACY_FILES = [
  'app/(public)/_components/CodeRedirect.tsx',
  'app/(public)/_components/LatestGuidesSection.tsx',
  'app/(public)/reviews/[slug]/loading.tsx',
  'app/(public)/reviews/[slug]/page.tsx',
  'app/(public)/reviews/_components/ReviewsGrid.tsx',
  'app/(public)/reviews/_components/ReviewCard.tsx',
  'app/(public)/reviews/actions.ts',
  'app/(public)/reviews/page.tsx',
  'app/(public)/reviews/category/[slug]/page.tsx',
  'app/(public)/reviews/tag/[slug]/page.tsx',
  'app/(public)/guides/[slug]/loading.tsx',
  'app/(public)/guides/[slug]/page.tsx',
  'app/(public)/guides/_components/GuidesGrid.tsx',
  'app/(public)/guides/_components/GuideCard.tsx',
  'app/(public)/guides/actions.ts',
  'app/(public)/guides/page.tsx',
  'app/(public)/guides/category/[slug]/page.tsx',
  'app/(public)/guides/tag/[slug]/page.tsx',
  'app/(public)/bench/[slug]/loading.tsx',
  'app/(public)/bench/[slug]/page.tsx',
  'app/(public)/bench/page.tsx',
  'app/(public)/gear/_components/MerchPanel.tsx',
  'app/(public)/gear/[slug]/page.tsx',
  'app/(public)/gear/[slug]/_components/AddToCartForm.tsx',
  'app/(public)/gear/page.tsx',
  'app/(public)/picks/page.tsx',
  'app/(public)/picks/[slug]/page.tsx',
  'app/(public)/stacks/page.tsx',
  'app/(public)/stacks/[slug]/page.tsx',
  'app/(public)/comparisons/page.tsx',
  'app/(public)/comparisons/[slug]/page.tsx',
  'app/(public)/gifts/page.tsx',
  'app/(public)/gifts/[occasion]/page.tsx',
  'app/(public)/category/[slug]/page.tsx',
  'app/(public)/search/page.tsx',
  'app/(public)/author/[username]/page.tsx',
  'app/(public)/about/page.tsx',
  'app/(public)/how-we-test/page.tsx',
  'app/(public)/editorial-standards/page.tsx',
  'app/(public)/affiliate-disclosure/page.tsx',
  'app/(public)/privacy-policy/page.tsx',
  'app/(public)/terms/page.tsx',
  'app/(public)/vault/page.tsx',
  'app/(public)/cart/page.tsx',
  'app/(public)/cart/_components/CartItems.tsx',
  'app/(public)/order/[id]/page.tsx',
  'app/(public)/order/[id]/_components/OrderPoller.tsx',
  'app/(public)/order/[id]/_components/CartClearer.tsx',
  'app/(public)/account/blocked/page.tsx',
  'app/(public)/loading.tsx',
  'app/(public)/layout.tsx',
  'app/(public)/page.tsx',
  'app/(auth)/login/page.tsx',
  'app/(auth)/register/page.tsx',
  'app/(auth)/forgot-password/page.tsx',
  'app/(auth)/reset-password/page.tsx',
  'app/(auth)/layout.tsx',
  // Root-level components
  'components/Header.tsx',
  'components/Footer.tsx',
  'components/BenchStrip.tsx',
  'components/InMotionTicker.tsx',
  'components/HeroCarousel.tsx',
  'components/FeaturedReviewCard.tsx',
  'components/FeaturedGuideCard.tsx',
  'components/FeaturedMerchCard.tsx',
  'components/HomepageMerchStrip.tsx',
  'components/MerchCallout.tsx',
  'components/MerchImageGallery.tsx',
  'components/ProductCtaCard.tsx',
  'components/AuthorBio.tsx',
  'components/RatingScore.tsx',
  'components/RatingWidget.tsx',
  'components/CommentForm.tsx',
  'components/CommentList.tsx',
  'components/CommentShareButton.tsx',
  'components/ShareButtons.tsx',
  'components/LikeButton.tsx',
  'components/GlobalSearch.tsx',
  'components/TableOfContents.tsx',
  'components/StickyMobileCta.tsx',
  'components/ReadingProgressBar.tsx',
  'components/BossApprovedBadge.tsx',
  'components/CartIcon.tsx',
  'components/ImageLightbox.tsx',
  'components/LightboxImage.tsx',
  'components/CollectionEmbed.tsx',
  'components/CollectionsForReview.tsx',
  'components/EmailSignup.tsx',
  'components/WelcomeToast.tsx',
  'components/DashboardNav.tsx',
  // Collections
  'components/collections/EditorialMeta.tsx',
  'components/collections/RelatedRail.tsx',
  'components/collections/CategoryFilterPills.tsx',
  'components/collections/ArticleTOC.tsx',
  'components/collections/FAQAccordion.tsx',
  'components/collections/MethodologyCallout.tsx',
  'components/collections/BadgesForProduct.tsx',
  // Reviews
  'components/reviews/TakeawaysCard.tsx',
  'components/reviews/TrustReceipt.tsx',
  'components/reviews/VerdictCard.tsx',
  'components/reviews/ReviewTimelineStrip.tsx',
  'components/reviews/VerdictChangeBadge.tsx',
  // Wishlist/Bench
  'components/wishlist/StatusBadge.tsx',
  'components/wishlist/VoteButton.tsx',
  'components/wishlist/SubscribeButton.tsx',
  'components/wishlist/LoginPromptModal.tsx',
  'components/wishlist/WishlistCard.tsx',
  // UI primitives
  'components/ui/Card.tsx',
  'components/ui/EmptyState.tsx',
  'components/ui/PillFilterStrip.tsx',
  'components/ui/Skeleton.tsx',
]; // _LEGACY_FILES — not used, kept for reference

// ---------------------------------------------------------------------------
// Replacement helpers
// ---------------------------------------------------------------------------

/**
 * Apply a class-level substitution across all Tailwind variant prefixes.
 * Handles: `sm:`, `hover:`, `lg:`, `dark:`, `group-hover:`, `focus:`, etc.
 * Also handles opacity modifiers like `/40`, `/60`.
 */
function applyReplacement(content, fromPattern, toFactory) {
  // fromPattern: regex string for the class name portion (may include capture groups)
  const re = new RegExp(`((?:[\\w-]+:)*)${fromPattern}`, 'g');
  return content.replace(re, (_, prefix, ...captures) => {
    return `${prefix}${toFactory(...captures)}`;
  });
}

function simple(from, to) {
  return (content) => applyReplacement(content, from, () => to);
}

function withOpacity(from, to) {
  return (content) => applyReplacement(
    content,
    `${from}(\\/[\\w.]+)?`,
    (op) => `${to}${op || ''}`
  );
}

// Context-aware text-orange-500: look at surrounding className string for "uppercase" hint.
// JS replace callback args: (fullMatch, capture1, ..., captureN, matchOffset, origString)
// Our regex has 1 capture group, so: (match, prefix, matchOffset, origString)
function replaceOrange500(content) {
  return content.replace(
    /((?:[\w-]+:)*)text-orange-500/g,
    (match, prefix, matchOffset) => {
      // Same-line context only — avoids false positives from nearby elements
      const lineStart = content.lastIndexOf('\n', matchOffset) + 1;
      const lineEnd = content.indexOf('\n', matchOffset);
      const line = content.slice(lineStart, lineEnd === -1 ? content.length : lineEnd);
      if (line.includes('uppercase') && (line.includes('tracking-widest') || line.includes('tracking-wider'))) {
        return `${prefix}text-eyebrow`;
      }
      return `${prefix}text-accent-text`;
    }
  );
}

// ---------------------------------------------------------------------------
// Ordered replacement pipeline
// ---------------------------------------------------------------------------

const PIPELINE = [
  // === ORANGE bg ===
  simple('bg-orange-600', 'bg-accent'),
  simple('bg-orange-500', 'bg-accent-hover'),
  withOpacity('bg-orange-950', 'bg-accent-tint'),
  withOpacity('bg-orange-900', 'bg-accent-tint'),
  withOpacity('bg-orange-800', 'bg-accent-tint'),

  // === ORANGE text ===
  simple('text-orange-400', 'text-accent-text-soft'),
  simple('text-orange-600', 'text-accent'),
  // text-orange-500 handled separately (context-aware)

  // === ORANGE border ===
  withOpacity('border-orange-500', 'border-accent'),
  withOpacity('border-orange-600', 'border-accent'),
  withOpacity('border-orange-700', 'border-accent-border'),
  withOpacity('border-orange-800', 'border-accent-border'),
  withOpacity('border-orange-900', 'border-accent-border'),
  withOpacity('border-orange-950', 'border-accent-border'),

  // === ORANGE ring / outline / fill / stroke ===
  simple('ring-orange-600', 'ring-accent'),
  simple('ring-orange-500', 'ring-accent-hover'),
  simple('outline-orange-600', 'outline-accent'),
  simple('fill-orange-600', 'fill-accent'),
  simple('fill-orange-500', 'fill-accent-text'),
  simple('stroke-orange-500', 'stroke-accent-text'),
  simple('stroke-orange-600', 'stroke-accent'),

  // === NEUTRAL bg (dark surfaces) ===
  simple('bg-neutral-950', 'bg-surface-sunken'),
  simple('bg-neutral-900', 'bg-surface'),
  simple('bg-neutral-800', 'bg-surface-raised'),

  // === GRAY bg (our custom gray scale) ===
  simple('bg-gray-950', 'bg-surface-sunken'),
  simple('bg-gray-900', 'bg-surface'),
  simple('bg-gray-800', 'bg-surface-raised'),

  // === NEUTRAL text ===
  simple('text-neutral-100', 'text-prose'),
  simple('text-neutral-200', 'text-prose'),
  simple('text-neutral-400', 'text-prose-muted'),
  simple('text-neutral-500', 'text-prose-faint'),
  simple('text-neutral-600', 'text-prose-faint'),

  // === GRAY text ===
  simple('text-gray-100', 'text-prose'),
  simple('text-gray-200', 'text-prose'),
  simple('text-gray-400', 'text-prose-muted'),
  simple('text-gray-500', 'text-prose-faint'),
  simple('text-gray-600', 'text-prose-faint'),

  // === NEUTRAL border ===
  simple('border-neutral-800', 'border-soft'),
  simple('border-neutral-700', 'border-strong'),

  // === GRAY border ===
  simple('border-gray-800', 'border-soft'),
  simple('border-gray-700', 'border-strong'),

  // === GRADIENT STOPS (from-/to-/via-) — same dark-surface mapping as bg- ===
  simple('from-neutral-950', 'from-surface-sunken'),
  simple('from-neutral-900', 'from-surface'),
  simple('from-neutral-800', 'from-surface-raised'),
  simple('from-gray-950', 'from-surface-sunken'),
  simple('from-gray-900', 'from-surface'),
  simple('from-gray-800', 'from-surface-raised'),
  simple('to-neutral-950', 'to-surface-sunken'),
  simple('to-neutral-900', 'to-surface'),
  simple('to-neutral-800', 'to-surface-raised'),
  simple('to-gray-950', 'to-surface-sunken'),
  simple('to-gray-900', 'to-surface'),
  simple('to-gray-800', 'to-surface-raised'),
  simple('via-neutral-950', 'via-surface-sunken'),
  simple('via-neutral-900', 'via-surface'),
  simple('via-neutral-800', 'via-surface-raised'),
  simple('via-gray-950', 'via-surface-sunken'),
  simple('via-gray-900', 'via-surface'),
  simple('via-gray-800', 'via-surface-raised'),
];

// Card-title assignment: heading elements (h2/h3/h4) with text-accent-text on
// the same line → text-card-title. Multi-line JSX headings are not caught here;
// those are functionally identical (same resolved color) and acceptable.
function replaceCardTitles(content) {
  return content.replace(
    /(<h[234][^>\n]*)\btext-accent-text(?![\w-])([^>\n]*>)/g,
    '$1text-card-title$2'
  );
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

let totalFiles = 0;
let changedFiles = 0;
let totalChangedLines = 0;

for (const relPath of FILES) {
  const absPath = join(ROOT, relPath);
  let original;
  try {
    original = readFileSync(absPath, 'utf8');
  } catch {
    // file doesn't exist — skip silently
    continue;
  }

  totalFiles++;
  let modified = original;

  for (const fn of PIPELINE) {
    modified = fn(modified);
  }
  modified = replaceOrange500(modified);
  modified = replaceCardTitles(modified);

  if (modified === original) continue;

  // Count changed lines for the report
  const origLines = original.split('\n');
  const newLines = modified.split('\n');
  let diffCount = 0;
  for (let i = 0; i < origLines.length; i++) {
    if (origLines[i] !== newLines[i]) diffCount++;
  }

  totalChangedLines += diffCount;
  changedFiles++;

  if (DRY_RUN) {
    // Print first 5 changed lines as a preview
    let shown = 0;
    for (let i = 0; i < origLines.length && shown < 5; i++) {
      if (origLines[i] !== newLines[i]) {
        console.log(`  ${relPath}:${i + 1}`);
        console.log(`    - ${origLines[i].trim()}`);
        console.log(`    + ${newLines[i].trim()}`);
        shown++;
      }
    }
    if (diffCount > 5) console.log(`    ... and ${diffCount - 5} more line(s)`);
  } else {
    writeFileSync(absPath, modified, 'utf8');
  }

  console.log(`${DRY_RUN ? '[DRY]' : '[OK] '} ${relPath}  (${diffCount} line${diffCount !== 1 ? 's' : ''} changed)`);
}

console.log(`\n${'─'.repeat(60)}`);
console.log(`Files scanned : ${totalFiles}`);
console.log(`Files changed : ${changedFiles}`);
console.log(`Lines changed : ${totalChangedLines}`);
if (DRY_RUN) {
  console.log('\nDry run — no files written. Remove --dry-run to apply.');
}
