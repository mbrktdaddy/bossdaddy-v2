// Standardized moderation reason lists. Used in both the admin action UI
// (suspend/ban/delete) and the user self-deletion UI. Storing the human-
// readable label as the value keeps reads simple — no lookup needed when
// rendering the audit log or showing a user their suspension reason.
//
// Sentinel value 'Other' tells the UI to show a free-text input for an
// admin-supplied or user-supplied custom reason.

export const OTHER_REASON = 'Other' as const

export const ADMIN_MODERATION_REASONS = [
  'Spam or promotional content',
  'Harassment or bullying',
  'Hate speech or discrimination',
  'Threats or violence',
  'Sexually explicit content',
  'Misinformation or false claims',
  'Impersonation or fake account',
  'Multiple accounts / sockpuppeting',
  'Off-topic or disruptive behavior',
  'Repeated minor violations',
  'Account compromised / takeover',
  'Acting on user request',
  'Legal or compliance requirement',
  OTHER_REASON,
] as const

export const SELF_DELETION_REASONS = [
  'Not using the site enough',
  'Too many emails',
  'Privacy concerns',
  'Found a better alternative',
  'Created a duplicate account',
  "Don't remember signing up",
  OTHER_REASON,
] as const

export type AdminModerationReason = (typeof ADMIN_MODERATION_REASONS)[number]
export type SelfDeletionReason    = (typeof SELF_DELETION_REASONS)[number]
