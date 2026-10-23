// The credit / disclosure line under a public image, from the asset's origin
// (lib/media/origin.ts). Lives in the FIGCAPTION, not as a badge over the
// photo: the brand guide allows one mark over an image and the hero may already
// carry Boss Approved, and a quiet editorial credit line is the familiar way a
// magazine says where a picture came from. 'web' and 'amazon' get no credit —
// naming a source we did not shoot would be a rights claim we can't make.

export type ImageOrigin = 'own' | 'web' | 'amazon' | 'ai'

export const AI_SCENE_CREDIT = 'AI-generated scene'
export const OWN_PHOTO_CREDIT = 'Photo: Boss Daddy'

export function imageCredit(origin: string | null | undefined): string | null {
  if (origin === 'ai') return AI_SCENE_CREDIT
  if (origin === 'own') return OWN_PHOTO_CREDIT
  return null
}

export function isImageOrigin(v: unknown): v is ImageOrigin {
  return v === 'own' || v === 'web' || v === 'amazon' || v === 'ai'
}
