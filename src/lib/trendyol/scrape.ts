import type { Page } from "playwright"

import { withTrendyolPage } from "@/lib/trendyol/browser"
import type {
  ScrapedCategoryLink,
  ScrapedCategoryProductCandidate,
  ScrapedProductDetail,
  ScrapedStoreProductCard,
  ScrapedStoreProfile,
} from "@/lib/trendyol/types"
import {
  absoluteTrendyolUrl,
  compact,
  extractMerchantId,
  extractProductId,
  parseReviewCount,
  parseTurkishNumber,
  parseTurkishPrice,
  uniq,
} from "@/lib/trendyol/utils"

interface TrendyolStoreSeed {
  profileUrl: string
  merchantId: string | null
}

export interface TrendyolScrapeProgressEvent {
  stage: "store" | "products" | "categories"
  progress: number
  detail: string
}

export interface TrendyolScrapeOptions {
  maxProductDetails?: number
  maxCategoryPages?: number
  maxCategoryProductsPerPage?: number
  onProgress?: (event: TrendyolScrapeProgressEvent) => void
}

const DEFAULT_OPTIONS: Required<Omit<TrendyolScrapeOptions, "onProgress">> = {
  maxProductDetails: 3,
  maxCategoryPages: 2,
  maxCategoryProductsPerPage: 4,
}

export async function scrapeTrendyolStoreAnalysis(inputUrl: string, options: TrendyolScrapeOptions = {}) {
  const config = {
    maxProductDetails: options.maxProductDetails ?? DEFAULT_OPTIONS.maxProductDetails,
    maxCategoryPages: options.maxCategoryPages ?? DEFAULT_OPTIONS.maxCategoryPages,
    maxCategoryProductsPerPage: options.maxCategoryProductsPerPage ?? DEFAULT_OPTIONS.maxCategoryProductsPerPage,
    onProgress: options.onProgress,
  }

  return withTrendyolPage(async (page) => {
    config.onProgress?.({ stage: "store", progress: 10, detail: "Mağaza giriş noktası çözülüyor." })
    const seed = await resolveStoreSeed(page, inputUrl)

    config.onProgress?.({ stage: "store", progress: 24, detail: "Mağaza profili ve ürün listesi çekiliyor." })
    const store = await scrapeStoreProfile(page, seed)

    const productDetails = await scrapeTopProductDetails(page, store.featuredProducts, config.maxProductDetails, (index, total) => {
      const progress = 32 + Math.round(((index + 1) / Math.max(total, 1)) * 24)
      config.onProgress?.({
        stage: "products",
        progress,
        detail: `${index + 1}/${total} ürün detay sayfası analiz edildi.`,
      })
    })

    const categoryProducts = await scrapeCategoryProductCandidates(
      page,
      productDetails,
      store.name,
      productDetails.map((detail) => detail.name),
      config.maxCategoryPages,
      config.maxCategoryProductsPerPage,
      (index, total, category) => {
        const progress = 62 + Math.round(((index + 1) / Math.max(total, 1)) * 20)
        config.onProgress?.({
          stage: "categories",
          progress,
          detail: `${category} kategorisinde rakip keşfi yapıldı (${index + 1}/${total}).`,
        })
      }
    )

    return {
      store,
      productDetails,
      categoryProducts,
    }
  })
}

async function resolveStoreSeed(page: Page, inputUrl: string): Promise<TrendyolStoreSeed> {
  const url = absoluteTrendyolUrl(inputUrl.trim())

  if (extractProductId(url)) {
    const product = await scrapeProductDetail(page, url)
    const merchantId = extractMerchantId(product.sellerUrl ?? url) ?? extractMerchantId(url)
    const profileUrl =
      product.sellerUrl && product.sellerUrl.includes("/magaza/")
        ? product.sellerUrl
        : merchantId
          ? `https://www.trendyol.com/magaza/profil/${slugify(product.sellerName ?? "magaza")}-m-${merchantId}`
          : url

    return {
      profileUrl,
      merchantId,
    }
  }

  return {
    profileUrl: normalizeStoreProfileUrl(url),
    merchantId: extractMerchantId(url),
  }
}

