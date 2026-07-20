import { z } from 'zod'

/**
 * Canonical shape for Claude's content-moderation JSON output.
 *
 * Both moderation paths validate the model's response against this schema:
 *   - review/guide moderation (`app/api/claude/moderate/route.ts`)
 *   - comment moderation (`app/api/comments/route.ts`)
 *
 * Validating here is a safety gate, not a formality. An unvalidated
 * `JSON.parse(raw) as ModerationResult` accepts any parseable shape — a model
 * that returns `{}` or a stringified score yields `undefined` for `score`/
 * `recommendation`, every threshold comparison evaluates false, and the content
 * silently auto-publishes. On a shape mismatch, callers should fail safe (fall
 * back to their conservative path), never auto-approve.
 */
export const ModerationResultSchema = z.object({
  score: z.number().min(0).max(1),
  flags: z.array(z.string()),
  recommendation: z.enum(['approve', 'review', 'reject']),
})

export type ModerationResult = z.infer<typeof ModerationResultSchema>
