import { NextResponse } from "next/server"
import {
  ALLOWED_DISPLAY_MIMES,
  MAX_DISPLAY_FILE_SIZE,
  type AssetLayoutType,
} from "@/lib/admin/constants"
import {
  createDisplayAsset,
  listDisplayAssets,
} from "@/lib/db/display-assets"
import { saveDisplayFile } from "@/lib/storage/display-storage"

export const dynamic = "force-dynamic"

function isAllowedLayoutType(value: string): value is AssetLayoutType {
  return value === "full" || value === "split_left" || value === "split_right"
}

function resolveFileType(mimeType: string): "image" | "pdf" | null {
  if (mimeType === "application/pdf") return "pdf"
  if (mimeType.startsWith("image/")) return "image"
  return null
}

export async function GET() {
  try {
    const data = listDisplayAssets()
    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error("[admin/display-assets] GET failed:", error)
    return NextResponse.json(
      { success: false, error: "파일 목록 조회에 실패했습니다." },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get("file")
    const title = String(formData.get("title") ?? "").trim()
    const layoutType = String(formData.get("layout_type") ?? "").trim()

    if (!(file instanceof File)) {
      return NextResponse.json(
        { success: false, error: "업로드 파일이 필요합니다." },
        { status: 400 },
      )
    }

    if (!isAllowedLayoutType(layoutType)) {
      return NextResponse.json(
        { success: false, error: "layout_type이 올바르지 않습니다." },
        { status: 400 },
      )
    }

    if (
      !ALLOWED_DISPLAY_MIMES.includes(
        file.type as (typeof ALLOWED_DISPLAY_MIMES)[number],
      )
    ) {
      return NextResponse.json(
        { success: false, error: "허용되지 않은 파일 형식입니다." },
        { status: 400 },
      )
    }

    if (file.size > MAX_DISPLAY_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: "파일 크기는 20MB 이하여야 합니다." },
        { status: 400 },
      )
    }

    const fileType = resolveFileType(file.type)
    if (!fileType) {
      return NextResponse.json(
        { success: false, error: "지원하지 않는 MIME 타입입니다." },
        { status: 400 },
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const saved = await saveDisplayFile(buffer, file.name)

    const asset = createDisplayAsset({
      title: title || file.name,
      file_url: saved.fileUrl,
      file_type: fileType,
      original_name: file.name,
      mime_type: file.type,
      layout_type: layoutType,
    })

    return NextResponse.json(
      {
        success: true,
        asset: {
          id: asset.id,
          title: asset.title,
          file_url: asset.file_url,
          file_type: asset.file_type,
          mime_type: asset.mime_type,
          layout_type: asset.layout_type,
        },
      },
      { status: 201 },
    )
  } catch (error) {
    console.error("[admin/display-assets] POST failed:", error)
    return NextResponse.json(
      { success: false, error: "파일 업로드에 실패했습니다." },
      { status: 500 },
    )
  }
}