function normalizeStoreProfileUrl(url: string) {
  if (url.includes("/magaza/profil/")) {
    return url
  }

  if (url.includes("/magaza/")) {
    return url.replace("/magaza/", "/magaza/profil/")
  }

  return url
}

async function scrapeStoreProfile(page: Page, seed: TrendyolStoreSeed): Promise<ScrapedStoreProfile> {
  await gotoStable(page, seed.profileUrl)

  const profile = await page.evaluate(() => {
    const bodyText = document.body.innerText
    const name = document.querySelector("h1")?.textContent?.trim() ?? "Bilinmeyen Mağaza"
    const scoreText = document.querySelector(".score-actual")?.textContent?.trim() ?? null
    const followerText = bodyText.match(/([\d.,]+\s*[BMK]?)\s*Takipçi/i)?.[1] ?? null
    const totalProductsText = bodyText.match(/([\d.,]+\+?)\s*Ürün/i)?.[1] ?? null
    const tabLinks = Array.from(document.querySelectorAll("a.tab"))
      .map((anchor) => ({
        text: anchor.textContent?.trim() ?? "",
        href: anchor.getAttribute("href"),
      }))
      .filter((item) => item.href)
    const featuredProductLinks = Array.from(document.querySelectorAll("a.review-product"))
      .map((anchor) => ({
        href: anchor.getAttribute("href"),
        text: anchor.textContent?.trim() ?? "",
      }))
      .filter((item) => item.href)

    return {
      name,
      scoreText,
      followerText,
      totalProductsText,
      productsUrl: tabLinks.find((item) => item.text.includes("Tüm Ürünler"))?.href ?? null,
      featuredProductLinks,
    }
  })

  const merchantId = seed.merchantId ?? extractMerchantId(profile.productsUrl ?? seed.profileUrl)
  const productsUrl =
    profile.productsUrl != null
      ? absoluteTrendyolUrl(profile.productsUrl)
      : merchantId
        ? `https://www.trendyol.com/sr?mid=${merchantId}&os=1`
        : null

  const productListing = productsUrl ? await scrapeStoreProducts(page, productsUrl) : { cards: [], totalProducts: null }

  return {
    name: profile.name,
    merchantId,
    sellerScore: parseFloat(profile.scoreText ?? ""),
    followerCount: parseTurkishNumber(profile.followerText),
    totalProducts: parseTurkishNumber(profile.totalProductsText?.replace("+", "")) ?? productListing.totalProducts,
    profileUrl: page.url(),
    productsUrl,
    featuredProducts:
      productListing.cards.length > 0
        ? productListing.cards
        : profile.featuredProductLinks.map((item) => ({
            name: item.text,
            brand: null,
            url: absoluteTrendyolUrl(item.href ?? ""),
            price: null,
            rating: null,
            reviewCount: null,
            imageUrl: null,
            badges: [],
          })),
  }
}

async function scrapeStoreProducts(page: Page, productsUrl: string): Promise<{ cards: ScrapedStoreProductCard[]; totalProducts: number | null }> {
  await gotoStable(page, productsUrl)

  const payload = await page.evaluate(() => {
    const bodyText = document.body.innerText

    return {
      totalProductsText: bodyText.match(/([\d.,]+\+?)\s*Ürün/i)?.[1] ?? null,
      cards: Array.from(document.querySelectorAll("a.product-card"))
        .slice(0, 18)
        .map((anchor) => {
          const brand = anchor.querySelector(".product-brand")?.textContent?.trim() ?? null
          const name = anchor.querySelector(".product-name")?.textContent?.trim() ?? null
          const title = anchor.querySelector("h2.title")?.textContent?.trim() ?? null
          const priceText =
            anchor.querySelector('[data-testid="current-price"]')?.textContent?.trim() ??
            anchor.textContent?.match(/([\d.,]+\s*TL)/)?.[1] ??
            null
          const ratingText = anchor.querySelector('[data-testid="average-rating"]')?.textContent?.trim() ?? null
          const reviewCountText =
            anchor.querySelector('[data-testid="ratingCount"]')?.textContent?.trim() ??
            anchor.textContent?.match(/\((\d+[\d.,]*)\)/)?.[0] ??
            null
          const badges = Array.from(anchor.querySelectorAll("[data-testid='hierarchical-badge-title'], .badges *, .stamps *"))
            .map((element) => element.textContent?.trim() ?? "")
            .filter(Boolean)
          const imageUrl = anchor.querySelector("img")?.getAttribute("src") ?? null

          return {
            brand,
            name: name || title || anchor.textContent?.trim() || "Ürün",
            url: anchor.getAttribute("href") ?? "",
            priceText,
            ratingText,
            reviewCountText,
            imageUrl,
            badges,
          }
        }),
    }
  })

  return {
    totalProducts: parseTurkishNumber(payload.totalProductsText?.replace("+", "")),
    cards: payload.cards
      .map((card) => ({
        name: card.name,
        brand: card.brand,
        url: absoluteTrendyolUrl(card.url),
        price: parseTurkishPrice(card.priceText),
        rating: card.ratingText ? Number(card.ratingText.replace(/,/g, ".")) : null,
        reviewCount: parseReviewCount(card.reviewCountText),
        imageUrl: card.imageUrl,
        badges: uniq(card.badges),
      }))
      .sort((left, right) => (right.reviewCount ?? 0) - (left.reviewCount ?? 0))
      .slice(0, 5),
  }
}

