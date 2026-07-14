import { NextResponse } from "next/server"
import {
  MAX_DISPLAY_FILE_SIZE,
  type AssetLayoutType,
} from "@/lib/admin/constants"
import {
  createDisplayAsset,
  listDisplayAssets,
} from "@/lib/db/display-assets"
import { saveDisplayFile, deleteStoredFile } from "@/lib/storage/display-storage"
import {
  buildUploadDiagnostic,
  detectFileSignature,
  validateUploadBuffer,
} from "@/lib/storage/file-signature"

export const dynamic = "force-dynamic"

function isAllowedLayoutType(value: string): value is AssetLayoutType {
  return value === "full" || value === "split_left" || value === "split_right"
}

function formatBytes(size: number | null | undefined): string | null {
  if (size == null) return null
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

function toAdminAsset(asset: ReturnType<typeof listDisplayAssets>[number]) {
  return {
    id: asset.id,
    title: asset.title,
    originalName: asset.original_name,
    fileUrl: asset.file_url,
    fileType: asset.file_type,
    mimeType: asset.mime_type,
    layoutType: asset.layout_type,
    sizeBytes: asset.size_bytes,
    sizeLabel: formatBytes(asset.size_bytes),
    createdAt: asset.created_at,
    updatedAt: asset.updated_at,
    fileMissing: Boolean(asset.file_missing),
    status: asset.file_missing ? "missing" : "ok",
    // 하위 호환 snake_case
    original_name: asset.original_name,
    file_url: asset.file_url,
    file_type: asset.file_type,
    mime_type: asset.mime_type,
    layout_type: asset.layout_type,
    size_bytes: asset.size_bytes,
    created_at: asset.created_at,
    file_missing: Boolean(asset.file_missing),
  }
}

function isFileLike(value: FormDataEntryValue | null): value is File {
  return (
    typeof value === "object" &&
    value !== null &&
    "arrayBuffer" in value &&
    "name" in value &&
    "size" in value &&
    typeof (value as File).arrayBuffer === "function"
  )
}

export async function GET() {
  try {
    const data = listDisplayAssets().map(toAdminAsset)
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
  let storedName: string | null = null

  try {
    const formData = await request.formData()
    const fileEntry = formData.get("file")
    const title = String(formData.get("title") ?? "").trim()
    const layoutType = String(formData.get("layout_type") ?? "").trim()

    if (!isFileLike(fileEntry)) {
      return NextResponse.json(
        { success: false, error: "업로드 파일이 필요합니다." },
        { status: 400 },
      )
    }

    const file = fileEntry

    if (!isAllowedLayoutType(layoutType)) {
      return NextResponse.json(
        { success: false, error: "layout_type이 올바르지 않습니다." },
        { status: 400 },
      )
    }

    if (file.size <= 0) {
      return NextResponse.json(
        { success: false, error: "파일 내용을 읽을 수 없습니다." },
        { status: 400 },
      )
    }

    if (file.size > MAX_DISPLAY_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: "파일 크기는 20MB 이하여야 합니다." },
        { status: 400 },
      )
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    if (buffer.length === 0) {
      return NextResponse.json(
        { success: false, error: "파일 내용을 읽을 수 없습니다." },
        { status: 400 },
      )
    }

    if (buffer.length !== file.size) {
      console.warn(
        `[display-upload] size mismatch file.size=${file.size} buffer.length=${buffer.length}`,
      )
    }

    const detectedPreview = detectFileSignature(buffer)
    const validation = validateUploadBuffer(buffer, file.name, file.type)

    console.log(
      "[display-upload]",
      buildUploadDiagnostic({
        originalName: file.name,
        browserMimeType: file.type,
        buffer,
        detected: validation.ok ? validation.detected : detectedPreview,
        allowed: validation.ok,
        reason: validation.ok ? undefined : validation.reason,
      }),
    )

    if (!validation.ok) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 },
      )
    }

    const saved = await saveDisplayFile(buffer, validation.detected.extension)
    storedName = saved.storedName

    const asset = createDisplayAsset({
      title: title || file.name,
      file_type: validation.detected.fileType,
      original_name: file.name,
      mime_type: validation.detected.mimeType,
      layout_type: layoutType,
      stored_name: saved.storedName,
      size_bytes: saved.sizeBytes,
    })

    console.log(
      `[display-assets] uploaded assetId=${asset.id} size=${saved.sizeBytes} mime=${validation.detected.mimeType}`,
    )

    return NextResponse.json(
      {
        success: true,
        asset: toAdminAsset(asset),
      },
      { status: 201 },
    )
  } catch (error) {
    if (storedName) {
      await deleteStoredFile(storedName)
    }
    console.error("[admin/display-assets] POST failed:", error)
    return NextResponse.json(
      { success: false, error: "파일 업로드에 실패했습니다." },
      { status: 500 },
    )
  }
}
