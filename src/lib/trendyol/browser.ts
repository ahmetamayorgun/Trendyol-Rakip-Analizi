import { chromium } from "playwright"

const LOCAL_LIBS_PATH = `${process.cwd()}/.local-libs/usr/lib/x86_64-linux-gnu`
const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36"

export async function withTrendyolPage<T>(fn: (page: import("playwright").Page) => Promise<T>) {
  const browser = await chromium.launch({
    headless: true,
    env: {
      ...process.env,
      LD_LIBRARY_PATH: `${LOCAL_LIBS_PATH}:${process.env.LD_LIBRARY_PATH ?? ""}`,
    },
  })

  const context = await browser.newContext({
    userAgent: DEFAULT_USER_AGENT,
    locale: "tr-TR",
    timezoneId: "Europe/Istanbul",
    viewport: { width: 1440, height: 2200 },
  })

  const page = await context.newPage()
  page.setDefaultTimeout(60_000)
  await page.route(/\.(png|jpe?g|webp|gif|svg|woff2?|ttf|mp4|webm)(?:\?.*)?$/i, (route) => route.abort())

  try {
    return await fn(page)
  } finally {
    await context.close()
    await browser.close()
  }
}