async function scrapeTopProductDetails(
  page: Page,
  products: ScrapedStoreProductCard[],
  maxProductDetails: number,
  onItem?: (index: number, total: number) => void
) {
  const details: ScrapedProductDetail[] = []
  const targets = products.slice(0, maxProductDetails)

  for (const [index, product] of targets.entries()) {
    try {
      const detail = await scrapeProductDetail(page, product.url)
      details.push(detail)
    } catch {
      details.push({
        url: product.url,
        name: product.name,
        brand: product.brand,
        price: product.price,
        rating: product.rating,
        reviewCount: product.reviewCount,
        sellerName: null,
        sellerUrl: null,
        categoryLinks: [],
        categories: [],
        images: compact([product.imageUrl]),
        reviewBodies: [],
        competitorOffers: [],
      })
    }

    onItem?.(index, targets.length)
  }

  return details
}

async function scrapeCategoryProductCandidates(
  page: Page,
  productDetails: ScrapedProductDetail[],
  storeName: string,
  productNames: string[],
  maxCategoryPages: number,
  maxCategoryProductsPerPage: number,
  onCategory?: (index: number, total: number, category: string) => void
) {
  const categoryLinks = uniqBy(
    productDetails
      .flatMap((detail) => detail.categoryLinks.slice(-2))
      .filter((link) => link.url && link.name),
    (link) => link.url
  ).slice(-maxCategoryPages)

  const collected: ScrapedCategoryProductCandidate[] = []
  const productKeywords = buildKeywordSet(productNames)
  let keptIndex = 0

  for (const link of categoryLinks) {
    const candidates = await scrapeCategoryProducts(page, link, maxCategoryProductsPerPage)
    const filteredCandidates = candidates.filter((candidate) => !matchesStoreName(candidate.brand ?? candidate.name, storeName))

    if (!hasKeywordOverlap(filteredCandidates, productKeywords)) {
      continue
    }

    collected.push(...filteredCandidates)
    onCategory?.(keptIndex, Math.max(1, Math.min(categoryLinks.length, maxCategoryPages)), link.name)
    keptIndex += 1

    if (keptIndex >= maxCategoryPages) {
      break
    }
  }

  return uniqBy(collected, (candidate) => `${candidate.category}:${candidate.url}`)
}

