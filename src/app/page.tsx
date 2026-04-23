import { AnalysisDashboard } from "@/components/analysis-dashboard"
import { getInitialAnalysisReport } from "@/lib/analysis/initial-report"

export default async function Home() {
  const initialReport = await getInitialAnalysisReport()

  return <AnalysisDashboard initialReport={initialReport} />
}
