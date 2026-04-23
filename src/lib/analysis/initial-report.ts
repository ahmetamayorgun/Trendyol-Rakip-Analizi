import { unstable_cache } from "next/cache"

import type { AnalysisReport } from "@/lib/analysis/types"
import { generateLiveAnalysisReport } from "@/lib/analysis/live-report"
import { generateAnalysisReport } from "@/lib/analysis/mock-report"

export const INITIAL_SAMPLE_URL = "https://www.trendyol.com/magaza/profil/mavi-kozmetik-m-357"
const INITIAL_FOCUS = "Genel rakip analizi ve kategori benchmarkı"

const getCachedInitialReport = unstable_cache(
  async (): Promise<AnalysisReport> => {
    try {
      return await generateLiveAnalysisReport(INITIAL_SAMPLE_URL, INITIAL_FOCUS, {
        maxCategoryPages: 1,
        maxCategoryProductsPerPage: 3,
        maxProductDetails: 2,
      })
    } catch {
      return generateAnalysisReport(INITIAL_SAMPLE_URL, INITIAL_FOCUS)
    }
  },
  ["initial-live-analysis-report-v3"],
  { revalidate: 60 * 30 }
)

export async function getInitialAnalysisReport() {
  return getCachedInitialReport()
}
