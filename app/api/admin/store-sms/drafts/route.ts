import { NextResponse } from "next/server"
import { createStoreSmsDraftFromTarget } from "@/lib/store-sms/store-sms-campaign-service"
import type { StoreSmsTargetFilter } from "@/lib/store-sms/store-sms-targets"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      type?: "selected" | "filtered_all"
      contactIds?: number[]
      filter?: StoreSmsTargetFilter
    }

    if (body.type !== "selected" && body.type !== "filtered_all") {
      return NextResponse.json(
        { success: false, error: "대상 유형이 올바르지 않습니다." },
        { status: 400 },
      )
    }

    const result = createStoreSmsDraftFromTarget({
      type: body.type,
      contactIds: body.contactIds,
      filter: body.filter,
    })

    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    const code = error instanceof Error ? error.message : "draft_failed"
    const message =
      code === "empty_selection"
        ? "선택된 연락처가 없습니다."
        : "문자 초안 생성에 실패했습니다."
    return NextResponse.json({ success: false, error: message }, { status: 400 })
  }
}
