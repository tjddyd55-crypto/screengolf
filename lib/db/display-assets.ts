import { getDb } from "./sqlite"
import type { AssetFileType, AssetLayoutType } from "@/lib/admin/constants"

export type DisplayAsset = {
  id: number
  title: string
  file_url: string
  file_type: AssetFileType
  original_name: string
  mime_type: string
  layout_type: AssetLayoutType
  created_at: string
  updated_at: string
}

type AssetRow = DisplayAsset

export function listDisplayAssets(): DisplayAsset[] {
  return getDb()
    .prepare(
      `SELECT id, title, file_url, file_type, original_name, mime_type, layout_type, created_at, updated_at
       FROM display_assets
       ORDER BY created_at DESC`,
    )
    .all() as AssetRow[]
}

export function getDisplayAssetById(id: number): DisplayAsset | null {
  const row = getDb()
    .prepare(
      `SELECT id, title, file_url, file_type, original_name, mime_type, layout_type, created_at, updated_at
       FROM display_assets WHERE id = ?`,
    )
    .get(id) as AssetRow | undefined

  return row ?? null
}

export function createDisplayAsset(input: {
  title: string
  file_url: string
  file_type: AssetFileType
  original_name: string
  mime_type: string
  layout_type: AssetLayoutType
}): DisplayAsset {
  const result = getDb()
    .prepare(
      `INSERT INTO display_assets (
        title, file_url, file_type, original_name, mime_type, layout_type
      ) VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.title,
      input.file_url,
      input.file_type,
      input.original_name,
      input.mime_type,
      input.layout_type,
    )

  const asset = getDisplayAssetById(Number(result.lastInsertRowid))
  if (!asset) throw new Error("파일 등록 후 조회에 실패했습니다.")
  return asset
}

export function deleteDisplayAsset(id: number): DisplayAsset | null {
  const asset = getDisplayAssetById(id)
  if (!asset) return null

  getDb().prepare("DELETE FROM display_assets WHERE id = ?").run(id)

  getDb()
    .prepare(
      `UPDATE display_settings
       SET media_full_file_id = CASE WHEN media_full_file_id = ? THEN NULL ELSE media_full_file_id END,
           media_left_file_id = CASE WHEN media_left_file_id = ? THEN NULL ELSE media_left_file_id END,
           media_right_file_id = CASE WHEN media_right_file_id = ? THEN NULL ELSE media_right_file_id END,
           updated_at = datetime('now')
       WHERE id = 1`,
    )
    .run(id, id, id)

  return asset
}

export function toPublicMedia(asset: DisplayAsset) {
  return {
    fileUrl: asset.file_url,
    fileType: asset.file_type,
    mimeType: asset.mime_type,
  }
}
