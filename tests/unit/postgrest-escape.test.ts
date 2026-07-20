import { describe, it, expect } from 'vitest'
import { escapePostgrestLike, likePattern } from '@/lib/postgrest-escape'

// A2 (CWE-943) regression guard. supabase-js does NOT parameterize `.or()` —
// the argument is literal PostgREST filter syntax. If any of the delimiter/
// grouping chars survive escaping, a caller can inject extra conditions
// (e.g. `,id.neq.<uuid>`) and turn a scoped search into a full-table dump.
describe('escapePostgrestLike', () => {
  it('strips PostgREST filter delimiters and grouping chars', () => {
    // comma (condition separator), parens (grouping), backslash (escape)
    expect(escapePostgrestLike('a,b(c)d\\e')).toBe('a b c d e')
  })

  it('strips the % wildcard so callers cannot scan the whole table', () => {
    expect(escapePostgrestLike('%%%')).toBe('')
    expect(escapePostgrestLike('bob%')).toBe('bob')
  })

  it('neutralizes the classic .or() injection payload', () => {
    const malicious = 'x,id.neq.00000000-0000-0000-0000-000000000000'
    const escaped = escapePostgrestLike(malicious)
    // No comma survives → PostgREST cannot read it as a second condition.
    expect(escaped).not.toContain(',')
    expect(escaped).not.toMatch(/[(),%\\]/)
  })

  it('trims surrounding whitespace left by stripping', () => {
    expect(escapePostgrestLike('  (hi)  ')).toBe('hi')
  })

  it('leaves benign search terms intact', () => {
    expect(escapePostgrestLike('stroller travel system')).toBe('stroller travel system')
    expect(escapePostgrestLike("O'Brien")).toBe("O'Brien") // apostrophe is safe in ilike
  })
})

describe('likePattern', () => {
  it('wraps the escaped term in contains-LIKE bounds', () => {
    expect(likePattern('bob')).toBe('%bob%')
  })

  it('escapes before wrapping — injected % cannot break out of the pattern', () => {
    // The user's own % is stripped; only our two bounding % remain.
    expect(likePattern('a%b')).toBe('%a b%')
    expect(likePattern('a,b')).toBe('%a b%')
  })
})
