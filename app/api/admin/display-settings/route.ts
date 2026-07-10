import { NextResponse } from "next/server"
import { DISPLAY_MODES, type DisplayMode } from "@/lib/admin/constants"
import {
  getDisplaySettingsView,
  updateDisplaySettings,
} from "@/lib/db/display-settings"

export const dynamic = "force-dynamic"

function isDisplayMode(value: string): value is DisplayMode {
  return DISPLAY_MODES.includes(value as DisplayMode)
}

export async function GET() {
  try {
    const data = getDisplaySettingsView()
    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error("[admin/display-settings] GET failed:", error)
    return NextResponse.json(
      { success: false, error: "설정 조회에 실패했습니다." },
      { status: 500 },
    )
  }
}

export async function PATCH(request: Request) {
  try {
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

    updateDisplaySettings({
      mode: body.mode as DisplayMode | undefined,
      current_scene_id: null,
      active_notice_id: body.active_notice_id,
      media_full_file_id: body.media_full_file_id,
      media_left_file_id: body.media_left_file_id,
      media_right_file_id: body.media_right_file_id,
    })

    return NextResponse.json({
      success: true,
      data: getDisplaySettingsView(),
    })
  } catch (error) {
    console.error("[admin/display-settings] PATCH failed:", error)
    const message =
      error instanceof Error ? error.message : "설정 저장에 실패했습니다."
    return NextResponse.json(
      { success: false, error: message },
      { status: 400 },
    )
  }
}
