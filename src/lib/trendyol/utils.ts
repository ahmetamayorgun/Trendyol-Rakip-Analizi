const PRODUCT_ID_PATTERN = /-p-(\d+)/
const MERCHANT_ID_PATTERN = /(?:[?&]mid=|merchantId=|-m-)(\d+)/

export function absoluteTrendyolUrl(rawUrl: string) {
  if (!rawUrl) {
    return rawUrl
  }

  if (rawUrl.startsWith("http://") || rawUrl.startsWith("https://")) {
    return rawUrl
  }

  return `https://www.trendyol.com${rawUrl.startsWith("/") ? rawUrl : `/${rawUrl}`}`
}

export function parseTurkishNumber(rawValue: string | null | undefined) {
  if (!rawValue) {
    return null
  }

  const cleaned = rawValue.replace(/\s+/g, "").replace(/[^\d,.-BKMbkm]/g, "")
  if (!cleaned) {
    return null
  }

  const suffix = cleaned.slice(-1).toUpperCase()
  const base = Number(cleaned.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(/,/g, "."))

  if (!Number.isFinite(base)) {
    return null
  }

  if (suffix === "B") {
    return Math.round(base * 1_000)
  }

  if (suffix === "M") {
    return Math.round(base * 1_000_000)
  }

  if (suffix === "K") {
    return Math.round(base * 1_000)
  }

  return Math.round(base)
}

export function parseTurkishPrice(rawValue: string | null | undefined) {
  if (!rawValue) {
    return null
  }

  const normalized = rawValue.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(/,/g, ".")
  const value = Number(normalized)
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : null
}

export function parseReviewCount(rawValue: string | null | undefined) {
  if (!rawValue) {
    return null
  }

  const match = rawValue.match(/\((\d+[\d.,]*)\)|^(\d+[\d.,]*)$/)
  if (!match) {
    return parseTurkishNumber(rawValue)
  }

  return parseTurkishNumber(match[1] ?? match[2])
}

export function uniq<T>(items: T[]) {
  return Array.from(new Set(items))
}

export function compact<T>(items: Array<T | null | undefined>) {
  return items.filter((item): item is T => item != null)
}

export function extractProductId(url: string) {
  return url.match(PRODUCT_ID_PATTERN)?.[1] ?? null
}

export function extractMerchantId(url: string) {
  return url.match(MERCHANT_ID_PATTERN)?.[1] ?? null
}
