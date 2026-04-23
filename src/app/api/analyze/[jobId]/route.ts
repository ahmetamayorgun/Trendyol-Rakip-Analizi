import { NextResponse } from "next/server"

import { getAnalysisJob } from "@/lib/analysis/jobs"

interface RouteContext {
  params: Promise<{
    jobId: string
  }>
}

export async function GET(_: Request, context: RouteContext) {
  const { jobId } = await context.params
  const job = getAnalysisJob(jobId)

  if (!job) {
    return NextResponse.json({ error: "Analiz işi bulunamadı." }, { status: 404 })
  }

  return NextResponse.json(job)
}