async function scrapeCategoryProducts(
  page: Page,
  categoryLink: ScrapedCategoryLink,
  maxCategoryProductsPerPage: number
): Promise<ScrapedCategoryProductCandidate[]> {
  await gotoStable(page, categoryLink.url)

  const payload = await page.evaluate((limit) => {
    return Array.from(document.querySelectorAll("a.product-card"))
      .slice(0, Math.max(limit * 3, limit))
      .map((anchor) => {
        const brand = anchor.querySelector(".product-brand")?.textContent?.trim() ?? null
        const name =
          anchor.querySelector(".product-name")?.textContent?.trim() ??
          anchor.querySelector("h2.title")?.textContent?.trim() ??
          anchor.textContent?.trim() ??
          "Ürün"
        const priceText =
          anchor.querySelector('[data-testid="current-price"]')?.textContent?.trim() ??
          anchor.textContent?.match(/([\d.,]+\s*TL)/)?.[1] ??
          null
        const ratingText = anchor.querySelector('[data-testid="average-rating"]')?.textContent?.trim() ?? null
        const reviewCountText =
          anchor.querySelector('[data-testid="ratingCount"]')?.textContent?.trim() ??
          anchor.textContent?.match(/\((\d+[\d.,]*)\)/)?.[0] ??
          null
        const imageUrl = anchor.querySelector("img")?.getAttribute("src") ?? null

        return {
          brand,
          name,
          url: anchor.getAttribute("href") ?? "",
          priceText,
          ratingText,
          reviewCountText,
          imageUrl,
        }
      })
  }, maxCategoryProductsPerPage)

  return payload
    .map((candidate) => ({
      category: categoryLink.name,
      categoryUrl: categoryLink.url,
      brand: candidate.brand,
      name: candidate.name,
      url: absoluteTrendyolUrl(candidate.url),
      price: parseTurkishPrice(candidate.priceText),
      rating: candidate.ratingText ? Number(candidate.ratingText.replace(/,/g, ".")) : null,
      reviewCount: parseReviewCount(candidate.reviewCountText),
      imageUrl: candidate.imageUrl ? absoluteTrendyolUrl(candidate.imageUrl) : null,
    }))
    .filter((candidate) => Boolean(candidate.url) && (candidate.reviewCount ?? 0) > 0)
    .sort((left, right) => (right.reviewCount ?? 0) - (left.reviewCount ?? 0))
    .slice(0, maxCategoryProductsPerPage)
}

async function scrapeProductDetail(page: Page, url: string): Promise<ScrapedProductDetail> {
  await gotoStable(page, url)

  const detail = await page.evaluate(() => {
    const breadcrumbLinks = Array.from(document.querySelectorAll("a"))
      .map((anchor) => ({
        text: anchor.textContent?.trim() ?? "",
        href: anchor.getAttribute("href"),
      }))
      .filter((item) => item.text && item.href)
      .filter((item) => item.text !== "Trendyol")
      .filter((item) => !/-x-b\d+/i.test(item.href ?? ""))
      .filter((item) => /-x-(?:g\d+-)?c\d+/i.test(item.href ?? "") || /\/g\d+-c\d+/i.test(item.href ?? "") || /\/c\d+/i.test(item.href ?? ""))

    const sellerAnchor =
      document.querySelector("a.go-to-store-button")?.closest("div")?.querySelector("a[href*='/magaza/']") ??
      Array.from(document.querySelectorAll("a[href*='/magaza/']")).find((anchor) =>
        (anchor.textContent ?? "").trim().length > 1
      ) ??
      null

    const reviewBodies = Array.from(document.querySelectorAll('script[type="application/ld+json"]'))
      .flatMap((script) => {
        try {
          const parsed = JSON.parse(script.textContent ?? "{}")
          const reviews = Array.isArray(parsed.review) ? parsed.review : []
          return reviews.map((review: { reviewBody?: string }) => review.reviewBody ?? "")
        } catch {
          return []
        }
      })
      .filter(Boolean)
      .slice(0, 30)

    const competitorOffers = Array.from(document.querySelectorAll('[data-testid="other-seller-item"]')).map((item) => ({
      competitorName:
        item.querySelector(".other-seller-header-merchant-name")?.textContent?.trim() ??
        item.querySelector("a")?.textContent?.trim() ??
        "Rakip Satıcı",
      competitorUrl: item.querySelector("a")?.getAttribute("href") ?? null,
      sellerScore: item.querySelector('[data-testid="seller-score"]')?.textContent?.trim() ?? null,
      priceText: item.querySelector('[data-testid="current-price"]')?.textContent?.trim() ?? null,
      deliveryText: item.querySelector('[data-testid="normal-delivery"]')?.textContent?.trim() ?? null,
    }))

    return {
      title: document.querySelector("h1")?.textContent?.trim() ?? document.title,
      brand: document.querySelector(".product-brand")?.textContent?.trim() ?? null,
      priceText:
        document.querySelector('[data-testid="current-price"]')?.textContent?.trim() ??
        document.body.innerText.match(/([\d.,]+\s*TL)/)?.[1] ??
        null,
      reviewSummary:
        Array.from(document.querySelectorAll("a"))
          .map((anchor) => anchor.textContent?.trim() ?? "")
          .find((text) => /Değerlendirme/i.test(text)) ?? null,
      sellerName: sellerAnchor?.textContent?.trim() ?? null,
      sellerUrl: sellerAnchor?.getAttribute("href") ?? null,
      categoryLinks: breadcrumbLinks,
      images: Array.from(document.querySelectorAll("img[src]"))
        .map((img) => img.getAttribute("src") ?? "")
        .filter(Boolean)
        .slice(0, 6),
      reviewBodies,
      competitorOffers,
    }
  })

  const categoryLinks = uniqBy(
    detail.categoryLinks.map((item) => ({
      name: item.text,
      url: absoluteTrendyolUrl(item.href ?? ""),
    })),
    (item) => item.url
  )

  return {
    url: page.url(),
    name: detail.title,
    brand: detail.brand,
    price: parseTurkishPrice(detail.priceText),
    rating: await extractAggregateRating(page),
    reviewCount: parseTurkishNumber(detail.reviewSummary),
    sellerName: detail.sellerName,
    sellerUrl: detail.sellerUrl ? absoluteTrendyolUrl(detail.sellerUrl) : null,
    categoryLinks,
    categories: categoryLinks.map((item) => item.name).slice(0, 6),
    images: uniq(detail.images.map((image) => absoluteTrendyolUrl(image))),
    reviewBodies: detail.reviewBodies,
    competitorOffers: detail.competitorOffers.map((offer) => ({
      competitorName: offer.competitorName,
      competitorUrl: offer.competitorUrl ? absoluteTrendyolUrl(offer.competitorUrl) : null,
      sellerScore: offer.sellerScore ? Number(offer.sellerScore.replace(/,/g, ".")) : null,
      price: parseTurkishPrice(offer.priceText),
      deliveryText: offer.deliveryText,
    })),
  }
}

