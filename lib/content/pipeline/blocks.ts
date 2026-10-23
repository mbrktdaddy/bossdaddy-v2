import { z } from 'zod'
import { FaqOutput, SubScoresOutput } from '../schemas'
import { INQUIRY_TRIGGER } from '../prompts'
import { tagSlugList, type TagVocab } from '@/lib/claude/tag-vocab'
import { briefFacts, briefLabel } from './briefs'
import { runProse } from './section'
import type { BlockChoices, Blocks, RunState } from './types'

// Stage 3 — the structured blocks, derived from the FINISHED prose rather than
// invented in parallel with it. Only the blocks the outline chose are in the
// schema, so nothing is forced and nothing is paid for that gets discarded.

export function blocksOutput(choices: BlockChoices, contentType: 'review' | 'guide'): z.ZodType<Blocks> {
  const shape: Record<string, z.ZodTypeAny> = {
    suggestedTags: z.array(z.string().min(1).max(80)).max(10).describe('3–6 slugs from the controlled vocabulary in the prompt'),
  }
  if (choices.tldr) shape.tldr = z.string().min(1).max(600).describe(contentType === 'review'
    ? '1–2 sentence verdict for skimmers; lead with the gut answer'
    : '2–3 plain-English sentences; lead with the main takeaway (inquiry: name the question and the answer you land on)')
  if (choices.keyTakeaways) shape.keyTakeaways = z.array(z.string().min(1).max(400)).min(2).max(6)
    .describe('3–5 specific, decision-relevant insights pulled from the prose — not a rehash of the intro or the pros')
  if (choices.faqs) shape.faqs = z.array(FaqOutput).min(2).max(6)
    .describe('3–5 pairs; questions the way a real dad would search (inquiry: the strongest objections, each given a real answer)')
  if (choices.bestFor) shape.bestFor = z.array(z.string().min(1).max(300)).min(2).max(5).describe('3–4 specific buyer profiles')
  if (choices.notFor) shape.notFor = z.array(z.string().min(1).max(300)).min(1).max(4).describe('2–3 specific situations or buyers who should skip')
  if (choices.prosCons) {
    shape.pros = z.array(z.string().min(1).max(300)).min(2).max(6).describe('3–6 short, specific items from the prose')
    shape.cons = z.array(z.string().min(1).max(300)).min(1).max(4).describe('2–4 honest, specific items — never empty')
  }
  if (choices.subScores && contentType === 'review') {
    shape.subScores = SubScoresOutput.describe('Suggested 1–10 integers that defend the target rating; the author confirms them')
    shape.wouldRebuy = z.boolean().describe('Suggested; true only if a thoughtful dad would buy it again knowing what he knows now')
  }
  // The shape is assembled per piece, so Zod can't infer the static type; every
  // key above is a Blocks key with its Blocks type.
  return z.object(shape) as unknown as z.ZodType<Blocks>
}

export function blocksPrompt(run: RunState, vocab: TagVocab): string {
  const brief = run.brief
  const inquiry = brief.contentType === 'guide' && brief.inquiryMode
  const choices = run.outline!.blocks
  const facts = briefFacts(brief)
  const wanted = Object.entries(choices).filter(([k, v]) => v && k !== 'subScores').map(([k]) => k)

  return `${inquiry ? `${INQUIRY_TRIGGER}\n\n` : ''}The ${briefLabel(brief)} below is FINISHED. Produce only its structured blocks — summaries of what the prose actually says, never new claims.

Title: ${run.outline!.title}
${brief.contentType === 'review' ? `Author's target rating: ${brief.ratingHint}/10.` : ''}
${facts.length ? `\nAUTHOR FACTS (the only firsthand material; a block may not claim beyond them):\n${facts.map((f) => `- ${f}`).join('\n')}\n` : ''}
THE PIECE:
"""
${runProse(run)}
"""

BLOCKS WANTED: ${wanted.join(', ') || 'none'}${choices.subScores && brief.contentType === 'review' ? ', subScores + wouldRebuy (suggested — the author confirms)' : ''}.
${choices.subScores && brief.contentType === 'review' ? `- subScores: four 1–10 integers that DEFEND a target overall of ${brief.ratingHint}/10 and average to ~${brief.ratingHint}.0 (no 10s on a 6). One can be a clear weak spot.\n` : ''}
TAGS: pick 3–6 slugs from this controlled vocabulary that genuinely apply.
Editorial (at most 1): ${tagSlugList(vocab, 'editorial')}
Life Stage: ${tagSlugList(vocab, 'life-stage')}
${brief.contentType === 'review' ? `Price: ${tagSlugList(vocab, 'price')}\n` : ''}Use Case: ${tagSlugList(vocab, 'use-case')}
Topic: ${tagSlugList(vocab, 'topic')}

Each field's description says its shape. Everything must be traceable to the prose above.`
}
