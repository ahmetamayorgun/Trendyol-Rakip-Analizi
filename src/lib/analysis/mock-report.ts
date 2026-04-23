import { AnalysisReport, Competitor, PipelineStep, TopProduct } from "@/lib/analysis/types"

const CATEGORY_MAP = [
  {
    main: "Kadın Giyim",
    subs: ["Elbise", "Bluz", "Takım", "Pantolon"],
    keywords: ["premium basic", "günlük kombin", "ofis stili"],
  },
  {
    main: "Ev & Yaşam",
    subs: ["Dekorasyon", "Mutfak", "Organizer", "Banyo"],
    keywords: ["minimal tasarım", "fonksiyonel ürün", "hediyelik"],
  },
  {
    main: "Kozmetik",
    subs: ["Cilt Bakımı", "Saç Bakımı", "Makyaj", "Kişisel Bakım"],
    keywords: ["hassas cilt", "bakım rutini", "yüksek tekrar satın alma"],
  },
  {
    main: "Spor Outdoor",
    subs: ["Tayt", "Eşofman", "Matara", "Aksesuar"],
    keywords: ["performans odaklı", "fitness", "aktif yaşam"],
  },
]

const PRODUCT_ADJECTIVES = ["Essential", "Studio", "Soft", "Prime", "Daily", "Aura", "Urban", "Nova"]
const PRODUCT_NOUNS = ["Set", "Seri", "Koleksiyon", "Basic", "Line", "Edit", "Touch", "Fit"]
const COMPETITOR_PREFIXES = ["Moda", "Trend", "Nexa", "Viva", "Mori", "Pera", "Luna", "Vera"]
const REVIEW_PATTERNS = [
  "Kumaş kalitesi beklentinin üzerinde",
  "Beden/ölçü bilgisi daha net olmalı",
  "Paketleme ve hızlı teslimat olumlu algı yaratıyor",
  "Görseller ile ürün tonu arasında küçük fark algılanıyor",
  "Fiyat-performans vurgusu satın alma kararını hızlandırıyor",
  "İkinci sipariş ihtimali yorumlarda tekrar ediyor",
]

function hashString(value: string) {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0
  }
  return hash
}

function seeded(seed: number) {
  let state = seed || 1
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296
    return state / 4294967296
  }
}

function titleFromSlug(url: string) {
  try {
    const parsed = new URL(url)
    const token = parsed.pathname
      .split("/")
      .filter(Boolean)
      .find((segment) => segment && !segment.startsWith("m-") && !segment.startsWith("p-"))

    const cleaned = (token ?? "ornek-magaza")
      .replace(/[-_]+/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase())

    return cleaned
  } catch {
    return "Ornek Magaza"
  }
}

function pickMany<T>(list: T[], count: number, random: () => number) {
  const clone = [...list]
  const picked: T[] = []
  while (clone.length > 0 && picked.length < count) {
    picked.push(clone.splice(Math.floor(random() * clone.length), 1)[0])
  }
  return picked
}

function formatPrice(value: number) {
  return Math.round(value * 100) / 100
}

function buildTopProducts(random: () => number, subCategories: string[]): TopProduct[] {
  return Array.from({ length: 5 }, (_, index) => {
    const category = subCategories[index % subCategories.length]
    const adjective = PRODUCT_ADJECTIVES[Math.floor(random() * PRODUCT_ADJECTIVES.length)]
    const noun = PRODUCT_NOUNS[Math.floor(random() * PRODUCT_NOUNS.length)]
    const price = formatPrice(299 + random() * 650)
    const rating = formatPrice(3.9 + random() * 0.9)
    const reviewCount = Math.floor(180 + random() * 3400)
    const imageQuality: TopProduct["imageQuality"] = rating > 4.4 ? "Yüksek" : rating > 4.15 ? "Orta" : "Düşük"

    return {
      name: `${adjective} ${category} ${noun}`,
      price,
      rating,
      reviewCount,
      category,
      images: [],
      imageQuality,
      reviewPatterns: pickMany(REVIEW_PATTERNS, 3, random),
    }
  }).sort((left, right) => right.reviewCount - left.reviewCount)
}

