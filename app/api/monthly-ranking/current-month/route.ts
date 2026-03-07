import { NextResponse } from "next/server"
import { getCurrentMonthCache } from "@/lib/sg-ranking/ranking-cache"
import { refreshRankingCache } from "@/lib/sg-ranking/cron-refresh"

export const dynamic = "force-dynamic"

export async function GET() {
  let cached = getCurrentMonthCache()

  if (!cached) {
    await refreshRankingCache()
    cached = getCurrentMonthCache()
  }

  if (!cached) {
    return NextResponse.json({
      success: true,
      data: [],
      message: "이번달 이용 고객 없음",
    })
  }

  return NextResponse.json({
    success: true,
    year: cached.year,
    month: cached.month,
    data: cached.ranking.slice(0, 100),
  })
}
