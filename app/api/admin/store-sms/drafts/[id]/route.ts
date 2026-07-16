import { NextResponse } from "next/server"
import { getStoreSmsDraftView } from "@/lib/store-sms/store-sms-campaign-service"
import { formatStoreSmsExclusionCounts } from "@/lib/store-sms/store-sms-exclusion-labels"

export const dynamic = "force-dynamic"

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params
    const draftId = Number(id)
    if (!Number.isInteger(draftId) || draftId <= 0) {
      return NextResponse.json(
        { success: false, error: "초안 ID가 올바르지 않습니다." },
        { status: 400 },
      )
    }

    const view = getStoreSmsDraftView(draftId)
    if (!view) {
      return NextResponse.json(
        { success: false, error: "초안을 찾을 수 없거나 만료되었습니다." },
        { status: 404 },
      )
    }

    return NextResponse.json({
      success: true,
      draft: {
        id: view.draft.id,
        targetType: view.draft.target_type,
        expiresAt: view.draft.expires_at,
      },
      summary: {
        total: view.summary.total,
        sendable: view.summary.sendable,
        excluded: view.summary.excluded,
        exclusionCounts: view.summary.exclusionCounts,
        exclusionLabels: formatStoreSmsExclusionCounts(
          view.summary.exclusionCounts,
        ),
      },
      filter: view.filter ?? null,
      contactIds: view.contactIds ?? null,
    })
  } catch (error) {
    console.error("[store-sms/drafts] GET failed:", error)
    return NextResponse.json(
      { success: false, error: "초안 조회에 실패했습니다." },
      { status: 500 },
    )
  }
}
