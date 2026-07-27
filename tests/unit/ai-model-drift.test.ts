import { describe, it, expect } from 'vitest'
import { parseSlug, cmpVersion } from '../../scripts/ai-model-drift.mjs'

// The drift checker's only real logic is how it groups slugs into comparable
// FAMILIES. Get that wrong and it either cries drift constantly (comparing
// unrelated variants) or stays silent forever (never matching anything) — both of
// which would make the weekly CI job worse than useless. These lock the grouping.

// parseSlug returns null for anything unversioned; every call below is expected to
// parse, so narrow once here rather than asserting non-null at each use.
function parsed(slug: string) {
  const p = parseSlug(slug)
  if (!p) throw new Error(`expected ${slug} to parse`)
  return p
}

describe('parseSlug', () => {
  it('splits provider, prefix, version and suffix', () => {
    expect(parsed('anthropic/claude-sonnet-4.6')).toEqual({
      family: 'anthropic/claude-sonnet||',
      version: [4, 6],
      raw: 'anthropic/claude-sonnet-4.6',
    })
  })

  it('keeps a trailing variant suffix in the family key', () => {
    const fast = parsed('xai/grok-4.1-fast-non-reasoning')
    expect(fast.family).toBe('xai/grok||-fast-non-reasoning')
    expect(fast.version).toEqual([4, 1])
  })

  it('does NOT let sibling variants share a family', () => {
    // grok-4.1-fast-reasoning must never be offered as an upgrade to
    // grok-4.1-fast-NON-reasoning — different model, not a newer version.
    expect(parsed('xai/grok-4.1-fast-non-reasoning').family).not.toBe(
      parsed('xai/grok-4.1-fast-reasoning').family,
    )
  })

  it('does not confuse a leading version with a trailing one', () => {
    // claude-3-haiku (old naming) vs claude-haiku-4.5 (current) are unrelated.
    expect(parsed('anthropic/claude-3-haiku').family).toBe('anthropic/claude||-haiku')
    expect(parsed('anthropic/claude-haiku-4.5').family).toBe('anthropic/claude-haiku||')
    expect(parsed('anthropic/claude-3-haiku').family).not.toBe(
      parsed('anthropic/claude-haiku-4.5').family,
    )
  })

  it('handles a single-segment version', () => {
    expect(parsed('anthropic/claude-opus-5').version).toEqual([5])
  })

  it('returns null for an unversioned or malformed slug', () => {
    expect(parseSlug('openai/gpt')).toBeNull()
    expect(parseSlug('no-slash-here-1.0')).toBeNull()
  })

  it('declines a v-prefixed version rather than mis-parsing it', () => {
    // `cohere/embed-v4.0` — the version is prefixed with `v`, so the `-<digit>`
    // pattern correctly does not match. The script reports these as "cannot check
    // for drift" instead of guessing. Not currently reachable: the embedding model
    // is pinned in lib/ai/embedding.ts (vector-space pin), not in MODELS.
    expect(parseSlug('cohere/embed-v4.0')).toBeNull()
  })
})

describe('cmpVersion', () => {
  it('orders by numeric segment', () => {
    expect(cmpVersion([5], [4, 6])).toBeGreaterThan(0)
    expect(cmpVersion([4, 6], [4, 5])).toBeGreaterThan(0)
    expect(cmpVersion([4, 5], [4, 5])).toBe(0)
  })

  it('treats a missing segment as zero, so 5 > 4.8 and 5 == 5.0', () => {
    expect(cmpVersion([5], [4, 8])).toBeGreaterThan(0)
    expect(cmpVersion([5], [5, 0])).toBe(0)
  })

  it('sorts xAI 4.20 above 4.5 — documented heuristic, not a typo', () => {
    // Numeric segment compare makes 4.20 the newer release. Whether that matches
    // xAI's intent is unknowable from the slug, which is exactly why the script
    // only ADVISES a bump and never rewrites the registry.
    expect(cmpVersion([4, 20], [4, 5])).toBeGreaterThan(0)
  })
})