function buildCompetitors(random: () => number, mainCategories: string[], subCategories: string[]): Competitor[] {
  return Array.from({ length: 10 }, (_, index) => {
    const category = subCategories[index % subCategories.length]
    const prefix = COMPETITOR_PREFIXES[Math.floor(random() * COMPETITOR_PREFIXES.length)]
    const suffix = COMPETITOR_PREFIXES[Math.floor(random() * COMPETITOR_PREFIXES.length)]
    const price = formatPrice(249 + random() * 820)
    const rating = formatPrice(3.7 + random() * 1.1)
    const reviewCount = Math.floor(120 + random() * 6200)
    const imageQuality: Competitor["imageQuality"] = reviewCount > 2500 ? "Yüksek" : reviewCount > 1200 ? "Orta" : "Düşük"
    const benchmarkTag =
      rating >= 4.6 && price >= 650
        ? "Premium benchmark"
        : rating <= 4.2 && reviewCount >= 1800
          ? "Zayıf kalite fırsatı"
          : `${mainCategories[index % mainCategories.length]} oyuncusu`
    const matchScore = formatPrice(0.52 + random() * 0.4)
    const confidence: Competitor["confidence"] =
      matchScore >= 0.78 ? "Yüksek" : matchScore >= 0.62 ? "Orta" : "Düşük"

    return {
      name: `${prefix} ${suffix}`,
      category,
      productName: `${category} ${PRODUCT_NOUNS[index % PRODUCT_NOUNS.length]}`,
      price,
      rating,
      reviewCount,
      imageQuality,
      benchmarkTag,
      matchScore,
      confidence,
      matchReasons: [
        `Alt kategori eşleşmesi: ${category}`,
        price >= 650 ? "Benzer premium fiyat bandı" : "Benzer erişilebilir fiyat bandı",
        reviewCount >= 1800 ? "Yorum hacmi karşılaştırmaya uygun" : "Kategori içinde görünür yorum hacmi",
      ],
    }
  }).sort((left, right) => right.matchScore - left.matchScore || right.reviewCount - left.reviewCount)
}

function buildPipeline(): PipelineStep[] {
  return [
    {
      key: "store",
      label: "Mağaza verisi çıkarıldı",
      detail: "Mağaza kimliği, puan ve ürün yoğunluğu çıkarımı hazırlandı.",
      status: "complete",
    },
    {
      key: "products",
      label: "Top ürünler eşlendi",
      detail: "En çok yorumlanan ürünler ve yorum pattern kümeleri belirlendi.",
      status: "complete",
    },
    {
      key: "competitors",
      label: "Rakip adayları sıralandı",
      detail: "Kategori, fiyat bandı ve yorum hacmine göre rakip skorlama yapıldı.",
      status: "complete",
    },
    {
      key: "strategy",
      label: "Stratejik çıktı üretildi",
      detail: "Fırsat, tehdit ve aksiyon seti rapora dönüştürüldü.",
      status: "complete",
    },
  ]
}

