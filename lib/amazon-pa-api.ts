import { createHmac, createHash } from 'crypto'

const SERVICE  = 'ProductAdvertisingAPI'
const REGION   = 'us-east-1'
const HOST     = 'webservices.amazon.com'
const ENDPOINT = `https://${HOST}/paapi5/getitems`

export interface PaApiImage {
  url:     string
  width:   number
  height:  number
  variant: 'PRIMARY' | 'VARIANT'
}

function sha256hex(data: string): string {
  return createHash('sha256').update(data, 'utf8').digest('hex')
}

function hmac(key: Buffer | string, data: string): Buffer {
  return createHmac('sha256', key).update(data, 'utf8').digest()
}

function signingKey(secretKey: string, dateStamp: string): Buffer {
  return hmac(hmac(hmac(hmac(`AWS4${secretKey}`, dateStamp), REGION), SERVICE), 'aws4_request')
}

export async function fetchProductImages(
  asin:       string,
  accessKey:  string,
  secretKey:  string,
  partnerTag: string,
): Promise<PaApiImage[]> {
  const now       = new Date()
  const amzDate   = now.toISOString().replace(/[:\-]|\.\d{3}/g, '') // 20260507T123456Z
  const dateStamp = amzDate.slice(0, 8)

  const body = JSON.stringify({
    ItemIds:     [asin],
    Resources:   [
      'Images.Primary.Large',
      'Images.Variants.Large',
    ],
    PartnerTag:  partnerTag,
    PartnerType: 'Associates',
    Marketplace: 'www.amazon.com',
  })

  const payloadHash = sha256hex(body)

  // Headers must be in alphabetical order for canonical request
  const canonicalHeaders =
    `content-encoding:amz-1.0\n` +
    `content-type:application/json; charset=utf-8\n` +
    `host:${HOST}\n` +
    `x-amz-date:${amzDate}\n` +
    `x-amz-target:com.amazon.paapi5.v1.ProductAdvertisingAPIv1.GetItems\n`

  const signedHeaders = 'content-encoding;content-type;host;x-amz-date;x-amz-target'

  const canonicalRequest = [
    'POST',
    '/paapi5/getitems',
    '',
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n')

  const credentialScope = `${dateStamp}/${REGION}/${SERVICE}/aws4_request`

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256hex(canonicalRequest),
  ].join('\n')

  const signature = createHmac('sha256', signingKey(secretKey, dateStamp))
    .update(stringToSign, 'utf8')
    .digest('hex')

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'content-encoding': 'amz-1.0',
      'content-type':     'application/json; charset=utf-8',
      'host':             HOST,
      'x-amz-date':       amzDate,
      'x-amz-target':     'com.amazon.paapi5.v1.ProductAdvertisingAPIv1.GetItems',
      'Authorization':    authorization,
    },
    body,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`PA-API ${res.status}: ${text.slice(0, 200)}`)
  }

  const data = await res.json()
  const item = data?.ItemsResult?.Items?.[0]
  if (!item) return []

  const images: PaApiImage[] = []

  const primary = item.Images?.Primary?.Large
  if (primary?.URL) {
    images.push({ url: primary.URL, width: primary.Width ?? 0, height: primary.Height ?? 0, variant: 'PRIMARY' })
  }

  for (const v of (item.Images?.Variants ?? [])) {
    const large = v?.Large
    if (large?.URL) {
      images.push({ url: large.URL, width: large.Width ?? 0, height: large.Height ?? 0, variant: 'VARIANT' })
    }
  }

  return images
}
