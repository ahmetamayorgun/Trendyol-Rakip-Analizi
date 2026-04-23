import type {
  AnalysisProgressEvent,
  AnalysisReport,
  Competitor,
  PipelineStep,
  TopProduct,
} from "@/lib/analysis/types"
import { scrapeTrendyolStoreAnalysis, type TrendyolScrapeOptions } from "@/lib/trendyol/scrape"
import type { ScrapedCategoryProductCandidate } from "@/lib/trendyol/types"
import { compact, uniq } from "@/lib/trendyol/utils"

const POSITIVE_KEYWORDS = ["hızlı", "kaliteli", "orijinal", "kalıcı", "güzel", "beğendim", "muhteşem"]
const NEGATIVE_KEYWORDS = ["değil", "kalıcı değil", "kötü", "geç", "eksik", "sahte", "hasarlı", "akıttı"]

const BASE_PIPELINE: PipelineStep[] = [
  {
    key: "store",
    label: "Mağaza verisi çıkarılıyor",
    detail: "Mağaza profili, puan ve mağaza metrikleri çözümleniyor.",
    status: "pending",
  },
  {
    key: "products",
    label: "Top ürünler analiz ediliyor",
    detail: "En güçlü ürünlerin PDP sinyalleri, yorumları ve fiyatları toplanıyor.",
    status: "pending",
  },
  {
    key: "categories",
    label: "Kategori keşfi çalışıyor",
    detail: "Kategori sayfalarından best-seller rakip adayları çekiliyor.",
    status: "pending",
  },
  {
    key: "competitors",
    label: "Rakip haritası kuruluyor",
    detail: "Rakip teklifleri ve kategori adayları tek benchmark kümesinde birleştiriliyor.",
    status: "pending",
  },
  {
    key: "strategy",
    label: "Stratejik çıktı üretiliyor",
    detail: "Fırsatlar, tehditler ve aksiyon planı anlamlandırılıyor.",
    status: "pending",
  },
]

export interface LiveAnalysisOptions extends Pick<TrendyolScrapeOptions, "maxCategoryPages" | "maxCategoryProductsPerPage" | "maxProductDetails"> {
  onProgress?: (event: AnalysisProgressEvent) => void
}

