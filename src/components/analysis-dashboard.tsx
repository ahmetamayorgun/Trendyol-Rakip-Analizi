"use client"

import { useMemo, useState } from "react"
import {
  Activity,
  AlertCircle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Crown,
  Layers3,
  LoaderCircle,
  Radar,
  Search,
  ShieldAlert,
  Sparkles,
  Store,
  Swords,
  Target,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import type { AnalysisJobSnapshot, AnalysisReport, PipelineStep } from "@/lib/analysis/types"

interface AnalysisDashboardProps {
  initialReport: AnalysisReport
}

const SAMPLE_URL = "https://www.trendyol.com/magaza/profil/mavi-kozmetik-m-357"

export function AnalysisDashboard({ initialReport }: AnalysisDashboardProps) {
  const [url, setUrl] = useState(initialReport.requestedUrl)
  const [focus, setFocus] = useState(initialReport.focus)
  const [report, setReport] = useState(initialReport)
  const [pipelineSteps, setPipelineSteps] = useState(initialReport.pipeline)
  const [pipelineProgress, setPipelineProgress] = useState(100)
  const [pipelineMessage, setPipelineMessage] = useState("Canlı rapor hazır.")
  const [warning, setWarning] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const quickStats = useMemo(() => {
    const avgCompetitorRating =
      report.competitors.reduce((sum, item) => sum + item.rating, 0) / report.competitors.length
    const avgCompetitorPrice =
      report.competitors.reduce((sum, item) => sum + item.price, 0) / report.competitors.length
    const totalCompetitorReviews = report.competitors.reduce((sum, item) => sum + item.reviewCount, 0)

    return [
      {
        label: "Mağaza puanı",
        value: report.storeIdentity.rating.toFixed(2),
        hint: `${report.storeIdentity.followerCount.toLocaleString("tr-TR")} takipçi`,
        icon: Store,
        tone: "from-orange-500/20 via-orange-500/5 to-transparent",
      },
      {
        label: "Rakip ort. puan",
        value: avgCompetitorRating.toFixed(2),
        hint: `${report.competitors.length} mağaza örneklemi`,
        icon: Swords,
        tone: "from-blue-500/20 via-blue-500/5 to-transparent",
      },
      {
        label: "Rakip ort. fiyat",
        value: `${Math.round(avgCompetitorPrice).toLocaleString("tr-TR")} TL`,
        hint: report.storeIdentity.priceSegment,
        icon: Wallet,
        tone: "from-violet-500/20 via-violet-500/5 to-transparent",
      },
      {
        label: "Rakip yorum havuzu",
        value: totalCompetitorReviews.toLocaleString("tr-TR"),
        hint: `${report.actionPlan.length} önerilen aksiyon`,
        icon: Users,
        tone: "from-emerald-500/20 via-emerald-500/5 to-transparent",
      },
    ]
  }, [report])

  const benchmarkMetrics = useMemo(() => {
    const storeAveragePrice = report.topProducts.reduce((sum, item) => sum + item.price, 0) / report.topProducts.length
    const competitorAveragePrice =
      report.competitors.reduce((sum, item) => sum + item.price, 0) / report.competitors.length
    const storeAverageRating = report.topProducts.reduce((sum, item) => sum + item.rating, 0) / report.topProducts.length
    const competitorAverageRating =
      report.competitors.reduce((sum, item) => sum + item.rating, 0) / report.competitors.length
    const storeReviewVolume = report.topProducts.reduce((sum, item) => sum + item.reviewCount, 0)
    const competitorReviewVolume = report.competitors.reduce((sum, item) => sum + item.reviewCount, 0)

    return [
      {
        label: "Fiyat pozisyonu",
        storeValue: storeAveragePrice,
        competitorValue: competitorAveragePrice,
        format: (value: number) => `${Math.round(value).toLocaleString("tr-TR")} TL`,
      },
      {
        label: "Puan gücü",
        storeValue: storeAverageRating,
        competitorValue: competitorAverageRating,
        format: (value: number) => value.toFixed(2),
      },
      {
        label: "Yorum hacmi",
        storeValue: storeReviewVolume,
        competitorValue: competitorReviewVolume / report.competitors.length,
        format: (value: number) => Math.round(value).toLocaleString("tr-TR"),
      },
    ]
  }, [report])

  const featuredCompetitors = useMemo(() => report.competitors.slice(0, 3), [report])
  const strongestProduct = report.topProducts[0]

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError(null)
    setWarning(null)
    setPipelineProgress(3)
    setPipelineMessage("Canlı Trendyol analizi başlatıldı.")
    setPipelineSteps(
      report.pipeline.map((step, index) => ({
        ...step,
        status: index === 0 ? "running" : "pending",
      }))
    )

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url, focus }),
      })

      const payload = (await response.json()) as { error?: string; jobId?: string }

      if (!response.ok || !payload.jobId) {
        throw new Error(payload.error || "Analiz işi başlatılamadı.")
      }

      const completedJob = await waitForJob(payload.jobId, {
        onUpdate: (snapshot) => {
          setPipelineProgress(snapshot.progress)
          setPipelineMessage(snapshot.message)
          setPipelineSteps(snapshot.pipeline)

          if (snapshot.warning) {
            setWarning(snapshot.warning)
          }
        },
      })

      if (!completedJob.report) {
        throw new Error(completedJob.error || "Rapor üretilemedi.")
      }

      setReport(completedJob.report)
      setPipelineSteps(completedJob.report.pipeline)
      setPipelineProgress(100)
      setPipelineMessage(completedJob.warning ? "Prototip fallback rapor hazır." : "Canlı rapor hazır.")
      setWarning(completedJob.warning ?? null)
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Beklenmeyen bir hata oluştu.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#fffaf7] text-zinc-950">
      <div className="absolute inset-x-0 top-0 -z-10 h-[420px] bg-[radial-gradient(circle_at_top,_rgba(249,115,22,0.18),_transparent_48%)]" />
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <section className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
          <Card className="relative overflow-hidden border-orange-200/70 bg-white shadow-[0_24px_80px_-40px_rgba(251,146,60,0.55)]">
            <div className="absolute inset-y-0 right-0 hidden w-1/2 bg-[radial-gradient(circle_at_top_right,_rgba(251,146,60,0.18),_transparent_60%)] lg:block" />
            <CardHeader className="relative gap-4 border-b border-zinc-100 pb-6">
              <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-orange-700">
                <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100">shadcn/ui dashboard</Badge>
                <Badge variant="secondary">Trendyol Competitor Analysis Agent</Badge>
                <Badge variant="outline">Tek link → otomatik rakip analizi</Badge>
              </div>
              <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
                <div className="space-y-4">
                  <div className="space-y-3">
                    <CardTitle className="max-w-3xl text-4xl leading-tight font-semibold tracking-tight sm:text-5xl">
                      Trendyol mağaza linkini ver, sistem rakipleri kendi bulup stratejik raporu çıkarsın.
                    </CardTitle>
                    <CardDescription className="max-w-2xl text-base leading-7 text-zinc-600">
                      Hedef deneyim tek girişli: mağazayı çözümle, kategori ve fiyat bandını çıkar, rakip kümesini
                      oluştur, fırsat/tehditleri ve aksiyon planını tek ekranda göster.
                    </CardDescription>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <SignalPill icon={Radar} label="Rakip keşfi" value="Otomatik" tone="orange" />
                    <SignalPill icon={Target} label="Odak" value={report.focus} tone="blue" />
                    <SignalPill
                      icon={CheckCircle2}
                      label="Rapor durumu"
                      value={loading ? "Hazırlanıyor" : "Hazır"}
                      tone="emerald"
                    />
                  </div>
                </div>

                <div className="grid gap-3 rounded-3xl border border-zinc-200 bg-zinc-950 p-5 text-white shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-zinc-300">Mağaza snapshot</p>
                      <p className="mt-1 text-2xl font-semibold">{report.storeIdentity.name}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                      <Store className="size-5 text-orange-300" />
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <DarkMetric label="Puan" value={report.storeIdentity.rating.toFixed(2)} />
                    <DarkMetric label="Ürün" value={report.storeIdentity.totalProducts.toLocaleString("tr-TR")} />
                    <DarkMetric label="Takipçi" value={report.storeIdentity.followerCount.toLocaleString("tr-TR")} />
                  </div>
                  <div className="space-y-2 rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="flex items-center justify-between text-sm text-zinc-300">
                      <span>Positioning pulse</span>
                      <span>{report.storeIdentity.priceSegment}</span>
                    </div>
                    <StatusBar value={72} trackClassName="bg-white/10" indicatorClassName="bg-orange-300" />
                    <p className="text-sm leading-6 text-zinc-300">
                      {report.storeIdentity.brandType} • hedef profil: {report.storeIdentity.targetProfile}
                    </p>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="relative pt-6">
              <form className="grid gap-4 xl:grid-cols-[1fr_1fr_auto] xl:items-end" onSubmit={handleSubmit}>
                <div className="grid gap-2 xl:col-span-1">
                  <label className="text-sm font-medium">Trendyol mağaza veya ürün linki</label>
                  <Input
                    value={url}
                    onChange={(event) => setUrl(event.target.value)}
                    placeholder="https://www.trendyol.com/magaza/..."
                    className="h-12 border-zinc-200 bg-white text-base"
                  />
                </div>
                <div className="grid gap-2 xl:col-span-1">
                  <label className="text-sm font-medium">Analiz odağı</label>
                  <Textarea
                    value={focus}
                    onChange={(event) => setFocus(event.target.value)}
                    placeholder="Örn. fiyat kıran rakipler, premium benchmarklar, görsel kalite açığı"
                    className="min-h-12 border-zinc-200 bg-white"
                  />
                </div>
                <div className="flex flex-col gap-2 xl:w-[210px]">
                  <Button
                    type="submit"
                    className="h-12 gap-2 rounded-xl bg-orange-600 text-white shadow-sm hover:bg-orange-700"
                    disabled={loading}
                  >
                    {loading ? <LoaderCircle className="size-4 animate-spin" /> : <Search className="size-4" />}
                    Raporu üret
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-12 rounded-xl"
                    onClick={() => {
                      setUrl(SAMPLE_URL)
                      setFocus("Genel rakip analizi ve kategori benchmarkı")
                      setError(null)
                    }}
                  >
                    Örnek URL
                  </Button>
                </div>
              </form>

              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="rounded-full border bg-white px-3 py-1">Canlı browser capture aktif</span>
                <span className="rounded-full border bg-white px-3 py-1">Kategori bazlı rakip keşfi</span>
                <span className="rounded-full border bg-white px-3 py-1">shadcn/ui + Next.js</span>
              </div>

              {warning ? (
                <Alert className="mt-4 border-amber-200 bg-amber-50 text-amber-950">
                  <AlertCircle className="size-4" />
                  <AlertTitle>Fallback uyarısı</AlertTitle>
                  <AlertDescription>{warning}</AlertDescription>
                </Alert>
              ) : null}

              {error ? (
                <Alert variant="destructive" className="mt-4">
                  <AlertCircle className="size-4" />
                  <AlertTitle>İstek başarısız oldu</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}
            </CardContent>
          </Card>

          <div className="grid gap-4">
            <Card className="border-zinc-200 bg-white shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Activity className="size-5 text-orange-600" /> Analysis control center
                </CardTitle>
                <CardDescription>Pipeline, veri notu ve çalıştırılan rapor meta bilgileri.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <PipelineView loading={loading} message={pipelineMessage} progress={pipelineProgress} steps={pipelineSteps} />
                <Alert>
                  <ShieldAlert className="size-4" />
                  <AlertTitle>Collection note</AlertTitle>
                  <AlertDescription>{report.collectionNote}</AlertDescription>
                </Alert>
              </CardContent>
            </Card>

            <Card className="border-zinc-200 bg-zinc-950 text-white shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Crown className="size-5 text-orange-300" /> Executive snapshot
                </CardTitle>
                <CardDescription className="text-zinc-400">
                  En güçlü ürün, benchmark tehdidi ve ilk hamle aynı blokta.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">Featured product</p>
                  <p className="mt-2 text-lg font-semibold">{strongestProduct.name}</p>
                  <p className="mt-2 text-sm leading-6 text-zinc-300">
                    {strongestProduct.reviewCount.toLocaleString("tr-TR")} yorum • {strongestProduct.rating.toFixed(2)} puan •
                    {" "}{strongestProduct.price.toLocaleString("tr-TR")} TL
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">Top competitor pressure</p>
                  <p className="mt-2 text-lg font-semibold">{featuredCompetitors[0]?.name}</p>
                  <p className="mt-2 text-sm leading-6 text-zinc-300">{report.threats[0]?.detail}</p>
                </div>
                <div className="rounded-2xl border border-orange-400/20 bg-orange-500/10 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-orange-200">First action</p>
                  <p className="mt-2 text-lg font-semibold text-white">{report.actionPlan[0]?.title}</p>
                  <p className="mt-2 text-sm leading-6 text-orange-100/80">{report.actionPlan[0]?.detail}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {quickStats.map((item) => {
            const Icon = item.icon
            return (
              <Card key={item.label} className="relative overflow-hidden border-zinc-200 bg-white shadow-sm">
                <div className={`absolute inset-0 bg-gradient-to-br ${item.tone}`} />
                <CardHeader className="relative">
                  <CardDescription>{item.label}</CardDescription>
                  <CardTitle className="flex items-center justify-between text-3xl">
                    {item.value}
                    <div className="rounded-2xl border border-zinc-200 bg-white/90 p-2">
                      <Icon className="size-5 text-zinc-900" />
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="relative pt-0 text-sm text-muted-foreground">{item.hint}</CardContent>
              </Card>
            )
          })}
        </section>

        <section className="grid gap-4 lg:grid-cols-[0.92fr_1.08fr]">
          <Card className="border-zinc-200 bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Layers3 className="size-5 text-orange-600" /> Positioning board
              </CardTitle>
              <CardDescription>Mağazanın kategori kapsaması, marka tipi ve benchmark sinyalleri.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <KeyValue label="Mağaza adı" value={report.storeIdentity.name} />
                <KeyValue label="Fiyat segmenti" value={report.storeIdentity.priceSegment} />
                <KeyValue label="Marka tipi" value={report.storeIdentity.brandType} />
                <KeyValue label="Hedef profil" value={report.storeIdentity.targetProfile} />
              </div>
              <Separator />
              <div className="space-y-3">
                <p className="text-sm font-medium text-zinc-900">Kategori yayılımı</p>
                <div className="flex flex-wrap gap-2">
                  {report.categories.main.map((category, index) => (
                    <Badge key={`${category}-${index}`} className="bg-zinc-900 text-white hover:bg-zinc-900">
                      {category}
                    </Badge>
                  ))}
                  {report.categories.sub.map((category, index) => (
                    <Badge key={`${category}-${index}`} variant="secondary">
                      {category}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-orange-100 bg-orange-50/70 p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium text-orange-800">
                  <Sparkles className="size-4" /> Hidden strategic signal
                </div>
                <p className="text-sm leading-6 text-orange-950/85">{report.marketAnalysis.hiddenInsight}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-zinc-200 bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <BarChart3 className="size-5 text-orange-600" /> Benchmark board
              </CardTitle>
              <CardDescription>Mağaza ile rakip grubunu aynı ekranda okuyabilmen için normalize görünüm.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {benchmarkMetrics.map((metric) => (
                <BenchmarkMeter
                  key={metric.label}
                  label={metric.label}
                  storeValue={metric.storeValue}
                  competitorValue={metric.competitorValue}
                  format={metric.format}
                />
              ))}
            </CardContent>
          </Card>
        </section>

        <Tabs defaultValue="overview" className="gap-4">
          <TabsList className="w-full justify-start overflow-x-auto rounded-2xl border bg-white p-1 shadow-sm" variant="default">
            <TabsTrigger value="overview">Genel bakış</TabsTrigger>
            <TabsTrigger value="products">Top ürünler</TabsTrigger>
            <TabsTrigger value="competitors">Rakipler</TabsTrigger>
            <TabsTrigger value="actions">Aksiyon planı</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="grid gap-4 lg:grid-cols-[1fr_1fr]">
            <Card className="border-zinc-200 bg-white shadow-sm">
              <CardHeader>
                <CardTitle>Pazar okuması</CardTitle>
                <CardDescription>Ham veriyi stratejik yoruma çeviren özet katman.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3">
                <InsightRow title="Fiyat" value={report.marketAnalysis.priceComparison} />
                <InsightRow title="Puan" value={report.marketAnalysis.ratingComparison} />
                <InsightRow title="Yorum hacmi" value={report.marketAnalysis.reviewVolumeComparison} />
                <InsightRow title="Gizli sinyal" value={report.marketAnalysis.hiddenInsight} />
              </CardContent>
            </Card>

            <Card className="border-zinc-200 bg-white shadow-sm">
              <CardHeader>
                <CardTitle>Rakip leaderboard</CardTitle>
                <CardDescription>Otomatik bulunan en baskın rakiplerin hızlı okuma yüzeyi.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3">
                {featuredCompetitors.map((competitor, index) => (
                  <CompetitorHighlightCard
                    key={`${competitor.name}-${competitor.productName}`}
                    rank={index + 1}
                    name={competitor.name}
                    category={competitor.category}
                    benchmarkTag={competitor.benchmarkTag}
                    confidence={competitor.confidence ?? "Orta"}
                    matchScore={competitor.matchScore ?? 0}
                    rating={competitor.rating}
                    reviewCount={competitor.reviewCount}
                    price={competitor.price}
                  />
                ))}
              </CardContent>
            </Card>

            <Card className="border-zinc-200 bg-white shadow-sm lg:col-span-2">
              <CardHeader>
                <CardTitle>Fırsatlar & tehditler</CardTitle>
                <CardDescription>Kararı hızlandıran çift kolonlu stratejik görünüm.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-emerald-700">
                    <TrendingUp className="size-4" /> Fırsatlar
                  </div>
                  {report.opportunities.map((item) => (
                    <SignalCard
                      key={item.title}
                      title={item.title}
                      detail={item.detail}
                      badge={item.impact}
                      className="border-emerald-200 bg-emerald-50"
                      badgeClassName="bg-emerald-600 text-white hover:bg-emerald-600"
                    />
                  ))}
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-rose-700">
                    <ShieldAlert className="size-4" /> Tehditler
                  </div>
                  {report.threats.map((item) => (
                    <SignalCard
                      key={item.title}
                      title={item.title}
                      detail={item.detail}
                      badge={item.severity}
                      className="border-rose-200 bg-rose-50"
                      badgeClassName="bg-rose-600 text-white hover:bg-rose-600"
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="products">
            <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
              <div className="grid gap-4">
                {report.topProducts.slice(0, 3).map((product) => (
                  <ProductSpotlightCard key={product.name} product={product} />
                ))}
              </div>
              <Card className="border-zinc-200 bg-white shadow-sm">
                <CardHeader>
                  <CardTitle>Top ürün matrisi</CardTitle>
                  <CardDescription>En çok yorum alan ürünleri fiyat, puan ve görsel kalite ile birlikte okuyun.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-hidden rounded-2xl border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Ürün</TableHead>
                          <TableHead>Kategori</TableHead>
                          <TableHead>Fiyat</TableHead>
                          <TableHead>Puan</TableHead>
                          <TableHead>Yorum</TableHead>
                          <TableHead>Görsel kalite</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {report.topProducts.map((product) => (
                          <TableRow key={product.name}>
                            <TableCell className="font-medium">{product.name}</TableCell>
                            <TableCell>{product.category}</TableCell>
                            <TableCell>{product.price.toLocaleString("tr-TR")} TL</TableCell>
                            <TableCell>{product.rating.toFixed(2)}</TableCell>
                            <TableCell>{product.reviewCount.toLocaleString("tr-TR")}</TableCell>
                            <TableCell>{product.imageQuality}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="competitors">
            <div className="grid gap-4">
              <div className="grid gap-4 lg:grid-cols-3">
                {featuredCompetitors.map((competitor, index) => (
                  <CompetitorSummaryPanel
                    key={`${competitor.name}-${competitor.productName}`}
                    rank={index + 1}
                    competitor={competitor}
                  />
                ))}
              </div>
              <Card className="border-zinc-200 bg-white shadow-sm">
                <CardHeader>
                  <CardTitle>Rakip tablosu</CardTitle>
                  <CardDescription>Kategori, fiyat, puan, yorum, match score ve seçilme nedenleri ile detay görünüm.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-hidden rounded-2xl border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Rakip mağaza</TableHead>
                          <TableHead>Alt kategori</TableHead>
                          <TableHead>Örnek ürün</TableHead>
                          <TableHead>Fiyat</TableHead>
                          <TableHead>Puan</TableHead>
                          <TableHead>Yorum</TableHead>
                          <TableHead>Match score</TableHead>
                          <TableHead>Confidence</TableHead>
                          <TableHead>Neden seçildi?</TableHead>
                          <TableHead>Benchmark etiketi</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {report.competitors.map((competitor) => (
                          <TableRow key={`${competitor.name}-${competitor.productName}`}>
                            <TableCell className="font-medium">{competitor.name}</TableCell>
                            <TableCell>{competitor.category}</TableCell>
                            <TableCell>{competitor.productName}</TableCell>
                            <TableCell>{competitor.price.toLocaleString("tr-TR")} TL</TableCell>
                            <TableCell>{competitor.rating.toFixed(2)}</TableCell>
                            <TableCell>{competitor.reviewCount.toLocaleString("tr-TR")}</TableCell>
                            <TableCell>%{Math.round((competitor.matchScore ?? 0) * 100)}</TableCell>
                            <TableCell>
                              <Badge className={confidenceBadgeClassName(competitor.confidence ?? "Orta")}>
                                {competitor.confidence ?? "Orta"}
                              </Badge>
                            </TableCell>
                            <TableCell className="max-w-72">
                              <ul className="space-y-1 text-sm text-zinc-700">
                                {(competitor.matchReasons ?? []).slice(0, 3).map((reason) => (
                                  <li key={reason}>• {reason}</li>
                                ))}
                              </ul>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">{competitor.benchmarkTag}</Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="actions" className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
            <Card className="border-zinc-200 bg-white shadow-sm">
              <CardHeader>
                <CardTitle>Aksiyon yol haritası</CardTitle>
                <CardDescription>Raporu doğrudan yapılacak iş listesine çeviren yürütme görünümü.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {report.actionPlan.map((item, index) => (
                  <div key={item.title} className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4">
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-zinc-950">
                          {index + 1}. {item.title}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {item.owner} • {item.horizon}
                        </p>
                      </div>
                      <Badge variant="secondary">Sprint action</Badge>
                    </div>
                    <p className="text-sm leading-6 text-zinc-700">{item.detail}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-zinc-200 bg-zinc-950 text-white shadow-sm">
              <CardHeader>
                <CardTitle>Execution cockpit</CardTitle>
                <CardDescription className="text-zinc-400">
                  Bu prototipten canlı veri toplama katmanına geçiş için önerilen çalışma sırası.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ExecutionStep
                  step="01"
                  title="Browser capture katmanı"
                  detail="Mağaza ve ürün sayfalarının HTML + embedded state snapshot'larını al."
                />
                <ExecutionStep
                  step="02"
                  title="Store / product parser"
                  detail="Mağaza kimliği, kategori, yorum ve ürün kartı alanlarını normalize et."
                />
                <ExecutionStep
                  step="03"
                  title="Rakip discovery engine"
                  detail="Kategori, başlık, fiyat bandı ve review hacmine göre aday üret ve skorla."
                />
                <ExecutionStep
                  step="04"
                  title="Review insight engine"
                  detail="İlk yorum kümelerinden şikayet pattern'leri ve fırsat sinyalleri çıkar."
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}

async function waitForJob(
  jobId: string,
  { onUpdate }: { onUpdate?: (snapshot: AnalysisJobSnapshot) => void }
): Promise<AnalysisJobSnapshot> {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const response = await fetch(`/api/analyze/${jobId}`, {
      method: "GET",
      cache: "no-store",
    })

    const snapshot = (await response.json()) as AnalysisJobSnapshot & { error?: string }

    if (!response.ok) {
      throw new Error(snapshot.error || "Analiz işi okunamadı.")
    }

    onUpdate?.(snapshot)

    if (snapshot.status === "completed") {
      return snapshot
    }

    if (snapshot.status === "failed") {
      throw new Error(snapshot.error || "Analiz tamamlanamadı.")
    }

    await new Promise((resolve) => setTimeout(resolve, 1200))
  }

  throw new Error("Analiz zaman aşımına uğradı. Lütfen tekrar deneyin.")
}


function StatusBar({
  value,
  trackClassName = "bg-zinc-200",
  indicatorClassName = "bg-orange-500",
}: {
  value: number
  trackClassName?: string
  indicatorClassName?: string
}) {
  return (
    <div className={`h-2 overflow-hidden rounded-full ${trackClassName}`}>
      <div className={`h-full rounded-full transition-all ${indicatorClassName}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  )
}

function SignalPill({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  tone: "orange" | "blue" | "emerald"
}) {
  const toneMap = {
    orange: "border-orange-200 bg-orange-50 text-orange-700",
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
  }

  return (
    <div className={`rounded-2xl border p-4 ${toneMap[tone]}`}>
      <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em]">
        <Icon className="size-4" /> {label}
      </div>
      <p className="line-clamp-2 text-sm font-medium text-zinc-950">{value}</p>
    </div>
  )
}

function DarkMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
      <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">{label}</p>
      <p className="mt-1 text-lg font-semibold text-white">{value}</p>
    </div>
  )
}

function BenchmarkMeter({
  label,
  storeValue,
  competitorValue,
  format,
}: {
  label: string
  storeValue: number
  competitorValue: number
  format: (value: number) => string
}) {
  const maxValue = Math.max(storeValue, competitorValue, 1)
  const storePercent = (storeValue / maxValue) * 100
  const competitorPercent = (competitorValue / maxValue) * 100
  const delta = storeValue - competitorValue
  const deltaLabel = delta >= 0 ? `+${format(delta)}` : `-${format(Math.abs(delta))}`

  return (
    <div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="font-medium text-zinc-950">{label}</p>
          <p className="text-xs text-muted-foreground">Mağaza vs rakip ortalaması</p>
        </div>
        <Badge variant="secondary">Δ {deltaLabel}</Badge>
      </div>
      <div className="space-y-3">
        <MetricRail label="Mağaza" percent={storePercent} value={format(storeValue)} className="bg-orange-500" />
        <MetricRail
          label="Rakip ortalaması"
          percent={competitorPercent}
          value={format(competitorValue)}
          className="bg-zinc-900"
        />
      </div>
    </div>
  )
}

function MetricRail({
  label,
  percent,
  value,
  className,
}: {
  label: string
  percent: number
  value: string
  className: string
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm text-zinc-700">
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <div className="h-2 rounded-full bg-zinc-200">
        <div className={`h-2 rounded-full ${className}`} style={{ width: `${Math.max(percent, 8)}%` }} />
      </div>
    </div>
  )
}

function SignalCard({
  title,
  detail,
  badge,
  className,
  badgeClassName,
}: {
  title: string
  detail: string
  badge: string
  className: string
  badgeClassName: string
}) {
  return (
    <div className={`rounded-2xl border p-4 ${className}`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="font-medium text-zinc-950">{title}</p>
        <Badge className={badgeClassName}>{badge}</Badge>
      </div>
      <p className="text-sm leading-6 text-zinc-700">{detail}</p>
    </div>
  )
}

function ProductSpotlightCard({ product }: { product: AnalysisReport["topProducts"][number] }) {
  return (
    <Card className="overflow-hidden border-zinc-200 bg-white shadow-sm">
      <CardContent className="p-0">
        <div className="grid md:grid-cols-[0.32fr_0.68fr]">
          <div className="flex min-h-44 items-end bg-[linear-gradient(180deg,_rgba(251,146,60,0.18),_rgba(251,146,60,0.04))] p-5">
            <div className="rounded-2xl border border-orange-200/70 bg-white/80 p-3 shadow-sm backdrop-blur">
              <p className="text-xs uppercase tracking-[0.18em] text-orange-700">{product.category}</p>
              <p className="mt-2 text-3xl font-semibold text-zinc-950">{product.rating.toFixed(2)}</p>
              <p className="text-sm text-zinc-600">ürün puanı</p>
            </div>
          </div>
          <div className="space-y-4 p-5">
            <div>
              <p className="text-lg font-semibold text-zinc-950">{product.name}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                {product.reviewCount.toLocaleString("tr-TR")} yorum • {product.price.toLocaleString("tr-TR")} TL • görsel kalite: {product.imageQuality}
              </p>
            </div>
            <div className="space-y-2">
              {product.reviewPatterns.map((pattern) => (
                <div key={pattern} className="flex gap-2 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">
                  <ArrowRight className="mt-0.5 size-4 shrink-0 text-orange-600" />
                  <span>{pattern}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function CompetitorHighlightCard({
  rank,
  name,
  category,
  benchmarkTag,
  confidence,
  matchScore,
  rating,
  reviewCount,
  price,
}: {
  rank: number
  name: string
  category: string
  benchmarkTag: string
  confidence: AnalysisReport["competitors"][number]["confidence"]
  matchScore: number
  rating: number
  reviewCount: number
  price: number
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">#{rank} rakip</p>
          <p className="mt-1 font-semibold text-zinc-950">{name}</p>
          <p className="text-sm text-muted-foreground">{category}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Badge variant="secondary">{benchmarkTag}</Badge>
          <Badge className={confidenceBadgeClassName(confidence)}>%{Math.round(matchScore * 100)} match</Badge>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 text-sm">
        <MiniStat label="Puan" value={rating.toFixed(2)} />
        <MiniStat label="Yorum" value={reviewCount.toLocaleString("tr-TR")} />
        <MiniStat label="Fiyat" value={`${Math.round(price)} TL`} />
      </div>
    </div>
  )
}

function CompetitorSummaryPanel({
  rank,
  competitor,
}: {
  rank: number
  competitor: AnalysisReport["competitors"][number]
}) {
  return (
    <Card className="overflow-hidden border-zinc-200 bg-white shadow-sm">
      <div className="h-1.5 bg-gradient-to-r from-orange-500 via-amber-400 to-orange-200" />
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardDescription>#{rank} öne çıkan rakip</CardDescription>
            <CardTitle className="mt-1 text-xl">{competitor.name}</CardTitle>
          </div>
          <Badge variant="secondary">{competitor.benchmarkTag}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-2 text-sm">
          <MiniStat label="Puan" value={competitor.rating.toFixed(2)} />
          <MiniStat label="Yorum" value={competitor.reviewCount.toLocaleString("tr-TR")} />
          <MiniStat label="Fiyat" value={`${Math.round(competitor.price)} TL`} />
        </div>
        <div className="flex items-center gap-2">
          <Badge className={confidenceBadgeClassName(competitor.confidence ?? "Orta")}>
            {competitor.confidence ?? "Orta"} güven
          </Badge>
          <Badge variant="outline">%{Math.round((competitor.matchScore ?? 0) * 100)} match score</Badge>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">
          {competitor.category} • {competitor.productName} • görsel kalite {competitor.imageQuality}
        </div>
        <div className="space-y-2 rounded-2xl border border-zinc-200 bg-white p-3 text-sm text-zinc-700">
          {(competitor.matchReasons ?? []).slice(0, 3).map((reason) => (
            <div key={reason} className="flex gap-2">
              <ArrowRight className="mt-0.5 size-4 shrink-0 text-orange-600" />
              <span>{reason}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function confidenceBadgeClassName(confidence: AnalysisReport["competitors"][number]["confidence"]) {
  if (confidence === "Yüksek") {
    return "bg-emerald-600 text-white hover:bg-emerald-600"
  }

  if (confidence === "Orta") {
    return "bg-amber-500 text-white hover:bg-amber-500"
  }

  return "bg-zinc-500 text-white hover:bg-zinc-500"
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-3">
      <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className="mt-1 font-medium text-zinc-950">{value}</p>
    </div>
  )
}

function ExecutionStep({ step, title, detail }: { step: string; title: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="mb-2 flex items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-full border border-orange-400/20 bg-orange-500/10 text-sm font-semibold text-orange-200">
          {step}
        </div>
        <p className="font-medium text-white">{title}</p>
      </div>
      <p className="text-sm leading-6 text-zinc-300">{detail}</p>
    </div>
  )
}

function KeyValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className="mt-2 font-medium text-zinc-950">{value}</p>
    </div>
  )
}

function InsightRow({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4">
      <p className="mb-1 text-sm font-medium text-zinc-950">{title}</p>
      <p className="text-sm leading-6 text-zinc-700">{value}</p>
    </div>
  )
}

function PipelineView({
  loading,
  message,
  progress,
  steps,
}: {
  loading: boolean
  message: string
  progress: number
  steps: PipelineStep[]
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{message}</span>
        <span>%{Math.round(progress)}</span>
      </div>
      <StatusBar value={progress} />
      <div className="space-y-2">
        {steps.map((step, index) => (
          <div key={step.key} className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <div
                  className={`flex size-8 items-center justify-center rounded-full text-xs font-semibold ${
                    step.status === "complete"
                      ? "bg-zinc-900 text-white"
                      : step.status === "running"
                        ? "bg-orange-100 text-orange-800"
                        : "bg-zinc-200 text-zinc-600"
                  }`}
                >
                  {loading && step.status === "running" ? <LoaderCircle className="size-3.5 animate-spin" /> : index + 1}
                </div>
                <p className="font-medium text-zinc-950">{step.label}</p>
              </div>
              <Badge variant="secondary">
                {step.status === "complete" ? "Tamam" : step.status === "running" ? "Çalışıyor" : "Bekliyor"}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{step.detail}</p>
          </div>
        ))}
        {loading && steps.length === 0 ? (
          <div className="rounded-2xl border p-3">
            <Skeleton className="mb-2 h-4 w-40" />
            <Skeleton className="h-3 w-full" />
          </div>
        ) : null}
      </div>
    </div>
  )
}