async function extractAggregateRating(page: Page) {
  const rating = await page.evaluate(() => {
    const reviewAnchor = Array.from(document.querySelectorAll("a")).find((anchor) =>
      (anchor.textContent ?? "").includes("Değerlendirme")
    )
    const container = reviewAnchor?.parentElement?.parentElement
    return (
      container?.querySelector(".rating-line-count")?.textContent?.trim() ??
      document.querySelector(".average-rating")?.textContent?.trim() ??
      null
    )
  })

  if (!rating) {
    return null
  }

  const normalized = Number(rating.replace(/,/g, ".").replace(/[^\d.]/g, ""))
  return Number.isFinite(normalized) ? normalized : null
}

async function gotoStable(page: Page, url: string) {
  await page.goto(url, { waitUntil: "domcontentloaded" })
  await page.waitForSelector("body")
  await page.waitForTimeout(1800)
}

function slugify(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function normalizeName(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

function matchesStoreName(candidate: string, storeName: string) {
  const normalizedCandidate = normalizeName(candidate)
  const normalizedStore = normalizeName(storeName)

  return normalizedCandidate.includes(normalizedStore) || normalizedStore.includes(normalizedCandidate)
}

function buildKeywordSet(values: string[]) {
  return new Set(
    values
      .flatMap((value) => normalizeName(value).split(/\s+/))
      .filter((token) => token.length >= 4)
      .filter((token) => !["kadin", "erkek", "parfum", "deodorant", "kozmetik", "beauty", "spray", "edp", "edt", "jelly"].includes(token))
  )
}

function hasKeywordOverlap(candidates: ScrapedCategoryProductCandidate[], productKeywords: Set<string>) {
  if (productKeywords.size === 0) {
    return true
  }

  return candidates.some((candidate) =>
    normalizeName(`${candidate.brand ?? ""} ${candidate.name}`)
      .split(/\s+/)
      .some((token) => productKeywords.has(token))
  )
}


function uniqBy<T>(items: T[], keyOf: (item: T) => string) {
  const seen = new Set<string>()
  const result: T[] = []

  for (const item of items) {
    const key = keyOf(item)

    if (!key || seen.has(key)) {
      continue
    }

    seen.add(key)
    result.push(item)
  }

  return result
}