export async function generateLiveAnalysisReport(
  url: string,
  focus?: string,
  options: LiveAnalysisOptions = {}
): Promise<AnalysisReport> {
  const pipeline = BASE_PIPELINE.map((step) => ({ ...step }))
  const emit = createProgressEmitter(pipeline, options.onProgress)

  emit({
    progress: 5,
    message: "Canlı Trendyol browser analizi başlatıldı.",
    updates: [
      {
        key: "store",
        status: "running",
        detail: "Mağaza giriş noktası çözülüyor.",
      },
    ],
  })

  const { store, productDetails, categoryProducts } = await scrapeTrendyolStoreAnalysis(url, {
    maxProductDetails: options.maxProductDetails,
    maxCategoryPages: options.maxCategoryPages,
    maxCategoryProductsPerPage: options.maxCategoryProductsPerPage,
    onProgress: (event) => {
      if (event.stage === "store") {
        emit({
          progress: event.progress,
          message: event.detail,
          updates: [
            {
              key: "store",
              status: event.progress >= 24 ? "running" : "running",
              detail: event.detail,
            },
          ],
        })
        return
      }

      if (event.stage === "products") {
        emit({
          progress: event.progress,
          message: event.detail,
          updates: [
            {
              key: "store",
              status: "complete",
              detail: "Mağaza profili ve ürün vitrini çözümlendi.",
            },
            {
              key: "products",
              status: "running",
              detail: event.detail,
            },
          ],
        })
        return
      }

      emit({
        progress: event.progress,
        message: event.detail,
        updates: [
          {
            key: "store",
            status: "complete",
            detail: "Mağaza profili ve ürün vitrini çözümlendi.",
          },
          {
            key: "products",
            status: "complete",
            detail: "Top ürünlerin PDP verisi canlı olarak toplandı.",
          },
          {
            key: "categories",
            status: "running",
            detail: event.detail,
          },
        ],
      })
    },
  })

  emit({
    progress: 84,
    message: "Rakip benchmark kümesi birleştiriliyor.",
    updates: [
      {
        key: "store",
        status: "complete",
        detail: `${store.name} mağaza profili, takipçi ve ürün sayısı doğrulandı.`,
      },
      {
        key: "products",
        status: "complete",
        detail: `${productDetails.length} top ürün için PDP detayı ve yorum örnekleri toplandı.`,
      },
      {
        key: "categories",
        status: "complete",
        detail:
          categoryProducts.length > 0
            ? `${uniq(categoryProducts.map((item) => item.category)).length} kategoride ${categoryProducts.length} bestseller aday bulundu.`
            : "Kategori sayfalarında ek rakip adayı bulunamadı; ürün sayfası teklifleri kullanılacak.",
      },
      {
        key: "competitors",
        status: "running",
        detail: "Ürün sayfası teklifleri ve kategori bestseller adayları bir araya getiriliyor.",
      },
    ],
  })

  const topProducts: TopProduct[] = store.featuredProducts.map((product) => {
    const detail = productDetails.find((item) => item.url.includes(extractIdFragment(product.url)))
    const reviews = detail?.reviewBodies ?? []

    return {
      name: product.name,
      price: product.price ?? detail?.price ?? 0,
      rating: product.rating ?? detail?.rating ?? normalizeSellerScore(store.sellerScore) ?? 0,
      reviewCount: product.reviewCount ?? detail?.reviewCount ?? 0,
      category: detail?.categories.at(-1) ?? detail?.categories.at(-2) ?? "Kategori bulunamadı",
      images: detail?.images ?? [],
      imageQuality: estimateImageQuality(detail?.images.length ?? 0),
      reviewPatterns: deriveReviewPatterns(reviews),
    }
  })

  const allCategories = uniq([
    ...productDetails.flatMap((detail) => detail.categories),
    ...categoryProducts.map((candidate) => candidate.category),
  ])
  const mainCategories = uniq(productDetails.flatMap((detail) => detail.categories.slice(0, 2)).filter(Boolean))
  const subCategories = uniq([
    ...productDetails.flatMap((detail) => detail.categories.slice(-2)).filter(Boolean),
    ...categoryProducts.map((candidate) => candidate.category),
  ])

  const competitors = aggregateCompetitors(productDetails, categoryProducts, store.name)
  const averageStorePrice = average(topProducts.map((item) => item.price))
  const averageCompetitorPrice = average(compact(competitors.map((item) => item.price)))
  const averageStoreRating = average(topProducts.map((item) => item.rating))
  const averageCompetitorRating = average(compact(competitors.map((item) => item.rating)))
  const storeReviewVolume = topProducts.reduce((sum, item) => sum + item.reviewCount, 0)
  const competitorReviewVolume = competitors.reduce((sum, item) => sum + item.reviewCount, 0)

  const premiumBenchmark = competitors.find((item) => item.rating >= 4.5 && item.price >= averageCompetitorPrice) ?? competitors[0]
  const weakCompetitor = competitors.find((item) => item.rating <= 4.2 && item.reviewCount >= 100)

  emit({
    progress: 92,
    message: "Stratejik rapor yazılıyor.",
    updates: [
      {
        key: "competitors",
        status: "complete",
        detail: `${competitors.length} rakip benchmark kümesi oluşturuldu.`,
      },
      {
        key: "strategy",
        status: "running",
        detail: "Fiyat, puan ve yorum benchmark'ı içgörüye dönüştürülüyor.",
      },
    ],
  })

  const report: AnalysisReport = {
    requestedUrl: url,
    requestedAt: new Date().toISOString(),
    focus: focus?.trim() || "Canlı mağaza verisi + kategori bazlı rakip benchmarkı",
    storeIdentity: {
      name: store.name,
      rating: normalizeSellerScore(store.sellerScore) ?? averageStoreRating,
      followerCount: store.followerCount ?? 0,
      totalProducts: store.totalProducts ?? store.featuredProducts.length,
      priceSegment: describePricePosition(averageStorePrice, averageCompetitorPrice),
      brandType: store.totalProducts != null && store.totalProducts > 250 ? "Geniş ürün gamlı mağaza" : "Kategori odaklı mağaza",
      targetProfile: subCategories[0] ?? allCategories[0] ?? "Kategori sinyali çıkarılamadı",
    },
    categories: {
      main: mainCategories.length > 0 ? mainCategories : allCategories.slice(0, 2),
      sub: subCategories.length > 0 ? subCategories : allCategories.slice(-2),
    },
    featuredProducts: topProducts.slice(0, 3).map((item) => item.name),
    topProducts,
    competitors,
    marketAnalysis: {
      priceComparison:
        averageStorePrice >= averageCompetitorPrice
          ? `Mağaza ürün fiyat ortalaması rakip benchmark ortalamasının yaklaşık %${Math.round(percentDelta(averageStorePrice, averageCompetitorPrice))} üzerinde.`
          : `Mağaza ürün fiyat ortalaması rakip benchmark ortalamasının yaklaşık %${Math.round(percentDelta(averageCompetitorPrice, averageStorePrice))} altında.`,
      ratingComparison:
        averageStoreRating >= averageCompetitorRating
          ? "Top ürün puanları rakip benchmark kümesinden güçlü; kalite mesajını PDP ve mağaza vitrini üzerinde daha görünür taşımak mantıklı."
          : "Rakip benchmark puanları bazı alt kategorilerde daha güçlü; yorum itirazları ve ürün açıklamaları iyileştirilmeli.",
      reviewVolumeComparison:
        storeReviewVolume >= competitorReviewVolume
          ? "Top ürün yorum hacmi rakip benchmark kümesine göre güçlü; sosyal kanıtı kampanya görsellerine taşımak avantaj sağlar."
          : "Rakip benchmark kümesindeki yorum hacmi daha yüksek; yorum toplama ve tekrar satın alma kurgusu güçlendirilmeli.",
      hiddenInsight: weakCompetitor
        ? `${weakCompetitor.name} görünür bir rakip ama puan seviyesi kırılgan. Aynı kategoride daha güven veren PDP ile pay alınabilir.`
        : premiumBenchmark
          ? `${premiumBenchmark.name} premium benchmark görevi görüyor; mağaza bu seviyeye yakın kaliteyi daha erişilebilir fiyatla konumlayabilir.`
          : "İlk canlı veri setinde yeterli rakip baskı sinyali bulunamadı.",
    },
    opportunities: buildOpportunities(topProducts, competitors),
    threats: buildThreats(competitors, premiumBenchmark),
    actionPlan: buildActionPlan(topProducts, competitors),
    pipeline,
    collectionNote:
      "Bu rapor canlı browser capture ile mağaza profili, mağaza ürün listesi, ürün sayfasındaki diğer satıcı blokları ve kategori best-seller listelerinden üretildi. Stratejik etiketler gözlemlenen veriler üzerinden çıkarımdır.",
  }

  emit({
    progress: 100,
    message: "Canlı rapor hazır.",
    updates: [
      {
        key: "strategy",
        status: "complete",
        detail: "Fırsatlar, tehditler ve aksiyon planı üretildi.",
      },
    ],
  })

  report.pipeline = pipeline.map((step) => ({ ...step }))
  return report
}

