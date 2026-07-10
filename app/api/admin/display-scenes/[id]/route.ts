import { NextResponse } from "next/server"
import { DISPLAY_MODES, type DisplayMode } from "@/lib/admin/constants"
import {
  deactivateDisplayScene,
  getDisplaySceneById,
  updateDisplayScene,
} from "@/lib/db/display-scenes"

export const dynamic = "force-dynamic"

type RouteContext = {
  params: Promise<{ id: string }>
}

function parseId(rawId: string): number | null {
  const id = Number(rawId)
  if (!Number.isInteger(id) || id <= 0) return null
  return id
}

function isDisplayMode(value: string): value is DisplayMode {
  return DISPLAY_MODES.includes(value as DisplayMode)
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id: rawId } = await context.params
    const id = parseId(rawId)

    if (!id) {
      return NextResponse.json(
        { success: false, error: "유효하지 않은 id입니다." },
        { status: 400 },
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

    if (body.mode && !isDisplayMode(body.mode)) {
      return NextResponse.json(
        { success: false, error: "유효하지 않은 mode입니다." },
        { status: 400 },
      )
    }

    const scene = updateDisplayScene(id, {
      name: body.name?.trim(),
      mode: body.mode as DisplayMode | undefined,
      notice_id: body.notice_id,
      media_full_file_id: body.media_full_file_id,
      media_left_file_id: body.media_left_file_id,
      media_right_file_id: body.media_right_file_id,
      sort_order: body.sort_order,
      is_active: body.is_active,
    })

    if (!scene) {
      return NextResponse.json(
        { success: false, error: "Scene을 찾을 수 없습니다." },
        { status: 404 },
      )
    }

    return NextResponse.json({ success: true, data: scene })
  } catch (error) {
    console.error("[admin/display-scenes/:id] PATCH failed:", error)
    const message =
      error instanceof Error ? error.message : "Scene 수정에 실패했습니다."
    return NextResponse.json(
      { success: false, error: message },
      { status: 400 },
    )
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id: rawId } = await context.params
    const id = parseId(rawId)

    if (!id) {
      return NextResponse.json(
        { success: false, error: "유효하지 않은 id입니다." },
        { status: 400 },
      )
    }

    if (!getDisplaySceneById(id)) {
      return NextResponse.json(
        { success: false, error: "Scene을 찾을 수 없습니다." },
        { status: 404 },
      )
    }

    deactivateDisplayScene(id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[admin/display-scenes/:id] DELETE failed:", error)
    const message =
      error instanceof Error ? error.message : "Scene 비활성 처리에 실패했습니다."
    return NextResponse.json(
      { success: false, error: message },
      { status: 400 },
    )
  }
}
