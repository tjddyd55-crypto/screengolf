import { NextResponse } from "next/server"
import {
  deactivateDisplayUnit,
  getDisplayUnitByCode,
  updateDisplayUnit,
} from "@/lib/db/display-units"
import { getDisplaySettingsView } from "@/lib/db/display-settings"

export const dynamic = "force-dynamic"

type RouteContext = {
  params: Promise<{ code: string }>
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { code } = await context.params
    const unit = getDisplayUnitByCode(code)
    if (!unit) {
      return NextResponse.json(
        { success: false, error: "전광판을 찾을 수 없습니다." },
        { status: 404 },
      )
    }

    const settings = getDisplaySettingsView(unit.id)
    return NextResponse.json({
      success: true,
      data: {
        ...unit,
        current_mode: settings.mode,
        current_scene: settings.current_scene,
      },
    })
  } catch (error) {
    console.error("[admin/display-units/code] GET failed:", error)
    return NextResponse.json(
      { success: false, error: "전광판 조회에 실패했습니다." },
      { status: 500 },
    )
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { code } = await context.params
    const unit = getDisplayUnitByCode(code)
    if (!unit) {
      return NextResponse.json(
        { success: false, error: "전광판을 찾을 수 없습니다." },
        { status: 404 },
      )
    }

    const body = (await request.json()) as {
      name?: string
      sort_order?: number
      is_active?: boolean
    }

    const updated = updateDisplayUnit(unit.id, body)
    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error("[admin/display-units/code] PATCH failed:", error)
    const message =
      error instanceof Error ? error.message : "전광판 수정에 실패했습니다."
    return NextResponse.json(
      { success: false, error: message },
      { status: 400 },
    )
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { code } = await context.params
    const unit = getDisplayUnitByCode(code)
    if (!unit) {
      return NextResponse.json(
        { success: false, error: "전광판을 찾을 수 없습니다." },
        { status: 404 },
      )
    }

    deactivateDisplayUnit(unit.id)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[admin/display-units/code] DELETE failed:", error)
    const message =
      error instanceof Error ? error.message : "전광판 비활성에 실패했습니다."
    return NextResponse.json(
      { success: false, error: message },
      { status: 400 },
    )
  }
}
