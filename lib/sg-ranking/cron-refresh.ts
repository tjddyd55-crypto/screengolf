import { scrapeMonthlyPlayers } from "./admin-scraper"
import { generateRanking, takeTop } from "./ranking-generator"
import {
  getKoreaYearMonth,
  getCurrentMonthDateRange,
  getLastMonthDateRange,
  getPreviousMonth,
  shouldRunMonthlyFinalJob,
} from "./date-range"
import {
  setLastMonthCache,
  getLastMonthCache,
  getLastMonthSnapshotRecord,
  hasPersistedLastMonthSnapshot,
  setLastMonthSnapshot,
  setCurrentMonthCache,
  getCurrentMonthCache,
  getLastRefreshedAt,
} from "./ranking-cache"

const REFRESH_INTERVAL_MS = 5 * 60 * 1000
let refreshInFlight: Promise<void> | null = null
let monthlyFinalJobKey: string | null = null

async function recoverLastMonthSnapshot(
  lastYear: number,
  lastMonth: number,
): Promise<void> {
  if (hasPersistedLastMonthSnapshot(lastYear, lastMonth)) {
    return
  }

  const lastMonthRange = getLastMonthDateRange()
  console.log(
    `[cron-refresh] 지난달 스냅샷 없음, 복구 수집 시도 monthKey=${lastMonthRange.monthKey}, startDate=${lastMonthRange.startDate}, endDate=${lastMonthRange.endDate}`,
  )

  try {
    const lastMonthPlayers = await scrapeMonthlyPlayers(lastYear, lastMonth)
    console.log(
      `[cron-refresh] 지난달 복구 수집 완료 raw=${lastMonthPlayers.length}`,
    )

    if (lastMonthPlayers.length === 0) {
      console.warn(
        "[cron-refresh] 지난달 복구 0건, cachePreserved reason=empty-fetch",
      )
      return
    }

    const lastMonthRanking = generateRanking(lastMonthPlayers)
    const recoveredTop5 = takeTop(lastMonthRanking, 5)

    if (recoveredTop5.length === 0) {
      console.warn(
        "[cron-refresh] 지난달 복구 랭킹 0건, cachePreserved reason=empty-ranking",
      )
      return
    }

    setLastMonthSnapshot({
      year: lastYear,
      month: lastMonth,
      top5: recoveredTop5,
      ranking: lastMonthRanking,
      status: "RECOVERED",
      sourceCount: lastMonthPlayers.length,
      validCount: lastMonthRanking.length,
    })

    console.log(
      `[cron-refresh] 지난달 스냅샷 복구 완료 TOP5=${recoveredTop5.map((item) => `${item.rank}:${item.nickname}`).join(", ")}`,
    )
  } catch (error) {
    console.error(
      "[cron-refresh] 지난달 스냅샷 복구 실패, cachePreserved reason=fetch-error:",
      error,
    )
  }
}

async function ensureMonthlyFinalSnapshot(
  lastYear: number,
  lastMonth: number,
): Promise<void> {
  if (!shouldRunMonthlyFinalJob()) {
    return
  }

  const jobKey = `${lastYear}-${String(lastMonth).padStart(2, "0")}`
  if (monthlyFinalJobKey === jobKey) {
    return
  }

  const existing = getLastMonthSnapshotRecord(lastYear, lastMonth)
  if (existing?.status === "FINAL" && existing.top5.length > 0) {
    monthlyFinalJobKey = jobKey
    return
  }

  const lastMonthRange = getLastMonthDateRange()
  console.log(
    `[cron-refresh] 월초 FINAL 생성 시도 monthKey=${lastMonthRange.monthKey}, startDate=${lastMonthRange.startDate}, endDate=${lastMonthRange.endDate}`,
  )

  try {
    const lastMonthPlayers = await scrapeMonthlyPlayers(lastYear, lastMonth)
    if (lastMonthPlayers.length === 0) {
      console.warn(
        "[cron-refresh] 월초 FINAL 0건, cachePreserved reason=empty-fetch",
      )
      return
    }

    const lastMonthRanking = generateRanking(lastMonthPlayers)
    const finalTop5 = takeTop(lastMonthRanking, 5)
    if (finalTop5.length === 0) {
      console.warn(
        "[cron-refresh] 월초 FINAL 랭킹 0건, cachePreserved reason=empty-ranking",
      )
      return
    }

    const saved = setLastMonthSnapshot({
      year: lastYear,
      month: lastMonth,
      top5: finalTop5,
      ranking: lastMonthRanking,
      status: "FINAL",
      sourceCount: lastMonthPlayers.length,
      validCount: lastMonthRanking.length,
    })

    if (saved) {
      monthlyFinalJobKey = jobKey
      console.log(
        `[cron-refresh] 월초 FINAL 생성 완료 monthKey=${jobKey}, TOP5=${finalTop5.length}`,
      )
    }
  } catch (error) {
    console.error(
      "[cron-refresh] 월초 FINAL 생성 실패, cachePreserved reason=fetch-error:",
      error,
    )
  }
}