function aggregateCompetitors(
  productDetails: Awaited<ReturnType<typeof scrapeTrendyolStoreAnalysis>>["productDetails"],
  categoryProducts: ScrapedCategoryProductCandidate[],
  storeName: string
): Competitor[] {
  const grouped = new Map<string, RankedCompetitor>()
  const context = buildMatchContext(productDetails, categoryProducts)

  for (const detail of productDetails) {
    for (const offer of detail.competitorOffers) {
      if (!offer.competitorName || normalizeName(offer.competitorName) === normalizeName(storeName)) {
        continue
      }

      upsertCompetitor(grouped, offer.competitorName, rankCompetitorCandidate(context, {
        name: offer.competitorName,
        category: detail.categories.at(-1) ?? detail.categories.at(-2) ?? "Kategori bulunamadı",
        productName: detail.name,
        price: offer.price ?? detail.price ?? 0,
        rating: normalizeSellerScore(offer.sellerScore) ?? detail.rating ?? 0,
        reviewCount: detail.reviewCount ?? 0,
        imageQuality: estimateImageQuality(detail.images.length),
        benchmarkTag: buildOfferBenchmarkTag(offer.price ?? 0, detail.price ?? 0, normalizeSellerScore(offer.sellerScore), detail.categories.at(-1)),
        source: "offer",
      }))
    }
  }

  for (const candidate of categoryProducts) {
    const candidateName = candidate.brand ?? candidate.name.split(" ").slice(0, 2).join(" ")

    if (!candidateName || normalizeName(candidateName) === normalizeName(storeName)) {
      continue
    }

    upsertCompetitor(grouped, candidateName, rankCompetitorCandidate(context, {
      name: candidateName,
      category: candidate.category,
      productName: candidate.name,
      price: candidate.price ?? 0,
      rating: candidate.rating ?? 0,
      reviewCount: candidate.reviewCount ?? 0,
      imageQuality: candidate.imageUrl ? "Orta" : "Düşük",
      benchmarkTag: buildCategoryBenchmarkTag(candidate),
      source: "category",
    }))
  }

  return Array.from(grouped.values())
    .sort((left, right) => {
      if (right.matchScore !== left.matchScore) {
        return right.matchScore - left.matchScore
      }

      if (right.reviewCount !== left.reviewCount) {
        return right.reviewCount - left.reviewCount
      }

      return right.rating - left.rating
    })
    .slice(0, 10)
}

