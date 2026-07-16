import { NextResponse } from "next/server"
import {
  clearCartRequest,
  getCartItems,
  getCartSummary,
  withCartCookie,
} from "@/lib/store-sms/store-sms-cart-request"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const detail = searchParams.get("detail") === "1"
    if (!detail) {
      const summary = getCartSummary(request)
      return withCartCookie(
        NextResponse.json({ success: true, ...summary }),
        summary.cartKey,
        summary.isNew,
      )
    }

    const page = Number(searchParams.get("page") ?? 1)
    const pageSize = Number(searchParams.get("pageSize") ?? 50)
    const query = searchParams.get("query") ?? undefined
    const result = getCartItems(request, {
      query,
      page: Number.isFinite(page) ? page : 1,
      pageSize: Number.isFinite(pageSize) ? pageSize : 50,
    })
    return withCartCookie(
      NextResponse.json({ success: true, ...result }),
      result.cartKey,
      result.isNew,
    )
  } catch (error) {
    console.error("[store-sms/cart] GET failed:", error)
    return NextResponse.json(
      { success: false, error: "대상함 조회에 실패했습니다." },
      { status: 500 },
    )
  }
}

export async function DELETE(request: Request) {
  try {
    const result = clearCartRequest(request)
    return withCartCookie(
      NextResponse.json({ success: true, ...result }),
      result.cartKey,
      result.isNew,
    )
  } catch (error) {
    console.error("[store-sms/cart] DELETE failed:", error)
    return NextResponse.json(
      { success: false, error: "대상함 비우기에 실패했습니다." },
      { status: 500 },
    )
  }
}
