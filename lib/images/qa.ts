import { z } from 'zod'
import { aiGenerateObjectWithMeta, type CallMeta } from '@/lib/ai/client'
import type { SafetyToggles } from './safety'

// Vision QA for a freshly generated editorial image, BEFORE it is stored. One
// Haiku call (utility bucket, temperature 0) looks at the pixels and reports
// what the prompt rules could only ask for: rendered text, a logo, a face, an
// identifiable child, AI artifacts, a rendered/illustrated look, and whether
// the frame matches the subject. The same call writes the alt text from what
// is actually in the image — the pre-generation guess described what was
// ASKED for, not what came back.
//
// `judgeQa` turns the report into a verdict against the lane's toggles:
//   fail → regenerate once (the generator appends the reasons as avoidances)
//   warn → store, but tell the author
// A failed second attempt is still stored and returned with its report — the
// author decides; nothing is silently substituted (that was defect #13).

export const QaReportSchema = z.object({
  altText: z.string().min(1).max(200)
    .describe('One sentence, 10–20 words, describing what is visible for a screen reader. No "Image of".'),
  text: z.boolean().describe('Any rendered text, lettering, numbers, signage, labels or a watermark is visible'),
  logos: z.boolean().describe('A brand logo, brand name, product packaging, or a recognisable real-world branded product is visible'),
  faces: z.boolean().describe('At least one human face is clearly visible (eyes/nose/mouth readable)'),
  identifiableChild: z.boolean().describe('A child appears with a recognisable face'),
  artifacts: z.boolean().describe('Obvious generation artifacts: extra or fused fingers, warped objects, impossible geometry, melted text-like shapes'),
  rendered: z.boolean().describe('Looks like an illustration, 3D render, HDR composite or stock photo rather than a candid documentary photograph'),
  matchesSubject: z.boolean().describe('The frame shows the requested subject'),
  notes: z.string().max(240).describe('One short sentence on the biggest problem, or empty'),
})
export type QaReport = z.infer<typeof QaReportSchema>

export type QaVerdict = 'pass' | 'warn' | 'fail'

export interface QaJudgement {
  verdict: QaVerdict
  /** Human-readable reasons, worst first. Empty on pass. */
  reasons: string[]
}

export interface QaResult {
  report: QaReport
  judgement: QaJudgement
  meta: CallMeta
}

const QA_SYSTEM =
  'You are a photo editor checking an AI-generated image before it is published on an editorial website for dads. ' +
  'Judge only what is visible. Be literal and strict about text, logos and faces — a single readable word or one ' +
  'clear face counts. Describe the image accurately for the alt text.'

export async function inspectImage(args: {
  bytes: Buffer
  mediaType: 'image/webp' | 'image/png' | 'image/jpeg'
  /** What the image was meant to show (the subject prompt). */
  subject: string
  toggles: SafetyToggles
}): Promise<QaResult> {
  const { object, meta } = await aiGenerateObjectWithMeta<QaReport>({
    bucket: 'utility',
    tag: 'image-qa',
    schema: QaReportSchema,
    system: QA_SYSTEM,
    maxOutputTokens: 400,
    temperature: 0,
    effort: 'low',
    messages: [{
      role: 'user',
      content: [
        { type: 'image', image: args.bytes, mediaType: args.mediaType },
        { type: 'text', text: `Intended subject: ${args.subject.slice(0, 400)}\n\nInspect the image and fill every field.` },
      ],
    }],
  })
  return { report: object, judgement: judgeQa(object, args.toggles), meta }
}

/** Pure: report + the lane's rules → verdict. Unit-tested. */
export function judgeQa(report: QaReport, toggles: SafetyToggles): QaJudgement {
  const fails: string[] = []
  const warns: string[] = []

  if (report.logos) fails.push('a brand, logo or recognisable product is visible')
  if (report.identifiableChild) fails.push('a child is identifiable')
  if (report.text && toggles.noText) fails.push('rendered text is visible')
  if (report.faces && toggles.people !== 'allowed') {
    fails.push(toggles.people === 'none' ? 'a person is visible' : 'a face is visible')
  }
  if (report.artifacts) warns.push('generation artifacts (hands, warped objects)')
  if (report.rendered && toggles.editorialOnly) warns.push('looks rendered or staged, not a candid photograph')
  if (!report.matchesSubject) warns.push('does not show the requested subject')

  if (fails.length) return { verdict: 'fail', reasons: [...fails, ...warns] }
  if (warns.length) return { verdict: 'warn', reasons: warns }
  return { verdict: 'pass', reasons: [] }
}

/** The negative instruction appended to the prompt for the retry after a failed QA. */
export function avoidanceClause(reasons: string[]): string {
  if (reasons.length === 0) return ''
  return `The previous attempt was rejected because: ${reasons.join('; ')}. Avoid all of that.`
}