export function generateAnalysisReport(url: string, focus?: string): AnalysisReport {
  const safeUrl = url.trim()
  const seed = hashString(safeUrl)
  const random = seeded(seed)
  const storeName = titleFromSlug(safeUrl)
  const categoryPack = CATEGORY_MAP[Math.floor(random() * CATEGORY_MAP.length)]
  const main = [categoryPack.main, CATEGORY_MAP[Math.floor(random() * CATEGORY_MAP.length)].main]
  const sub = pickMany(categoryPack.subs, 3, random)
  const topProducts = buildTopProducts(random, sub)
  const competitors = buildCompetitors(random, main, sub)

  const averageStorePrice = topProducts.reduce((sum, item) => sum + item.price, 0) / topProducts.length
  const averageCompetitorPrice = competitors.reduce((sum, item) => sum + item.price, 0) / competitors.length
  const averageStoreRating = topProducts.reduce((sum, item) => sum + item.rating, 0) / topProducts.length
  const averageCompetitorRating = competitors.reduce((sum, item) => sum + item.rating, 0) / competitors.length
  const storeReviewVolume = topProducts.reduce((sum, item) => sum + item.reviewCount, 0)
  const competitorReviewVolume = competitors.reduce((sum, item) => sum + item.reviewCount, 0)

  const premiumBenchmark = competitors.find((item) => item.benchmarkTag === "Premium benchmark") ?? competitors[0]
  const weakVisuals = competitors.filter((item) => item.imageQuality === "Düşük").slice(0, 2)
  const lowRatedHighVolume = competitors.find(
    (item) => item.rating <= 4.2 && item.reviewCount >= 1800
  )

  return {
    requestedUrl: safeUrl,
    requestedAt: new Date().toISOString(),
    focus: focus?.trim() || "Genel rakip analizi ve kategori benchmarkı",
    storeIdentity: {
      name: storeName,
      rating: formatPrice(4.1 + random() * 0.7),
      followerCount: Math.floor(1200 + random() * 78000),
      totalProducts: Math.floor(35 + random() * 620),
      priceSegment:
        averageStorePrice >= averageCompetitorPrice * 1.1
          ? "Premium-orta üst"
          : averageStorePrice <= averageCompetitorPrice * 0.92
            ? "Erişilebilir fiyat"
            : "Orta segment",
      brandType: random() > 0.5 ? "Kategori uzmanı butik mağaza" : "Genişleyen niş marka",
      targetProfile: categoryPack.keywords[Math.floor(random() * categoryPack.keywords.length)],
    },
    categories: {
      main,
      sub,
    },
    featuredProducts: topProducts.slice(0, 3).map((item) => item.name),
    topProducts,
    competitors,
    marketAnalysis: {
      priceComparison:
        averageStorePrice >= averageCompetitorPrice
          ? `Mağaza ortalama fiyatı rakip ortalamasının yaklaşık %${Math.round(((averageStorePrice - averageCompetitorPrice) / averageCompetitorPrice) * 100)} üzerinde.`
          : `Mağaza ortalama fiyatı rakip ortalamasının yaklaşık %${Math.round(((averageCompetitorPrice - averageStorePrice) / averageCompetitorPrice) * 100)} altında.`,
      ratingComparison:
        averageStoreRating >= averageCompetitorRating
          ? "Ürün puan ortalaması kategori ortalamasının üzerinde; kalite anlatısını güçlendirmek mantıklı."
          : "Puan ortalaması rakip ortalamasının altında; yorum kaynaklı güven kırılması olabilir.",
      reviewVolumeComparison:
        storeReviewVolume >= competitorReviewVolume * 0.45
          ? "Yorum hacmi rakip grubuna göre anlamlı; görünürlük avantaja çevrilebilir."
          : "Rakipler toplam yorum hacminde önde; sosyal kanıt açığı kapatılmalı.",
      hiddenInsight: lowRatedHighVolume
        ? `${lowRatedHighVolume.name} yüksek yorum hacmine rağmen ${lowRatedHighVolume.rating} puanda kaldığı için ürün kalitesi veya beklenti yönetiminde boşluk var.`
        : `${premiumBenchmark.name} yüksek puanlı premium referans olarak yukarı yönlü fiyat çıpası oluşturuyor.`,
    },
    opportunities: [
      {
        title: "Düşük puanlı yüksek hacimli rakip boşluğu",
        detail: lowRatedHighVolume
          ? `${lowRatedHighVolume.name} çok görünür ama zayıf memnuniyet üretiyor. Aynı alt kategoride daha net ürün vaadi ve iyileştirilmiş görsellerle pay alınabilir.`
          : "Alt kategorilerde hacim yüksek; daha net ürün faydası ve yorum yönetimiyle fark yaratılabilir.",
        impact: "Yüksek",
      },
      {
        title: "Görsel kalite farklılaşması",
        detail:
          weakVisuals.length > 0
            ? `${weakVisuals.map((item) => item.name).join(", ")} düşük görsel kalite sinyali veriyor. Paket içerik, kullanım sahnesi ve zoom görselleri avantaj sağlayabilir.`
            : "Rakip görselleri benzer; bundle, kullanım sahnesi ve ölçü açıklamalarıyla ayrışma fırsatı var.",
        impact: "Orta",
      },
      {
        title: "Premium benchmarkı aşağıdan vurma",
        detail: `${premiumBenchmark.name} yüksek puanı fiyat primiyle taşıyor. Benzer kalite iddiası daha ulaşılabilir fiyat ve güçlü yorum toplama ile konumlanabilir.`,
        impact: "Yüksek",
      },
    ],
    threats: [
      {
        title: "Premium çıpa rakipler",
        detail: `${premiumBenchmark.name} kategori beklentisini yukarı çekiyor; zayıf ürün sayfası bunu daha görünür hale getirir.`,
        severity: "Yüksek",
      },
      {
        title: "Fiyat savaşı riski",
        detail: "Rakip kümesinde birbirine çok yakın fiyatlanan yoğun ürünler var. Sadece indirimle rekabet etmek marjı aşındırır.",
        severity: "Orta",
      },
      {
        title: "Yüksek puan kümelenmesi",
        detail: `${competitors.filter((item) => item.rating >= 4.5).length} rakip 4.5+ puanda. Kalite söylemi desteklenmezse dönüşüm baskısı oluşur.`,
        severity: "Kritik",
      },
    ],
    actionPlan: [
      {
        title: "İlk 3 üründe görsel dönüşüm paketi çıkar",
        owner: "Tasarım + kategori yöneticisi",
        horizon: "7 gün",
        detail: "Kapak görseli, detay görselleri, kullanım bağlamı ve ölçü/özellik anlatısını tek şablonda yenile.",
      },
      {
        title: "Yorum kaynaklı itirazları PDP üzerinde önceden cevapla",
        owner: "CRM + içerik",
        horizon: "10 gün",
        detail: "Top 30 yorumda tekrar eden beden, ton, doku, paketleme sorularını ürün açıklamasına ve SSS alanına taşı.",
      },
      {
        title: "Rakip fiyat bandına göre üç katmanlı fiyat stratejisi uygula",
        owner: "Ticari ekip",
        horizon: "14 gün",
        detail: "Giriş, orta ve premium ürünleri ayrı fiyat çıpalarıyla konumlandır; tek fiyat politikasından çık.",
      },
      {
        title: "Kategoriye özel tekrar satın alma tetikleyicisi kur",
        owner: "Pazarlama",
        horizon: "30 gün",
        detail: `Hedef kitleyi ${categoryPack.keywords[0]} vaadiyle yeniden hedefle; yorum ve favorileme davranışını kampanya segmentine bağla.`,
      },
    ],
    pipeline: buildPipeline(),
    collectionNote:
      "Bu ekran şu anda canlı Trendyol entegrasyonu yerine UI prototipi için deterministik örnek veri üretir. Gerçek scraping/API katmanı bağlandığında aynı rapor şablonu korunabilir.",
  }
}
