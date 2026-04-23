import { randomUUID } from "node:crypto"

import type { AnalysisJobSnapshot, PipelineStep } from "@/lib/analysis/types"
import { generateLiveAnalysisReport } from "@/lib/analysis/live-report"
import { generateAnalysisReport } from "@/lib/analysis/mock-report"

const JOB_TTL_MS = 1000 * 60 * 30

interface StoredJob extends AnalysisJobSnapshot {
  updatedAt: number
}

declare global {
  var __trendyolAnalysisJobs: Map<string, StoredJob> | undefined
}

const jobs = globalThis.__trendyolAnalysisJobs ?? new Map<string, StoredJob>()
globalThis.__trendyolAnalysisJobs = jobs

export function createAnalysisJob(url: string, focus?: string) {
  pruneJobs()

  const jobId = randomUUID()
  const job: StoredJob = {
    jobId,
    status: "queued",
    progress: 0,
    message: "Analiz kuyruğa alındı.",
    pipeline: buildQueuedPipeline(),
    updatedAt: Date.now(),
  }

  jobs.set(jobId, job)
  void runAnalysisJob(jobId, url, focus)

  return toSnapshot(job)
}

export function getAnalysisJob(jobId: string) {
  pruneJobs()
  const job = jobs.get(jobId)
  return job ? toSnapshot(job) : null
}

function updateJob(jobId: string, updates: Partial<StoredJob>) {
  const job = jobs.get(jobId)

  if (!job) {
    return
  }

  Object.assign(job, updates, { updatedAt: Date.now() })
}

async function runAnalysisJob(jobId: string, url: string, focus?: string) {
  updateJob(jobId, {
    status: "running",
    progress: 3,
    message: "Canlı Trendyol analizi başlatıldı.",
    pipeline: markRunning(buildQueuedPipeline(), "store", "Mağaza capture başlatıldı."),
  })

  try {
    const report = await generateLiveAnalysisReport(url, focus, {
      onProgress: (event) => {
        updateJob(jobId, {
          status: "running",
          progress: event.progress,
          message: event.message,
          pipeline: event.pipeline,
        })
      },
    })

    updateJob(jobId, {
      status: "completed",
      progress: 100,
      message: "Canlı rapor hazır.",
      pipeline: report.pipeline,
      report,
      warning: undefined,
      error: undefined,
    })
    return
  } catch (error) {
    console.error("Live Trendyol analysis failed", error)
  }

  try {
    const fallbackReport = generateAnalysisReport(url, focus)

    updateJob(jobId, {
      status: "completed",
      progress: 100,
      message: "Canlı veri çıkarımı başarısız oldu; prototip rapor hazırlandı.",
      pipeline: fallbackReport.pipeline,
      report: fallbackReport,
      warning: "Canlı veri çıkarımı başarısız oldu, prototip rapora dönüldü.",
      error: undefined,
    })
  } catch (error) {
    updateJob(jobId, {
      status: "failed",
      progress: 100,
      message: "Analiz tamamlanamadı.",
      error: error instanceof Error ? error.message : "Beklenmeyen bir hata oluştu.",
    })
  }
}

function buildQueuedPipeline(): PipelineStep[] {
  return [
    {
      key: "store",
      label: "Mağaza verisi çıkarılıyor",
      detail: "İş başlatılmayı bekliyor.",
      status: "pending",
    },
    {
      key: "products",
      label: "Top ürünler analiz ediliyor",
      detail: "İş başlatılmayı bekliyor.",
      status: "pending",
    },
    {
      key: "categories",
      label: "Kategori keşfi çalışıyor",
      detail: "İş başlatılmayı bekliyor.",
      status: "pending",
    },
    {
      key: "competitors",
      label: "Rakip haritası kuruluyor",
      detail: "İş başlatılmayı bekliyor.",
      status: "pending",
    },
    {
      key: "strategy",
      label: "Stratejik çıktı üretiliyor",
      detail: "İş başlatılmayı bekliyor.",
      status: "pending",
    },
  ]
}

function markRunning(steps: PipelineStep[], key: string, detail: string) {
  return steps.map((step) =>
    step.key === key
      ? {
          ...step,
          status: "running" as const,
          detail,
        }
      : step
  )
}

function pruneJobs() {
  const threshold = Date.now() - JOB_TTL_MS

  for (const [jobId, job] of jobs.entries()) {
    if (job.updatedAt < threshold) {
      jobs.delete(jobId)
    }
  }
}

function toSnapshot(job: StoredJob): AnalysisJobSnapshot {
  return {
    jobId: job.jobId,
    status: job.status,
    progress: job.progress,
    message: job.message,
    pipeline: job.pipeline.map((step) => ({ ...step })),
    report: job.report,
    warning: job.warning,
    error: job.error,
  }
}
