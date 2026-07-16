import { NextResponse } from "next/server"
import { listGroupMemberIds } from "@/lib/db/store-sms-groups"
import {
  postCartItems,
  withCartCookie,
} from "@/lib/store-sms/store-sms-cart-request"

export const dynamic = "force-dynamic"

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id: raw } = await context.params
    const id = Number(raw)
    const ids = listGroupMemberIds(id)
    if (ids.length === 0) {
      return NextResponse.json(
        { success: false, error: "그룹 멤버가 없습니다." },
        { status: 400 },
      )
    }
    const result = postCartItems(request, ids)
    return withCartCookie(
      NextResponse.json({
        success: true,
        mode: "add",
        groupMemberCount: ids.length,
        ...result,
      }),
      result.cartKey,
      result.isNew,
    )
  } catch (error) {
    console.error("[contact-groups/add-to-cart] failed:", error)
    return NextResponse.json(
      { success: false, error: "대상함 추가에 실패했습니다." },
      { status: 500 },
    )
  }
}
