import { NextResponse } from "next/server"
import {
  applyDisplayScene,
  getDisplaySceneById,
} from "@/lib/db/display-scenes"
import { getDisplayUnitByCode } from "@/lib/db/display-units"

export const dynamic = "force-dynamic"

type RouteContext = {
  params: Promise<{ id: string }>
}

function parseId(rawId: string): number | null {
  const id = Number(rawId)
  if (!Number.isInteger(id) || id <= 0) return null
  return id
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id: rawId } = await context.params
    const id = parseId(rawId)

    if (!id) {
      return NextResponse.json(
        { success: false, error: "유효하지 않은 id입니다." },
        { status: 400 },
      )
    }

    const body = (await request.json().catch(() => ({}))) as {
      unitCode?: string
    }

    if (body.unitCode?.trim()) {
      const unit = getDisplayUnitByCode(body.unitCode.trim())
      const scene = getDisplaySceneById(id)
      if (!unit || !scene || scene.display_unit_id !== unit.id) {
        return NextResponse.json(
          {
            success: false,
            error: "다른 전광판의 Scene은 적용할 수 없습니다.",
          },
          { status: 403 },
        )
      }
    }

    const scene = applyDisplayScene(id)

    return NextResponse.json({
      success: true,
      currentSceneId: scene.id,
    })
  } catch (error) {
    console.error("[admin/display-scenes/:id/apply] POST failed:", error)
    const message =
      error instanceof Error ? error.message : "Scene 적용에 실패했습니다."
    return NextResponse.json(
      { success: false, error: message },
      { status: 400 },
    )
  }
}
