import { NextResponse } from "next/server"
import {
  deleteCartItems,
  postCartItems,
  withCartCookie,
} from "@/lib/store-sms/store-sms-cart-request"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { contactIds?: number[] }
    const contactIds = Array.isArray(body.contactIds) ? body.contactIds : []
    if (contactIds.length === 0) {
      return NextResponse.json(
        { success: false, error: "담을 연락처를 선택해 주세요." },
        { status: 400 },
      )
    }
    const result = postCartItems(request, contactIds)
    return withCartCookie(
      NextResponse.json({ success: true, ...result }),
      result.cartKey,
      result.isNew,
    )
  } catch (error) {
    console.error("[store-sms/cart/items] POST failed:", error)
    return NextResponse.json(
      { success: false, error: "대상함 담기에 실패했습니다." },
      { status: 500 },
    )
  }
}

export async function DELETE(request: Request) {
  try {
    const body = (await request.json()) as { contactIds?: number[] }
    const contactIds = Array.isArray(body.contactIds) ? body.contactIds : []
    const result = deleteCartItems(request, contactIds)
    return withCartCookie(
      NextResponse.json({ success: true, ...result }),
      result.cartKey,
      result.isNew,
    )
  } catch (error) {
    console.error("[store-sms/cart/items] DELETE failed:", error)
    return NextResponse.json(
      { success: false, error: "대상함 항목 삭제에 실패했습니다." },
      { status: 500 },
    )
  }
}
