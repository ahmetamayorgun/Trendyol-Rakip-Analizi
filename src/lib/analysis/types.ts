export type PipelineStatus = "complete" | "running" | "pending"
export type AnalysisJobStatus = "queued" | "running" | "completed" | "failed"

export interface PipelineStep {
  key: string
  label: string
  detail: string
  status: PipelineStatus
}

export interface TopProduct {
  name: string
  price: number
  rating: number
  reviewCount: number
  category: string
  images: string[]
  imageQuality: "Düşük" | "Orta" | "Yüksek"
  reviewPatterns: string[]
}

export interface Competitor {
  name: string
  category: string
  productName: string
  price: number
  rating: number
  reviewCount: number
  imageQuality: "Düşük" | "Orta" | "Yüksek"
  benchmarkTag: string
  matchScore: number
  confidence: "Yüksek" | "Orta" | "Düşük"
  matchReasons: string[]
}

export interface Opportunity {
  title: string
  detail: string
  impact: "Yüksek" | "Orta"
}

export interface Threat {
  title: string
  detail: string
  severity: "Kritik" | "Yüksek" | "Orta"
}

export interface ActionItem {
  title: string
  owner: string
  horizon: string
  detail: string
}

export interface StoreIdentity {
  name: string
  rating: number
  followerCount: number
  totalProducts: number
  priceSegment: string
  brandType: string
  targetProfile: string
}

export interface MarketAnalysis {
  priceComparison: string
  ratingComparison: string
  reviewVolumeComparison: string
  hiddenInsight: string
}

export interface AnalysisReport {
  requestedUrl: string
  requestedAt: string
  focus: string
  storeIdentity: StoreIdentity
  categories: {
    main: string[]
    sub: string[]
  }
  featuredProducts: string[]
  topProducts: TopProduct[]
  competitors: Competitor[]
  marketAnalysis: MarketAnalysis
  opportunities: Opportunity[]
  threats: Threat[]
  actionPlan: ActionItem[]
  pipeline: PipelineStep[]
  collectionNote: string
}

export interface AnalysisProgressEvent {
  progress: number
  message: string
  pipeline: PipelineStep[]
}

export interface AnalysisJobSnapshot {
  jobId: string
  status: AnalysisJobStatus
  progress: number
  message: string
  pipeline: PipelineStep[]
  report?: AnalysisReport
  warning?: string
  error?: string
}
