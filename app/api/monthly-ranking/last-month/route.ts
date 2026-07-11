import { NextResponse } from "next/server"
import {
  getLastMonthCache,
  getLastMonthSnapshotMeta,
} from "@/lib/sg-ranking/ranking-cache"
import { ensureFreshCache, refreshRankingCache } from "@/lib/sg-ranking/cron-refresh"
import { getKoreaYearMonth, getPreviousMonth } from "@/lib/sg-ranking/date-range"

export const dynamic = "force-dynamic"

export async function GET() {
  await ensureFreshCache()

  let cached = getLastMonthCache()

  if (!cached) {
    await refreshRankingCache()
    cached = getLastMonthCache()
  }

  if (!cached) {
    const { year, month } = getKoreaYearMonth()
    const previous = getPreviousMonth(year, month)

    return NextResponse.json({
      success: true,
      data: [],
      message: "지난달 데이터가 없습니다.",
      period: {
        year: previous.year,
        month: previous.month,
        monthKey: `${previous.year}-${String(previous.month).padStart(2, "0")}`,
      },
      stale: true,
    })
  }

  const meta = getLastMonthSnapshotMeta(cached.year, cached.month)

  return NextResponse.json({
    success: true,
    year: cached.year,
    month: cached.month,
    data: cached.top5,
    period: meta
      ? {
          year: cached.year,
          month: cached.month,
          monthKey: meta.monthKey,
          startDate: meta.startDate,
          endDate: meta.endDate,
        }
      : undefined,
    snapshot: meta
      ? {
          source: meta.source,
          status: meta.status,
          generatedAt: meta.updatedAt,
          sourceCount: meta.sourceCount,
          validCount: meta.validCount,
        }
      : undefined,
    updatedAt: meta?.updatedAt,
    stale: false,
  })
}
