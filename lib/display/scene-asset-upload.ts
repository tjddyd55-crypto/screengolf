import {
  MAX_DISPLAY_FILE_SIZE,
  type AssetLayoutType,
} from "@/lib/admin/constants"

export const SCENE_ASSET_ACCEPT =
  ".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"

export const SCENE_ASSET_ACCEPT_HINT =
  "JPG, JPEG, PNG, WebP, PDF · 최대 20MB"

const ALLOWED_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "webp",
  "pdf",
])

export type ClientUploadValidation =
  | { ok: true }
  | { ok: false; error: string }

export function getUploadFileExtension(fileName: string): string {
  const parts = fileName.trim().toLowerCase().split(".")
  if (parts.length < 2) return ""
  return parts[parts.length - 1] ?? ""
}

/** 클라이언트 사전 검증. 최종 검증은 서버 API가 담당한다. */
export function validateClientUploadFile(
  file: File | null | undefined,
): ClientUploadValidation {
  if (!file) {
    return { ok: false, error: "업로드 파일이 필요합니다." }
  }
  if (file.size <= 0) {
    return { ok: false, error: "파일 내용을 읽을 수 없습니다." }
  }
  if (file.size > MAX_DISPLAY_FILE_SIZE) {
    return { ok: false, error: "파일 크기는 20MB 이하여야 합니다." }
  }
  const extension = getUploadFileExtension(file.name)
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    return { ok: false, error: "지원하지 않는 파일 형식입니다." }
  }
  return { ok: true }
}

export function shouldShowSceneAssetUpload(mode: string): boolean {
  return mode === "media_full" || mode === "media_split"
}

export function layoutTypeForSceneSlot(
  slot: "full" | "left" | "right",
): AssetLayoutType {
  if (slot === "full") return "full"
  if (slot === "left") return "split_left"
  return "split_right"
}

export type UploadedDisplayAsset = {
  id: number
  title: string
  file_url: string
  fileUrl?: string
  file_type: "image" | "pdf"
  mime_type: string
  original_name?: string
  originalName?: string
  layout_type: "full" | "split_left" | "split_right"
  sizeLabel?: string | null
  file_missing?: boolean
  fileMissing?: boolean
  status?: string
}

/** 업로드 응답 asset을 목록 앞에 병합 (중복 id 제거). */
export function mergeUploadedAsset<T extends { id: number }>(
  assets: T[],
  uploaded: T,
): T[] {
  return [uploaded, ...assets.filter((asset) => asset.id !== uploaded.id)]
}

export async function uploadDisplayAssetFile(input: {
  file: File
  layoutType: AssetLayoutType
  title?: string
}): Promise<UploadedDisplayAsset> {
  const validation = validateClientUploadFile(input.file)
  if (!validation.ok) {
    throw new Error(validation.error)
  }

  const formData = new FormData()
  formData.append("file", input.file)
  formData.append("layout_type", input.layoutType)
  if (input.title?.trim()) {
    formData.append("title", input.title.trim())
  }

  const res = await fetch("/api/admin/display-assets", {
    method: "POST",
    body: formData,
  })
  const json = (await res.json()) as {
    success?: boolean
    error?: string
    asset?: UploadedDisplayAsset
  }

  if (!res.ok || !json.success || !json.asset?.id) {
    throw new Error(json.error ?? "파일 업로드에 실패했습니다.")
  }

  return json.asset
}
