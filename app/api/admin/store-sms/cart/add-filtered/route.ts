import { NextResponse } from "next/server"
import type { GoogleContactFilter } from "@/lib/db/store-google-contacts"
import {
  postCartAddFiltered,
  withCartCookie,
} from "@/lib/store-sms/store-sms-cart-request"

export const dynamic = "force-dynamic"

function parseStatus(value: unknown): GoogleContactFilter | "all" {
  if (
    value === "linked" ||
    value === "not_in_group" ||
    value === "conflict" ||
    value === "missing_phone" ||
    value === "sms_opt_out"
  ) {
    return value
  }
  return "all"
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      query?: string
      status?: string
      smsOptOut?: boolean | "all" | string
      isActive?: boolean | string
    }

    let smsOptOut: boolean | undefined
    if (body.smsOptOut === true || body.smsOptOut === "true") smsOptOut = true
    else if (body.smsOptOut === false || body.smsOptOut === "false") {
      smsOptOut = false
    }

    let isActive: boolean | undefined
    if (body.isActive === true || body.isActive === "true") isActive = true
    else if (body.isActive === false || body.isActive === "false") {
      isActive = false
    }

    const result = postCartAddFiltered(request, {
      query: body.query,
      status: parseStatus(body.status),
      smsOptOut,
      isActive,
    })

    return withCartCookie(
      NextResponse.json({ success: true, ...result }),
      result.cartKey,
      result.isNew,
    )
  } catch (error) {
    console.error("[store-sms/cart/add-filtered] failed:", error)
    return NextResponse.json(
      { success: false, error: "검색 결과 담기에 실패했습니다." },
      { status: 500 },
    )
  }
}