function upsertCompetitor(grouped: Map<string, RankedCompetitor>, key: string, next: RankedCompetitor) {
  const normalizedKey = canonicalCompetitorKey(key)
  const current = grouped.get(normalizedKey)

  if (!current) {
    grouped.set(normalizedKey, next)
    return
  }

  grouped.set(normalizedKey, pickStrongerCompetitor(current, next))
}

function pickStrongerCompetitor(current: RankedCompetitor, next: RankedCompetitor) {
  const currentScore = current.matchScore * 1000 + current.reviewCount * 0.02 + current.rating * 10
  const nextScore = next.matchScore * 1000 + next.reviewCount * 0.02 + next.rating * 10

  if (nextScore > currentScore) {
    return {
      ...next,
      benchmarkTag: next.benchmarkTag || current.benchmarkTag,
      matchReasons: uniq([...next.matchReasons, ...current.matchReasons]).slice(0, 4),
    }
  }

  return {
    ...current,
    name: pickDisplayName(current.name, next.name),
    price: current.price || next.price,
    rating: current.rating || next.rating,
    reviewCount: Math.max(current.reviewCount, next.reviewCount),
    benchmarkTag: current.benchmarkTag || next.benchmarkTag,
    matchScore: Math.max(current.matchScore, next.matchScore),
    confidence: pickHigherConfidence(current.confidence, next.confidence),
    matchReasons: uniq([...current.matchReasons, ...next.matchReasons]).slice(0, 4),
  }
}

interface CompetitorSeed {
  name: string
  category: string
  productName: string
  price: number
  rating: number
  reviewCount: number
  imageQuality: Competitor["imageQuality"]
  benchmarkTag: string
  source: "offer" | "category"
}

interface RankedCompetitor extends Competitor {
  source: "offer" | "category"
}

interface MatchContext {
  categoryTokens: Set<string>
  productTokens: Set<string>
  averagePrice: number
  averageReviewCount: number
}

function buildMatchContext(
  productDetails: Awaited<ReturnType<typeof scrapeTrendyolStoreAnalysis>>["productDetails"],
  categoryProducts: ScrapedCategoryProductCandidate[]
): MatchContext {
  const categories = [
    ...productDetails.flatMap((detail) => detail.categories),
    ...categoryProducts.map((candidate) => candidate.category),
  ]
  const productNames = [
    ...productDetails.map((detail) => detail.name),
    ...productDetails.map((detail) => detail.brand ?? "").filter(Boolean),
  ]

  return {
    categoryTokens: buildKeywordSet(categories),
    productTokens: buildKeywordSet(productNames),
    averagePrice: average(compact(productDetails.map((detail) => detail.price ?? 0))),
    averageReviewCount: average(compact(productDetails.map((detail) => detail.reviewCount ?? 0))),
  }
}

