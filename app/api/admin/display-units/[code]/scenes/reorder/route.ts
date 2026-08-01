import { NextResponse } from "next/server"
import { reorderDisplayScenes } from "@/lib/db/display-scenes"
import { getDisplayUnitByCode } from "@/lib/db/display-units"

export const dynamic = "force-dynamic"

type RouteContext = {
  params: Promise<{ code: string }>
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { code } = await context.params
    const unit = getDisplayUnitByCode(code)
    if (!unit) {
      return NextResponse.json(
        { success: false, error: "전광판을 찾을 수 없습니다." },
        { status: 404 },
      )
    }

    const body = (await request.json()) as { ordered_ids?: unknown }
    if (!Array.isArray(body.ordered_ids)) {
      return NextResponse.json(
        { success: false, error: "ordered_ids 배열이 필요합니다." },
        { status: 400 },
      )
    }

    const orderedIds = body.ordered_ids.map((value) => Number(value))
    if (orderedIds.some((id) => !Number.isInteger(id) || id <= 0)) {
      return NextResponse.json(
        { success: false, error: "유효하지 않은 Scene id입니다." },
        { status: 400 },
      )
    }

    const data = reorderDisplayScenes(unit.id, orderedIds)
    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error("[admin/display-units/scenes/reorder] POST failed:", error)
    const message =
      error instanceof Error ? error.message : "Scene 순서 저장에 실패했습니다."
    return NextResponse.json(
      { success: false, error: message },
      { status: 400 },
    )
  }
}
