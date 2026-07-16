import { NextResponse } from "next/server"
import { DISPLAY_MODES, type DisplayMode } from "@/lib/admin/constants"
import {
  getDisplaySettingsView,
  updateDisplaySettings,
} from "@/lib/db/display-settings"
import { getDisplayUnitByCode } from "@/lib/db/display-units"

export const dynamic = "force-dynamic"

type RouteContext = {
  params: Promise<{ code: string }>
}

function isDisplayMode(value: string): value is DisplayMode {
  return DISPLAY_MODES.includes(value as DisplayMode)
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

    return NextResponse.json({
      success: true,
      data: getDisplaySettingsView(unit.id),
    })
  } catch (error) {
    console.error("[admin/display-units/settings] GET failed:", error)
    return NextResponse.json(
      { success: false, error: "설정 조회에 실패했습니다." },
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
      mode?: string
      active_notice_id?: number | null
      media_full_file_id?: number | null
      media_left_file_id?: number | null
      media_right_file_id?: number | null
    }

    if (body.mode && !isDisplayMode(body.mode)) {
      return NextResponse.json(
        { success: false, error: "유효하지 않은 mode입니다." },
        { status: 400 },
      )
    }

    updateDisplaySettings(
      {
        mode: body.mode as DisplayMode | undefined,
        current_scene_id: null,
        active_notice_id: body.active_notice_id,
        media_full_file_id: body.media_full_file_id,
        media_left_file_id: body.media_left_file_id,
        media_right_file_id: body.media_right_file_id,
      },
      unit.id,
    )

    return NextResponse.json({
      success: true,
      data: getDisplaySettingsView(unit.id),
    })
  } catch (error) {
    console.error("[admin/display-units/settings] PATCH failed:", error)
    const message =
      error instanceof Error ? error.message : "설정 저장에 실패했습니다."
    return NextResponse.json(
      { success: false, error: message },
      { status: 400 },
    )
  }
}
