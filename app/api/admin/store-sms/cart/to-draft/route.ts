import { NextResponse } from "next/server"
import {
  cartToDraft,
  withCartCookie,
} from "@/lib/store-sms/store-sms-cart-request"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    const result = cartToDraft(request)
    return withCartCookie(
      NextResponse.json({
        success: true,
        draftId: result.draftId,
        summary: {
          total: result.summary.total,
          sendable: result.summary.sendable,
          excluded: result.summary.excluded,
          exclusionCounts: result.summary.exclusionCounts,
        },
        expiresAt: result.expiresAt,
      }),
      result.cartKey,
      result.isNew,
    )
  } catch (error) {
    const code = error instanceof Error ? error.message : "to_draft_failed"
    const message =
      code === "empty_cart"
        ? "대상함이 비어 있습니다."
        : "문자 작성 초안 생성에 실패했습니다."
    return NextResponse.json({ success: false, error: message }, { status: 400 })
  }
}
