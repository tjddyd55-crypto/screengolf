import { NextResponse } from "next/server"
import { getLastMonthCache } from "@/lib/sg-ranking/ranking-cache"
import { refreshRankingCache } from "@/lib/sg-ranking/cron-refresh"

export const dynamic = "force-dynamic"

export async function GET() {
  let cached = getLastMonthCache()

  if (!cached) {
    await refreshRankingCache()
    cached = getLastMonthCache()
  }

  if (!cached) {
    return NextResponse.json({
      success: true,
      data: [],
      message: "지난달 데이터가 없습니다.",
    })
  }

  return NextResponse.json({
    success: true,
    year: cached.year,
    month: cached.month,
    data: cached.top5,
  })
}