async function doRefreshRankingCache(): Promise<void> {
  const { year: currentYear, month: currentMonth } = getKoreaYearMonth()
  const previousLastMonthCache = getLastMonthCache()
  const previousCurrentMonthCache = getCurrentMonthCache()
  const { year: lastYear, month: lastMonth } = getPreviousMonth(
    currentYear,
    currentMonth,
  )
  const lastMonthRange = getLastMonthDateRange()
  const currentMonthRange = getCurrentMonthDateRange()

  console.log(
    `[cron-refresh] 갱신 시작 currentDate=${new Date().toISOString()}, lastMonthStart=${lastMonthRange.startDate}, lastMonthEnd=${lastMonthRange.endDate}, currentMonthStart=${currentMonthRange.startDate}, currentMonthEnd=${currentMonthRange.endDate}`,
  )

  if (
    previousCurrentMonthCache &&
    (previousCurrentMonthCache.year !== currentYear ||
      previousCurrentMonthCache.month !== currentMonth)
  ) {
    const rolloverSnapshot = getLastMonthSnapshotRecord(
      previousCurrentMonthCache.year,
      previousCurrentMonthCache.month,
    )

    if (!rolloverSnapshot) {
      const frozenTop5 = takeTop(previousCurrentMonthCache.ranking, 5)
      if (frozenTop5.length > 0) {
        setLastMonthSnapshot({
          year: previousCurrentMonthCache.year,
          month: previousCurrentMonthCache.month,
          top5: frozenTop5,
          ranking: previousCurrentMonthCache.ranking,
          status: "FINAL",
          sourceCount: previousCurrentMonthCache.ranking.length,
          validCount: previousCurrentMonthCache.ranking.length,
        })
        console.log(
          `[cron-refresh] 월 전환 FINAL 스냅샷 고정 완료 (${previousCurrentMonthCache.year}-${previousCurrentMonthCache.month})`,
        )
      } else {
        console.warn(
          `[cron-refresh] 월 전환 스냅샷 생성 건너뜀 (${previousCurrentMonthCache.year}-${previousCurrentMonthCache.month}): 빈 랭킹`,
        )
      }
    }
  }

  await ensureMonthlyFinalSnapshot(lastYear, lastMonth)
  await recoverLastMonthSnapshot(lastYear, lastMonth)

  try {
    const currentPlayers = await scrapeMonthlyPlayers(currentYear, currentMonth)
    const lastMonthSnapshot = getLastMonthSnapshotRecord(lastYear, lastMonth)

    const currentRanking = generateRanking(currentPlayers)
    setCurrentMonthCache(currentYear, currentMonth, currentRanking)

    const lastMonthTop5 = lastMonthSnapshot?.top5 ?? null
    const previousLastMonthCount = previousLastMonthCache?.top5.length ?? 0

    if (lastMonthTop5 && lastMonthTop5.length > 0) {
      setLastMonthCache(lastYear, lastMonth, lastMonthTop5)
      console.log(
        `[cron-refresh] 갱신 완료 - 현재월: ${currentRanking.length}명, previousLastMonthCount=${previousLastMonthCount}, fetchedLastMonthCount=${lastMonthTop5.length}, generatedLastMonthRankingCount=${lastMonthTop5.length}, cacheUpdated=true`,
      )
    } else {
      console.warn(
        `[cron-refresh] 갱신 완료 - 현재월: ${currentRanking.length}명, previousLastMonthCount=${previousLastMonthCount}, fetchedLastMonthCount=0, cacheUpdated=false, cachePreserved reason=no-snapshot`,
      )
    }
  } catch (error) {
    console.error("[cron-refresh] 갱신 실패, 기존 캐시 유지:", error)
  }
}

export async function refreshRankingCache(): Promise<void> {
  if (refreshInFlight) {
    return refreshInFlight
  }

  refreshInFlight = doRefreshRankingCache().finally(() => {
    refreshInFlight = null
  })

  return refreshInFlight
}

export async function ensureFreshCache(
  maxAgeMs: number = REFRESH_INTERVAL_MS,
): Promise<void> {
  const lastRefreshedAt = getLastRefreshedAt()
  if (!lastRefreshedAt) {
    await refreshRankingCache()
    return
  }

  const elapsedMs = Date.now() - lastRefreshedAt.getTime()
  if (elapsedMs >= maxAgeMs) {
    await refreshRankingCache()
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
