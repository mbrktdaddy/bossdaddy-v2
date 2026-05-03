// THIS FILE MUST BE NAMED middleware.ts — Next.js requires this exact filename
// to run middleware. Renaming it (e.g. to proxy.ts) silently disables auth
// protection, session refresh, and all redirects with no build error.
// The logic lives in proxy.ts; this file is the required entry point.
export { proxy as middleware, config } from './proxy'
