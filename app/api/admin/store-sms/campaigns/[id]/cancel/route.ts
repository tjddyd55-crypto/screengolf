import { NextResponse } from "next/server"
import { cancelScheduledStoreSmsCampaign } from "@/lib/store-sms/store-sms-campaign-service"
import { getStoreSmsCampaign } from "@/lib/db/store-sms"

export const dynamic = "force-dynamic"

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params
    const campaignId = Number(id)
    if (!Number.isInteger(campaignId) || campaignId <= 0) {
      return NextResponse.json(
        { success: false, error: "캠페인 ID가 올바르지 않습니다." },
        { status: 400 },
      )
    }

    const ok = cancelScheduledStoreSmsCampaign(campaignId)
    if (!ok) {
      return NextResponse.json(
        {
          success: false,
          error: "예약 상태의 캠페인만 취소할 수 있습니다.",
        },
        { status: 400 },
      )
    }

    return NextResponse.json({
      success: true,
      campaign: getStoreSmsCampaign(campaignId),
    })
  } catch (error) {
    console.error("[store-sms/cancel] failed:", error)
    return NextResponse.json(
      { success: false, error: "예약 취소에 실패했습니다." },
      { status: 500 },
    )
  }
}
