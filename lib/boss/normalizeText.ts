// Render-time backstop for The Boss's chat prose.
//
// The brand rule (north star, LOCKED) is that the concierge speaks PLAIN,
// conversational prose — all real structure AND every link lives in cards, never
// in the prose. The chat renders raw text (`whitespace-pre-wrap`), so any markdown
// the model leaks shows as literal characters (`**like this**`), and any link path
// it leaks shows as a bare, UNDISCLOSED path next to the card that already carries
// it (and its FTC disclosure). The PR 2a prompt reframe tells the model to do
// neither; this is the belt-and-suspenders that guarantees the reader never sees
// either — so a bare affiliate/link path can't reach the screen even if the prompt
// drifts.
//
// Deliberately NARROW — it only touches what the model actually leaks (bold, ATX
// headings, dash/star bullets, and the internal /reviews//guides//go/ link paths
// the cards own). It won't mangle prose, absolute URLs, hashtags, or the "• "
// bullets the Boss is told to use. Applied at RENDER time only; persisted message
// content stays raw so raw leakage remains measurable (eval).
export function normalizeBossText(text: string): string {
  if (!text) return text
  return text
    // ATX headings: "## Title" / "### Title" -> "Title" (strip the #s + space).
    .replace(/^\s{0,3}#{1,6}[ \t]+/gm, '')
    // Dash / asterisk bullets at line start -> "• " (preserve any indent).
    .replace(/^([ \t]*)[-*][ \t]+/gm, '$1• ')
    // Bold: ***x*** / **x** -> x (run after the bullet rule so "**" is never
    // mistaken for a "* " bullet).
    .replace(/\*\*\*([^*]+)\*\*\*/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    // ── Cards own the links (PR 2a compliance backstop) ──
    // 1) A whole line that is just a link reference ("Review: /reviews/…",
    //    "Buy link (…): /go/…") -> drop it; the card below already carries it.
    .replace(/^[ \t]*[^\n:]{0,70}:[ \t]*\/(?:reviews|guides|go)\/[^\s)]+[ \t]*$/gim, '')
    // 2) Any remaining bare internal path token (NOT part of an absolute URL —
    //    the lookbehind spares "https://site.com/reviews/x") -> remove it inline.
    .replace(/[ \t]*\(?(?<![\w.])\/(?:reviews|guides|go)\/[a-z0-9-]+(?:\/[a-z0-9-]+)*\/?\)?/gi, '')
    // 3) Tidy the edges the removals can leave (trailing spaces, blank runs).
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
