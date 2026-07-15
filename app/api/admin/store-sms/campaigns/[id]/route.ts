import { NextResponse } from "next/server"
import {
  getStoreSmsCampaign,
  listStoreSmsDispatchLogs,
  listStoreSmsRecipients,
} from "@/lib/db/store-sms"
import { getStoreSmsModeLabel } from "@/lib/store-sms/store-sms-env"

export const dynamic = "force-dynamic"

export async function GET(
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

    const campaign = getStoreSmsCampaign(campaignId)
    if (!campaign) {
      return NextResponse.json(
        { success: false, error: "캠페인을 찾을 수 없습니다." },
        { status: 404 },
      )
    }

    const recipients = listStoreSmsRecipients(campaignId)
    const logs = listStoreSmsDispatchLogs(campaignId)

    return NextResponse.json({
      success: true,
      campaign,
      recipients,
      logs,
      mode: getStoreSmsModeLabel(),
    })
  } catch (error) {
    console.error("[store-sms/campaigns/id] GET failed:", error)
    return NextResponse.json(
      { success: false, error: "캠페인 상세 조회에 실패했습니다." },
      { status: 500 },
    )
  }
}
