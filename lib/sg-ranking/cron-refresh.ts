import { scrapeMonthlyPlayers } from "./admin-scraper"
import { generateRanking, takeTop } from "./ranking-generator"
import {
  setLastMonthCache,
  setCurrentMonthCache,
  getLastRefreshedAt,
} from "./ranking-cache"

const REFRESH_INTERVAL_MS = 5 * 60 * 1000

function getPreviousMonth(year: number, month: number) {
  if (month === 1) return { year: year - 1, month: 12 }
  return { year, month: month - 1 }
}

export async function refreshRankingCache(): Promise<void> {
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1

  const { year: lastYear, month: lastMonth } = getPreviousMonth(
    currentYear,
    currentMonth,
  )

  try {
    const [currentPlayers, lastPlayers] = await Promise.all([
      scrapeMonthlyPlayers(currentYear, currentMonth),
      scrapeMonthlyPlayers(lastYear, lastMonth),
    ])

    const currentRanking = generateRanking(currentPlayers)
    const lastRanking = generateRanking(lastPlayers)

    setCurrentMonthCache(currentYear, currentMonth, currentRanking)
    setLastMonthCache(lastYear, lastMonth, takeTop(lastRanking, 5))

    console.log(
      `[cron-refresh] 갱신 완료 - 현재월: ${currentRanking.length}명, 지난달 TOP5: ${takeTop(lastRanking, 5).length}명`,
    )
  } catch (error) {
    console.error("[cron-refresh] 갱신 실패, 기존 캐시 유지:", error)
  }
}

let cronTimer: ReturnType<typeof setInterval> | null = null

export function startCronRefresh(): void {
  if (cronTimer !== null) return

  refreshRankingCache()

  cronTimer = setInterval(() => {
    refreshRankingCache()
  }, REFRESH_INTERVAL_MS)

  console.log(
    `[cron-refresh] 자동 갱신 시작 (${REFRESH_INTERVAL_MS / 1000}초 주기)`,
  )
}

export function stopCronRefresh(): void {
  if (cronTimer !== null) {
    clearInterval(cronTimer)
    cronTimer = null
  }
}

export function getLastRefreshed(): Date | null {
  return getLastRefreshedAt()
}
