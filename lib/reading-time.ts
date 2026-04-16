/**
 * Compute estimated reading time in minutes from HTML content.
 * Strips tags, counts words, divides by 200wpm. Minimum 1 minute.
 */
export function computeReadingTime(htmlContent: string): number {
  const text = htmlContent
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const wordCount = text.split(' ').filter(Boolean).length
  return Math.max(1, Math.round(wordCount / 200))
}
