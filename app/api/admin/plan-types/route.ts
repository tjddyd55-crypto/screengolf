import { NextResponse } from "next/server"
import { createPlanType, listPlanTypes } from "@/lib/db/store-plan-types"

export const dynamic = "force-dynamic"

function normalizeCode(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const activeOnly = searchParams.get("activeOnly") === "true"
    const data = listPlanTypes({ activeOnly })
    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error("[admin/plan-types] GET failed:", error)
    return NextResponse.json(
      { success: false, error: "요금제 목록 조회에 실패했습니다." },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      name?: string
      code?: string
      sort_order?: number
      is_active?: boolean
    }

    const name = body.name?.trim()
    const code = normalizeCode(body.code ?? "")

    if (!name) {
      return NextResponse.json(
        { success: false, error: "요금제 이름은 필수입니다." },
        { status: 400 },
      )
    }

    if (!code) {
      return NextResponse.json(
        { success: false, error: "요금제 코드는 필수입니다." },
        { status: 400 },
      )
    }

    const data = createPlanType({
      name,
      code,
      sort_order: body.sort_order,
      is_active: body.is_active ?? true,
    })

    return NextResponse.json({ success: true, data }, { status: 201 })
  } catch (error) {
    console.error("[admin/plan-types] POST failed:", error)
    const message =
      error instanceof Error ? error.message : "요금제 등록에 실패했습니다."
    return NextResponse.json(
      { success: false, error: message },
      { status: message.includes("코드") ? 409 : 500 },
    )
  }
}
