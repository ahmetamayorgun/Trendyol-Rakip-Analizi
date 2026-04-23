import { NextResponse } from "next/server"

import { createAnalysisJob } from "@/lib/analysis/jobs"

interface AnalyzePayload {
  url?: string
  focus?: string
}

export async function POST(request: Request) {
  let payload: AnalyzePayload

  try {
    payload = (await request.json()) as AnalyzePayload
  } catch {
    return NextResponse.json({ error: "Geçerli bir JSON body gönderilmedi." }, { status: 400 })
  }

  const rawUrl = payload.url?.trim()

  if (!rawUrl) {
    return NextResponse.json({ error: "Trendyol mağaza veya ürün linki zorunludur." }, { status: 400 })
  }

  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    return NextResponse.json({ error: "Lütfen geçerli bir URL girin." }, { status: 400 })
  }

  if (!parsed.hostname.includes("trendyol.com")) {
    return NextResponse.json(
      { error: "Bu prototip yalnızca Trendyol URL'leri için yapılandırıldı." },
      { status: 400 }
    )
  }

  const job = createAnalysisJob(parsed.toString(), payload.focus)

  return NextResponse.json({ jobId: job.jobId }, { status: 202 })
}
