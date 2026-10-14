// The capture-card shell — its own module so Server Components can import the
// string (NewsletterSignup is 'use client'; a string exported from a client
// module arrives in a Server Component as a reference proxy, not the string).
export const CAPTURE_CARD = 'bg-surface border-2 border-chrome rounded-xl p-6 sm:p-8'
