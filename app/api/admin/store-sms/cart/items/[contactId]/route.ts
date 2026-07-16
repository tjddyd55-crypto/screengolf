import { NextResponse } from "next/server"
import {
  deleteCartItem,
  withCartCookie,
} from "@/lib/store-sms/store-sms-cart-request"

export const dynamic = "force-dynamic"

export async function DELETE(
  request: Request,
  context: { params: Promise<{ contactId: string }> },
) {
  try {
    const { contactId: raw } = await context.params
    const contactId = Number(raw)
    if (!Number.isInteger(contactId) || contactId <= 0) {
      return NextResponse.json(
        { success: false, error: "연락처 ID가 올바르지 않습니다." },
        { status: 400 },
      )
    }
    const result = deleteCartItem(request, contactId)
    return withCartCookie(
      NextResponse.json({ success: true, ...result }),
      result.cartKey,
      result.isNew,
    )
  } catch (error) {
    console.error("[store-sms/cart/items/id] DELETE failed:", error)
    return NextResponse.json(
      { success: false, error: "대상함에서 제거하지 못했습니다." },
      { status: 500 },
    )
  }
}
