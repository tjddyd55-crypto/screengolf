import { NextResponse } from "next/server"
import { clearCurrentAppliedScene } from "@/lib/db/display-settings"
import { getDisplayUnitByCode } from "@/lib/db/display-units"
import {
  getUnitBroadcastState,
  toAdminBroadcastFields,
} from "@/lib/display/resolve-broadcast-state"

export const dynamic = "force-dynamic"

type RouteContext = {
  params: Promise<{ code: string }>
}

/**
 * 현재 적용 화면 해제.
 * Scene/asset/notice는 삭제하지 않고 current_scene_id만 null로 만든다.
 */
export async function POST(_request: Request, context: RouteContext) {
  try {
    const { code } = await context.params
    const unit = getDisplayUnitByCode(code)
    if (!unit) {
      return NextResponse.json(
        { success: false, error: "전광판을 찾을 수 없습니다." },
        { status: 404 },
      )
    }

    clearCurrentAppliedScene(unit.id)

    return NextResponse.json({
      success: true,
      data: toAdminBroadcastFields(getUnitBroadcastState(unit.id)),
    })
  } catch (error) {
    console.error("[admin/display-units/clear-current] POST failed:", error)
    const message =
      error instanceof Error
        ? error.message
        : "현재 화면 해제에 실패했습니다."
    return NextResponse.json(
      { success: false, error: message },
      { status: 400 },
    )
  }
}
