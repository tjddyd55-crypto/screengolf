import { NextResponse } from "next/server"
import {
  listStoreGoogleContactsPage,
  type GoogleContactFilter,
} from "@/lib/db/store-google-contacts"

export const dynamic = "force-dynamic"

function parseStatus(value: string | null): GoogleContactFilter | "all" {
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

function parseOptionalBoolean(value: string | null): boolean | undefined {
  if (value == null || value === "") return undefined
  if (value === "true" || value === "1") return true
  if (value === "false" || value === "0") return false
  return undefined
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const query =
      searchParams.get("query") ?? searchParams.get("search") ?? undefined
    const legacyFilter = searchParams.get("filter")
    const status = parseStatus(searchParams.get("status") ?? legacyFilter)
    const smsOptOut = parseOptionalBoolean(searchParams.get("smsOptOut"))
    const isActive = parseOptionalBoolean(searchParams.get("isActive"))
    const page = Number(searchParams.get("page") ?? 1)
    const pageSize = Number(searchParams.get("pageSize") ?? 50)

    const result = listStoreGoogleContactsPage({
      query,
      status,
      smsOptOut,
      isActive,
      page: Number.isFinite(page) ? page : 1,
      pageSize: Number.isFinite(pageSize) ? pageSize : 50,
    })

    return NextResponse.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    })
  } catch (error) {
    console.error("[google-contacts/list] GET failed:", error)
    return NextResponse.json(
      { success: false, error: "연락처 목록 조회에 실패했습니다." },
      { status: 500 },
    )
  }
}
