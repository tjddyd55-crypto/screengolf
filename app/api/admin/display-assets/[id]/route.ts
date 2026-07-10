import { NextResponse } from "next/server"
import { deleteDisplayAsset } from "@/lib/db/display-assets"
import { deleteDisplayFile } from "@/lib/storage/display-storage"

export const dynamic = "force-dynamic"

type RouteContext = {
  params: Promise<{ id: string }>
}

function parseId(rawId: string): number | null {
  const id = Number(rawId)
  if (!Number.isInteger(id) || id <= 0) return null
  return id
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

    const deleted = deleteDisplayAsset(id)
    if (!deleted) {
      return NextResponse.json(
        { success: false, error: "파일을 찾을 수 없습니다." },
        { status: 404 },
      )
    }

    await deleteDisplayFile(deleted.file_url)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[admin/display-assets/:id] DELETE failed:", error)
    return NextResponse.json(
      { success: false, error: "파일 삭제에 실패했습니다." },
      { status: 500 },
    )
  }
}
