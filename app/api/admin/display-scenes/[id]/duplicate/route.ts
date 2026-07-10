import { NextResponse } from "next/server"
import { duplicateDisplayScene } from "@/lib/db/display-scenes"

export const dynamic = "force-dynamic"

type RouteContext = {
  params: Promise<{ id: string }>
}

function parseId(rawId: string): number | null {
  const id = Number(rawId)
  if (!Number.isInteger(id) || id <= 0) return null
  return id
}

export async function POST(_request: Request, context: RouteContext) {
  try {
    const { id: rawId } = await context.params
    const id = parseId(rawId)

    if (!id) {
      return NextResponse.json(
        { success: false, error: "유효하지 않은 id입니다." },
        { status: 400 },
      )
    }

    const scene = duplicateDisplayScene(id)
    if (!scene) {
      return NextResponse.json(
        { success: false, error: "Scene을 찾을 수 없습니다." },
        { status: 404 },
      )
    }

    return NextResponse.json({ success: true, data: scene }, { status: 201 })
  } catch (error) {
    console.error("[admin/display-scenes/:id/duplicate] POST failed:", error)
    const message =
      error instanceof Error ? error.message : "Scene 복제에 실패했습니다."
    return NextResponse.json(
      { success: false, error: message },
      { status: 400 },
    )
  }
}
