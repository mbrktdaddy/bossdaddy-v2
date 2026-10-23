import type { SpecLike } from '../specs'
import type { DraftInlineImage } from '../html'

// The staged pipeline's state. One `content_runs` row (mig 165) holds a RunState;
// each stage reads the state, calls a model, writes its slice back. The wizard
// only ever needs the run id to resume.

export type ContentType = 'review' | 'guide'
export type RunStatus = 'outline' | 'drafting' | 'blocks' | 'critic' | 'images' | 'done' | 'failed'
export type PartKind = 'intro' | 'body' | 'closing'
export type PieceType = 'essay' | 'howto' | 'guide'

export interface ReviewBrief {
  contentType: 'review'
  productName: string
  category: string
  keyFeatures: string[]
  targetAudience?: string
  productSlug?: string
  brand?: string
  modelNumber?: string
  specs: SpecLike[]
  competitors: { name: string; brand?: string; specs: SpecLike[] }[]
  imageSlots: number | 'auto'
  ratingHint: number
  testingDuration?: string
  testingSince?: string
  testingNote?: string
  howYouUsedIt?: string
  standoutMoment?: string
  pricePaid?: number
}

export interface GuideBrief {
  contentType: 'guide'
  topic: string
  category: string
  pieceType: PieceType
  keyPoints: string[]
  context?: string
  targetAudience?: string
  productSlugs: string[]
  imageSlots: number | 'auto'
  /** Resolved (explicit toggle or pillar default) — the run never re-derives it. */
  inquiryMode: boolean
}

export type Brief = ReviewBrief | GuideBrief

/** Which structured blocks this piece gets — chosen at the outline, per piece. */
export interface BlockChoices {
  tldr: boolean
  keyTakeaways: boolean
  faqs: boolean
  bestFor: boolean
  notFor: boolean
  prosCons: boolean
  subScores: boolean
}

export interface OutlinePart {
  kind: PartKind
  /** Empty for the intro. */
  heading: string
  /** One line: what this part must accomplish for the reader. */
  intent: string
  /** The author's facts this part may draw on — the ONLY firsthand material. */
  notes: string[]
  targetWords: number
  /** A slug to embed exactly once in this part, or null. Assigned in code, not by the model. */
  productToken: string | null
}

export interface RelatedPiece {
  type: ContentType
  slug: string
  title: string
}

export interface Outline {
  title: string
  titleOptions: string[]
  excerpt: string
  parts: OutlinePart[]
  blocks: BlockChoices
  imageCount: number
  related: RelatedPiece[]
  duplicateWarning: string | null
}

export interface SectionResult {
  text: string
  generationId: string | null
}

export interface SubScores {
  quality: number
  value: number
  ease: number
  dailyUse: number
}

export interface Blocks {
  tldr?: string
  keyTakeaways?: string[]
  faqs?: { question: string; answer: string }[]
  bestFor?: string[]
  notFor?: string[]
  pros?: string[]
  cons?: string[]
  /** Suggested — the author confirms them in the wizard (claims only when set). */
  subScores?: SubScores
  wouldRebuy?: boolean
  suggestedTags: string[]
}

export type Severity = 'block' | 'warn' | 'note'

export interface CriticFinding {
  severity: Severity
  code: string
  message: string
  /** Index into outline.parts, when the finding is local to one part. */
  part?: number | null
  quote?: string | null
  source: 'rules' | 'model'
}

export interface Critic {
  findings: CriticFinding[]
  summary: string
}

export interface ImagePlan {
  heroPrompt: string
  inline: DraftInlineImage[]
}

export interface RunState {
  id: string
  userId: string
  contentType: ContentType
  status: RunStatus
  brief: Brief
  outline: Outline | null
  /** Aligned with outline.parts; null until written. */
  sections: (SectionResult | null)[]
  blocks: Blocks | null
  critic: Critic | null
  images: ImagePlan | null
  contentId: string | null
  costUsd: number
  error: string | null
  promptVersion: string
  createdAt: string
  updatedAt: string
}