function rankCompetitorCandidate(context: MatchContext, candidate: CompetitorSeed): RankedCompetitor {
  const competitorCategoryTokens = buildKeywordSet([candidate.category])
  const competitorProductTokens = buildKeywordSet([candidate.productName, candidate.name])
  const categoryOverlap = tokenOverlapScore(competitorCategoryTokens, context.categoryTokens)
  const keywordOverlap = tokenOverlapScore(competitorProductTokens, context.productTokens)
  const priceSimilarity = similarityByDistance(candidate.price, context.averagePrice)
  const reviewSimilarity = similarityByDistance(candidate.reviewCount, context.averageReviewCount)
  const sourceConfidence = candidate.source === "offer" ? 1 : 0.78
  const matchScore = roundScore(
    categoryOverlap * 0.3 +
      keywordOverlap * 0.25 +
      priceSimilarity * 0.2 +
      reviewSimilarity * 0.15 +
      sourceConfidence * 0.1
  )

  return {
    name: candidate.name,
    category: candidate.category,
    productName: candidate.productName,
    price: candidate.price,
    rating: candidate.rating,
    reviewCount: candidate.reviewCount,
    imageQuality: candidate.imageQuality,
    benchmarkTag: candidate.benchmarkTag,
    matchScore,
    confidence: scoreToConfidence(matchScore),
    matchReasons: buildMatchReasons({
      candidate,
      categoryOverlap,
      keywordOverlap,
      priceSimilarity,
      reviewSimilarity,
    }),
    source: candidate.source,
  }
}

function buildMatchReasons({
  candidate,
  categoryOverlap,
  keywordOverlap,
  priceSimilarity,
  reviewSimilarity,
}: {
  candidate: CompetitorSeed
  categoryOverlap: number
  keywordOverlap: number
  priceSimilarity: number
  reviewSimilarity: number
}) {
  return uniq([
    categoryOverlap >= 0.6 ? `Kategori uyumu güçlü: ${candidate.category}` : null,
    keywordOverlap >= 0.45 ? "Ürün tipi ve anahtar kelime sinyali benzer" : null,
    priceSimilarity >= 0.75 ? "Benzer fiyat bandında konumlanıyor" : null,
    reviewSimilarity >= 0.65 ? "Benzer yorum hacmi bandında yarışıyor" : null,
    candidate.source === "offer" ? "Aynı PDP'de diğer satıcı olarak göründü" : "Kategori bestseller listesinden geldi",
  ].filter(Boolean) as string[]).slice(0, 4)
}

function deriveReviewPatterns(reviews: string[]) {
  if (reviews.length === 0) {
    return [
      "Canlı sayfada yorum gövdesi sınırlı geldi; PDP açıklamalarıyla destek gereksinimi yüksek.",
      "Ürün yorum verisi yetersiz olduğu için yorum toplama stratejisi kritik.",
    ]
  }

  const positives = reviews.filter((review) => POSITIVE_KEYWORDS.some((keyword) => review.toLocaleLowerCase("tr-TR").includes(keyword))).length
  const negatives = reviews.filter((review) => NEGATIVE_KEYWORDS.some((keyword) => review.toLocaleLowerCase("tr-TR").includes(keyword))).length

  return uniq([
    positives > 0 ? "Yorumlarda memnuniyet ve orijinallik vurgusu tekrar ediyor." : null,
    negatives > 0 ? "Yorumlarda beklenti yönetimi veya kalıcılık gibi itirazlar dikkat çekiyor." : null,
    reviews.some((review) => review.toLocaleLowerCase("tr-TR").includes("kargo"))
      ? "Teslimat deneyimi satın alma kararını etkileyen belirgin bir sinyal."
      : null,
    reviews.some((review) => review.toLocaleLowerCase("tr-TR").includes("kalıcı"))
      ? "Kalıcılık/performance söylemi ürün anlatısında öne çıkarılabilir."
      : null,
  ].filter(Boolean) as string[]).slice(0, 3)
}

function estimateImageQuality(imageCount: number) {
  if (imageCount >= 5) {
    return "Yüksek" as const
  }

  if (imageCount >= 2) {
    return "Orta" as const
  }

  return "Düşük" as const
}

