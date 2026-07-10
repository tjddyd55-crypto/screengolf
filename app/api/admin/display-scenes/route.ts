import { NextResponse } from "next/server"
import { DISPLAY_MODES, type DisplayMode } from "@/lib/admin/constants"
import {
  createDisplayScene,
  listDisplayScenes,
} from "@/lib/db/display-scenes"

export const dynamic = "force-dynamic"

function isDisplayMode(value: string): value is DisplayMode {
  return DISPLAY_MODES.includes(value as DisplayMode)
}

export async function GET() {
  try {
    const data = listDisplayScenes()
    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error("[admin/display-scenes] GET failed:", error)
    return NextResponse.json(
      { success: false, error: "Scene 목록 조회에 실패했습니다." },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  try {
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
    console.error("[admin/display-scenes] POST failed:", error)
    const message =
      error instanceof Error ? error.message : "Scene 생성에 실패했습니다."
    return NextResponse.json(
      { success: false, error: message },
      { status: 400 },
    )
  }
}
