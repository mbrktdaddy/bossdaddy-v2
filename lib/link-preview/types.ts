// The shape a link preview takes once it leaves the server.
//
// SEPARATE FROM ./index.ts ON PURPOSE. That module is `server-only` — it reaches for
// the service-role client and node:net through the guard — so a client component
// importing the TYPE from there would drag the whole thing into the browser bundle
// and fail the build. Types have no runtime, so they live somewhere both sides can
// reach.

/** What a client is allowed to know about a preview: no storage paths, no errors. */
export interface PublicPreview {
  url:         string
  title:       string | null
  description: string | null
  siteName:    string | null
  /**
   * OUR proxy path — never the third party's image URL. Handing the browser a
   * foreign URL is the leak this whole feature is built to avoid: it would let the
   * sender log when the recipient opened the thread, and from where.
   */
  imageSrc:    string | null
  imageWidth:  number | null
  imageHeight: number | null
}
