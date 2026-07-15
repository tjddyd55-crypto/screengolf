import { NextResponse } from "next/server"
import {
  createStoreSmsCampaignFromRequest,
  listHistoryStoreSmsCampaigns,
  listScheduledStoreSmsCampaigns,
  queueImmediateStoreSmsCampaign,
} from "@/lib/store-sms/store-sms-campaign-service"
import { getStoreSmsModeLabel } from "@/lib/store-sms/store-sms-env"
import type { StoreSmsTargetFilter } from "@/lib/store-sms/store-sms-targets"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const view = searchParams.get("view") ?? "history"
    const campaigns =
      view === "scheduled"
        ? listScheduledStoreSmsCampaigns()
        : listHistoryStoreSmsCampaigns()

    return NextResponse.json({
      success: true,
      data: campaigns,
      mode: getStoreSmsModeLabel(),
    })
  } catch (error) {
    console.error("[store-sms/campaigns] GET failed:", error)
    return NextResponse.json(
      { success: false, error: "캠페인 목록 조회에 실패했습니다." },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      title?: string
      message?: string
      sendMode?: "immediate" | "scheduled"
      scheduledAt?: string | null
      draftId?: number
      target?: {
        type: "selected" | "filtered_all"
        contactIds?: number[]
        filter?: StoreSmsTargetFilter
      }
    }

    if (body.sendMode !== "immediate" && body.sendMode !== "scheduled") {
      return NextResponse.json(
        { success: false, error: "발송 방식이 올바르지 않습니다." },
        { status: 400 },
      )
    }

    const created = createStoreSmsCampaignFromRequest({
      title: body.title ?? "",
      message: body.message ?? "",
      sendMode: body.sendMode,
      scheduledAt: body.scheduledAt,
      draftId: body.draftId,
      target: body.target,
    })

    let status: string = created.status
    if (body.sendMode === "immediate") {
      const dispatched = await queueImmediateStoreSmsCampaign(created.campaignId)
      status = dispatched?.status ?? created.status
    }

    return NextResponse.json({
      success: true,
      campaignId: created.campaignId,
      status,
      summary: created.summary,
      mode: getStoreSmsModeLabel(),
    })
  } catch (error) {
    const code = error instanceof Error ? error.message : "create_failed"
    const messages: Record<string, string> = {
      title_required: "제목을 입력해 주세요.",
      message_required: "메시지 내용을 입력해 주세요.",
      scheduled_at_required: "예약 시각을 입력해 주세요.",
      scheduled_at_too_soon: "예약 시각은 현재보다 최소 5분 이후여야 합니다.",
      invalid_scheduled_at: "예약 시각 형식이 올바르지 않습니다.",
      draft_not_found: "문자 초안을 찾을 수 없거나 만료되었습니다.",
      empty_recipients: "발송 대상이 없습니다.",
      target_required: "발송 대상이 필요합니다.",
    }
    return NextResponse.json(
      {
        success: false,
        error: messages[code] ?? "캠페인 생성에 실패했습니다.",
      },
      { status: 400 },
    )
  }
}
