import { NextResponse } from "next/server"
import {
  listStoreGoogleContacts,
  type GoogleContactFilter,
} from "@/lib/db/store-google-contacts"

export const dynamic = "force-dynamic"

function parseFilter(value: string | null): GoogleContactFilter {
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

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search") ?? undefined
    const filter = parseFilter(searchParams.get("filter"))
    const data = listStoreGoogleContacts({ search, filter })
    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error("[google-contacts/list] GET failed:", error)
    return NextResponse.json(
      { success: false, error: "연락처 목록 조회에 실패했습니다." },
      { status: 500 },
    )
  }
}
