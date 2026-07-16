import { NextResponse } from "next/server"
import { listDraftRecipientsForUi } from "@/lib/store-sms/store-sms-campaign-service"
import { formatStoreSmsExclusionCounts } from "@/lib/store-sms/store-sms-exclusion-labels"
import { storeSmsExclusionLabel } from "@/lib/store-sms/store-sms-exclusion-labels"

export const dynamic = "force-dynamic"

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id: raw } = await context.params
    const draftId = Number(raw)
    if (!Number.isInteger(draftId) || draftId <= 0) {
      return NextResponse.json(
        { success: false, error: "초안 ID가 올바르지 않습니다." },
        { status: 400 },
      )
    }

    const { searchParams } = new URL(request.url)
    const statusRaw = searchParams.get("status") ?? "all"
    const status =
      statusRaw === "sendable" || statusRaw === "excluded" ? statusRaw : "all"

    const result = listDraftRecipientsForUi(draftId, {
      status,
      exclusionReason: searchParams.get("exclusionReason") ?? undefined,
      query: searchParams.get("query") ?? undefined,
      page: Number(searchParams.get("page") ?? 1),
      pageSize: Number(searchParams.get("pageSize") ?? 50),
    })

    if (!result) {
      return NextResponse.json(
        { success: false, error: "초안을 찾을 수 없거나 만료되었습니다." },
        { status: 404 },
      )
    }

    return NextResponse.json({
      success: true,
      data: result.data.map((row) => ({
        ...row,
        exclusionReasonLabel: storeSmsExclusionLabel(row.exclusion_reason),
      })),
      summary: {
        total: result.summary.total,
        sendable: result.summary.sendable,
        excluded: result.summary.excluded,
        exclusions: result.summary.exclusions,
        exclusionLabels: formatStoreSmsExclusionCounts(
          result.summary.exclusions,
        ),
      },
      pagination: result.pagination,
    })
  } catch (error) {
    console.error("[store-sms/drafts/recipients] GET failed:", error)
    return NextResponse.json(
      { success: false, error: "대상 목록 조회에 실패했습니다." },
      { status: 500 },
    )
  }
}
