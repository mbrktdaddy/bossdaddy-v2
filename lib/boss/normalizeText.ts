// Render-time markdown backstop for The Boss's chat prose.
//
// The brand rule (north star, LOCKED) is that the concierge speaks PLAIN,
// conversational prose — all real structure lives in cards, never markdown. The
// chat renders raw text (`whitespace-pre-wrap`), so any markdown the model leaks
// shows as literal characters (`**like this**`). PR 2 hardens the prompt against
// it; this is the belt-and-suspenders that guarantees the reader never sees it.
//
// Deliberately NARROW — it only touches the patterns the model actually leaks
// (bold, ATX headings, dash/star bullets), so it can't mangle prose, URLs, or the
// "• " bullets the Boss is told to use. Applied at RENDER time only; persisted
// message content stays raw so raw leakage remains measurable (eval / PR 2).
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
}
