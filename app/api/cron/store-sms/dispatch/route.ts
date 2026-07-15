import { NextResponse } from "next/server"
import { dispatchDueStoreSmsCampaigns } from "@/lib/store-sms/store-sms-campaign-service"
import { getStoreSmsEnv } from "@/lib/store-sms/store-sms-env"

export const dynamic = "force-dynamic"

function extractBearer(request: Request): string | null {
  const header = request.headers.get("authorization") ?? ""
  const match = header.match(/^Bearer\s+(.+)$/i)
  return match?.[1]?.trim() || null
}

export async function POST(request: Request) {
  try {
    const env = getStoreSmsEnv()
    if (!env.cronSecret) {
      return NextResponse.json(
        { success: false, error: "cron secret is not configured" },
        { status: 503 },
      )
    }

    const token = extractBearer(request)
    if (!token || token !== env.cronSecret) {
      return NextResponse.json(
        { success: false, error: "unauthorized" },
        { status: 401 },
      )
    }

    const result = await dispatchDueStoreSmsCampaigns()
    return NextResponse.json({
      success: true,
      processedIds: result.processedIds,
      processedCount: result.processedIds.length,
    })
  } catch (error) {
    console.error("[cron/store-sms/dispatch] failed:", error)
    return NextResponse.json(
      { success: false, error: "dispatch failed" },
      { status: 500 },
    )
  }
}
