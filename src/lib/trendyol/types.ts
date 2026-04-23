export interface ScrapedStoreProductCard {
  name: string
  brand: string | null
  url: string
  price: number | null
  rating: number | null
  reviewCount: number | null
  imageUrl: string | null
  badges: string[]
}

export interface ScrapedStoreProfile {
  name: string
  merchantId: string | null
  sellerScore: number | null
  followerCount: number | null
  totalProducts: number | null
  profileUrl: string
  productsUrl: string | null
  featuredProducts: ScrapedStoreProductCard[]
}

export interface ScrapedCompetitorOffer {
  competitorName: string
  competitorUrl: string | null
  sellerScore: number | null
  price: number | null
  deliveryText: string | null
}

export interface ScrapedCategoryLink {
  name: string
  url: string
}

export interface ScrapedCategoryProductCandidate {
  category: string
  categoryUrl: string
  brand: string | null
  name: string
  url: string
  price: number | null
  rating: number | null
  reviewCount: number | null
  imageUrl: string | null
}

export interface ScrapedProductDetail {
  url: string
  name: string
  brand: string | null
  price: number | null
  rating: number | null
  reviewCount: number | null
  sellerName: string | null
  sellerUrl: string | null
  categoryLinks: ScrapedCategoryLink[]
  categories: string[]
  images: string[]
  reviewBodies: string[]
  competitorOffers: ScrapedCompetitorOffer[]
}
