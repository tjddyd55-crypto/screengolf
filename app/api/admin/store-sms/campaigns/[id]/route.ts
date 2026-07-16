import { NextResponse } from "next/server"
import {
  getStoreSmsCampaign,
  getStoreSmsRecipientStatusCounts,
  listRecentStoreSmsFailedDispatchHints,
  listRecentStoreSmsFailedRecipientHints,
  listStoreSmsDispatchLogs,
  listStoreSmsRecipients,
} from "@/lib/db/store-sms"
import {
  buildStoreSmsCampaignUi,
  computeStoreSmsCampaignProgress,
  isStoreSmsBalanceInsufficientSignal,
} from "@/lib/store-sms/store-sms-campaign-ui"
import { getStoreSmsModeLabel } from "@/lib/store-sms/store-sms-env"

export const dynamic = "force-dynamic"

function detectBalancePaused(campaignId: number, pending: number): boolean {
  if (pending <= 0) return false

  const logs = listRecentStoreSmsFailedDispatchHints(campaignId, 12)
  if (
    logs.some((row) =>
      isStoreSmsBalanceInsufficientSignal({
        errorCode: row.error_code,
        errorMessage: row.error_message,
      }),
    )
  ) {
    return true
  }

  const recipients = listRecentStoreSmsFailedRecipientHints(campaignId, 12)
  return recipients.some((row) =>
    isStoreSmsBalanceInsufficientSignal({
      errorMessage: row.error_message,
    }),
  )
}

function buildProgressPayload(campaignId: number) {
  const campaign = getStoreSmsCampaign(campaignId)
  if (!campaign) return null

  const counts = getStoreSmsRecipientStatusCounts(campaignId)
  const progress = computeStoreSmsCampaignProgress({
    total: campaign.total_recipients,
    sendable: campaign.sendable_recipients,
    success: counts.success,
    failed: counts.failed,
    excluded: counts.excluded,
    pending: counts.pending + counts.processing,
  })

  const balancePaused =
    campaign.status === "processing" &&
    detectBalancePaused(campaignId, progress.remaining)

  const ui = buildStoreSmsCampaignUi({
    campaign,
    progress,
    balancePaused,
  })

  return { campaign, progress, ui, balancePaused }
}

export async function GET(
  request: Request,
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

    const payload = buildProgressPayload(campaignId)
    if (!payload) {
      return NextResponse.json(
        { success: false, error: "캠페인을 찾을 수 없습니다." },
        { status: 404 },
      )
    }

    const { searchParams } = new URL(request.url)
    const summaryOnly =
      searchParams.get("summary") === "1" ||
      searchParams.get("view") === "summary"

    if (summaryOnly) {
      return NextResponse.json({
        success: true,
        campaign: payload.campaign,
        progress: payload.progress,
        ui: payload.ui,
        mode: getStoreSmsModeLabel(),
      })
    }

    return NextResponse.json({
      success: true,
      campaign: payload.campaign,
      progress: payload.progress,
      ui: payload.ui,
      recipients: listStoreSmsRecipients(campaignId),
      logs: listStoreSmsDispatchLogs(campaignId),
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