function normalizeSellerScore(score: number | null | undefined) {
  if (score == null || Number.isNaN(score)) {
    return null
  }

  return score > 5 ? Math.round((score / 2) * 100) / 100 : score
}

function describePricePosition(storePrice: number, competitorPrice: number) {
  if (storePrice >= competitorPrice * 1.08) {
    return "Premium-orta üst"
  }

  if (storePrice <= competitorPrice * 0.92) {
    return "Erişilebilir fiyat"
  }

  return "Orta segment"
}

function buildOfferBenchmarkTag(price: number, referencePrice: number, sellerRating: number | null, category?: string) {
  if (price >= referencePrice * 1.05 && (sellerRating ?? 0) >= 4.5) {
    return "Premium benchmark"
  }

  if ((sellerRating ?? 0) <= 4.2) {
    return "Kalite açığı fırsatı"
  }

  return `${category ?? "Kategori"} satıcısı`
}

function buildCategoryBenchmarkTag(candidate: ScrapedCategoryProductCandidate) {
  if ((candidate.reviewCount ?? 0) >= 5000 && (candidate.rating ?? 0) >= 4.5) {
    return "Kategori bestseller"
  }

  if ((candidate.rating ?? 0) <= 4.2 && (candidate.reviewCount ?? 0) >= 1000) {
    return "Düşük puan fırsatı"
  }

  return `${candidate.category} benchmark`
}

function buildOpportunities(topProducts: TopProduct[], competitors: Competitor[]) {
  const lowRatedCompetitor = competitors.find((item) => item.rating <= 4.2 && item.reviewCount >= 500)
  const weakImageCompetitor = competitors.find((item) => item.imageQuality === "Düşük")
  const strongestProduct = topProducts[0]

  return [
    {
      title: "Düşük puanlı görünür rakip boşluğu",
      detail: lowRatedCompetitor
        ? `${lowRatedCompetitor.name} yüksek görünürlük taşıyor ama puanı kırılgan. Aynı kategoride daha güven veren PDP ile pay alınabilir.`
        : "Canlı rakip kümesinde düşük puanlı görünür oyuncu az; güven, teslimat ve açıklama derinliği ana farklılaştırıcı olarak kullanılmalı.",
      impact: "Yüksek" as const,
    },
    {
      title: "Kategori vitrininde best-seller ile giriş yap",
      detail: `${strongestProduct.name} yorum hacmi ve puanıyla mağazanın giriş ürünü olabilir. Reklam ve mağaza vitrini bu ürün etrafında optimize edilebilir.`,
      impact: "Yüksek" as const,
    },
    {
      title: "Görsel kalite ve PDP derinliği fırsatı",
      detail: weakImageCompetitor
        ? `${weakImageCompetitor.name} sınırlı görsel yoğunluk sinyali veriyor. Ürün görselleri ve fayda bloklarıyla ayrışma fırsatı yüksek.`
        : "Rakipler benzer fiyat bandında; ürün görselleri ve açıklama derinliğiyle ayrışma fırsatı sürüyor.",
      impact: "Orta" as const,
    },
  ]
}

function buildThreats(competitors: Competitor[], premiumBenchmark?: Competitor) {
  return [
    {
      title: "Premium benchmark baskısı",
      detail: premiumBenchmark
        ? `${premiumBenchmark.name} yüksek güven ve fiyat seviyesiyle kategori çıpası oluşturuyor.`
        : "Rakip kümesinde premium çıpa oyuncular bulunuyor; fiyat tek başına yeterli savunma olmayabilir.",
      severity: "Yüksek" as const,
    },
    {
      title: "Yüksek puan kümelenmesi",
      detail: `${competitors.filter((item) => item.rating >= 4.5).length} rakip 4.5+ puanda. PDP güven sinyalleri güçlendirilmezse dönüşüm baskısı oluşur.`,
      severity: "Kritik" as const,
    },
    {
      title: "Fiyat sıkışması",
      detail: "Aynı kategori çevresinde çok sayıda satıcı ve marka yakın fiyatlarda konumlanıyor; sadece indirimle rekabet etmek marjı zorlar.",
      severity: "Orta" as const,
    },
  ]
}

