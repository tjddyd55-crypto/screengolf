import { NextResponse } from "next/server"
import { DISPLAY_MODES, type DisplayMode } from "@/lib/admin/constants"
import {
  createDisplayScene,
  listDisplayScenes,
} from "@/lib/db/display-scenes"
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
      data: listDisplayScenes(unit.id),
    })
  } catch (error) {
    console.error("[admin/display-units/scenes] GET failed:", error)
    return NextResponse.json(
      { success: false, error: "Scene 목록 조회에 실패했습니다." },
      { status: 500 },
    )
  }
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

    const body = (await request.json()) as {
      name?: string
      mode?: string
      notice_id?: number | null
      media_full_file_id?: number | null
      media_left_file_id?: number | null
      media_right_file_id?: number | null
      sort_order?: number
      is_active?: boolean
    }

    const name = body.name?.trim()
    if (!name) {
      return NextResponse.json(
        { success: false, error: "Scene 이름은 필수입니다." },
        { status: 400 },
      )
    }

    if (!body.mode || !isDisplayMode(body.mode)) {
      return NextResponse.json(
        { success: false, error: "유효하지 않은 mode입니다." },
        { status: 400 },
      )
    }

    const scene = createDisplayScene({
      display_unit_id: unit.id,
      name,
      mode: body.mode,
      notice_id: body.notice_id ?? null,
      media_full_file_id: body.media_full_file_id ?? null,
      media_left_file_id: body.media_left_file_id ?? null,
      media_right_file_id: body.media_right_file_id ?? null,
      sort_order: body.sort_order,
      is_active: body.is_active ?? true,
    })

    return NextResponse.json({ success: true, data: scene }, { status: 201 })
  } catch (error) {
    console.error("[admin/display-units/scenes] POST failed:", error)
    const message =
      error instanceof Error ? error.message : "Scene 생성에 실패했습니다."
    return NextResponse.json(
      { success: false, error: message },
      { status: 400 },
    )
  }
}