function buildActionPlan(topProducts: TopProduct[], competitors: Competitor[]) {
  const leadProduct = topProducts[0]
  const strongestCompetitor = competitors[0]

  return [
    {
      title: "En güçlü ürünü landing product olarak yeniden paketle",
      owner: "Kategori + içerik",
      horizon: "7 gün",
      detail: `${leadProduct.name} için kapak görseli, fayda blokları ve yorum özetini daha görünür hale getir.`,
    },
    {
      title: "Rakip fiyat bandına göre kontrollü fiyat testi yap",
      owner: "Ticari ekip",
      horizon: "10 gün",
      detail: `${strongestCompetitor?.name ?? "ilk rakip küme"} fiyat bandına göre giriş/ana/premium ürün ayrımıyla fiyat denemesi kur.`,
    },
    {
      title: "Yorumlardan çıkan itirazları PDP'ye taşı",
      owner: "CRM + içerik",
      horizon: "10 gün",
      detail: "Top 30 yorumda tekrar eden kalite, kalıcılık ve teslimat itirazlarını açıklama ve SSS bloklarına ekle.",
    },
  ]
}

function average(values: number[]) {
  const safeValues = values.filter((value) => Number.isFinite(value) && value > 0)

  if (safeValues.length === 0) {
    return 0
  }

  return safeValues.reduce((sum, value) => sum + value, 0) / safeValues.length
}

function percentDelta(base: number, compare: number) {
  if (!compare) {
    return 0
  }

  return ((base - compare) / compare) * 100
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

function canonicalCompetitorKey(value: string) {
  return normalizeName(value)
    .replace(/\b(magazacilik|magazacilik a s|magaza|store|official|resmi|satıcı|satici|ticaret|sanayi|ve)\b/g, " ")
    .replace(/\b(a s|as|ltd|sti)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function buildKeywordSet(values: string[]) {
  return new Set(
    values
      .flatMap((value) => normalizeName(value).split(/\s+/))
      .filter((token) => token.length >= 4)
      .filter(
        (token) =>
          ![
            "kadin",
            "erkek",
            "urun",
            "parfum",
            "kozmetik",
            "beauty",
            "ml",
            "adet",
            "edp",
            "edt",
          ].includes(token)
      )
  )
}

function tokenOverlapScore(left: Set<string>, right: Set<string>) {
  if (left.size === 0 || right.size === 0) {
    return 0
  }

  let overlap = 0
  for (const token of left) {
    if (right.has(token)) {
      overlap += 1
    }
  }

  return overlap / Math.max(Math.min(left.size, right.size), 1)
}

function similarityByDistance(value: number, baseline: number) {
  if (!value || !baseline) {
    return 0
  }

  return Math.max(0, 1 - Math.abs(value - baseline) / baseline)
}

function roundScore(value: number) {
  return Math.round(value * 100) / 100
}

function scoreToConfidence(score: number): Competitor["confidence"] {
  if (score >= 0.78) {
    return "Yüksek"
  }

  if (score >= 0.58) {
    return "Orta"
  }

  return "Düşük"
}

function pickHigherConfidence(
  left: Competitor["confidence"],
  right: Competitor["confidence"]
): Competitor["confidence"] {
  const rank = {
    Düşük: 0,
    Orta: 1,
    Yüksek: 2,
  }

  return rank[left] >= rank[right] ? left : right
}

function pickDisplayName(current: string, next: string) {
  return current.length >= next.length ? current : next
}

function extractIdFragment(url: string) {
  return url.split("?")[0].split("-").at(-1) ?? url
}

function createProgressEmitter(pipeline: PipelineStep[], onProgress?: (event: AnalysisProgressEvent) => void) {
  return ({
    progress,
    message,
    updates,
  }: {
    progress: number
    message: string
    updates: Array<Partial<PipelineStep> & Pick<PipelineStep, "key">>
  }) => {
    for (const update of updates) {
      const target = pipeline.find((step) => step.key === update.key)

      if (!target) {
        continue
      }

      if (update.label) {
        target.label = update.label
      }

      if (update.detail) {
        target.detail = update.detail
      }

      if (update.status) {
        target.status = update.status
      }
    }

    onProgress?.({
      progress,
      message,
      pipeline: pipeline.map((step) => ({ ...step })),
    })
  }
}
