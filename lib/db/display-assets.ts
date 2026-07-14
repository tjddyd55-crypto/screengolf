import path from "path"
import { getDb } from "./sqlite"
import type { AssetFileType, AssetLayoutType } from "@/lib/admin/constants"
import {
  buildPublicAssetUrl,
  fileExists,
  migrateLegacyFileIfPresent,
} from "@/lib/storage/display-storage"

export type DisplayAsset = {
  id: number
  title: string
  file_url: string
  file_type: AssetFileType
  original_name: string
  mime_type: string
  layout_type: AssetLayoutType
  stored_name: string | null
  size_bytes: number | null
  created_at: string
  updated_at: string
  file_missing?: boolean
}

type AssetRow = {
  id: number
  title: string
  file_url: string
  file_type: AssetFileType
  original_name: string
  mime_type: string
  layout_type: AssetLayoutType
  stored_name: string | null
  size_bytes: number | null
  created_at: string
  updated_at: string
}

let schemaReady = false

function ensureDisplayAssetColumns(): void {
  if (schemaReady) return

  const db = getDb()
  const columns = db
    .prepare("PRAGMA table_info(display_assets)")
    .all() as Array<{ name: string }>
  const names = new Set(columns.map((column) => column.name))

  if (!names.has("stored_name")) {
    db.exec(
      "ALTER TABLE display_assets ADD COLUMN stored_name TEXT",
    )
  }
  if (!names.has("size_bytes")) {
    db.exec(
      "ALTER TABLE display_assets ADD COLUMN size_bytes INTEGER",
    )
  }

  schemaReady = true
}

function mapAsset(row: AssetRow): DisplayAsset {
  const publicUrl = buildPublicAssetUrl(row.id, row.updated_at)
  const storedName =
    row.stored_name ||
    (row.file_url.startsWith("/uploads/display/")
      ? path.basename(row.file_url)
      : null)

  const missing = storedName ? !fileExists(storedName) : true

  return {
    id: row.id,
    title: row.title,
    file_url: publicUrl,
    file_type: row.file_type,
    original_name: row.original_name,
    mime_type: row.mime_type,
    layout_type: row.layout_type,
    stored_name: storedName,
    size_bytes: row.size_bytes,
    created_at: row.created_at,
    updated_at: row.updated_at,
    file_missing: missing,
  }
}

function getRawAssetById(id: number): AssetRow | null {
  ensureDisplayAssetColumns()
  const row = getDb()
    .prepare(
      `SELECT id, title, file_url, file_type, original_name, mime_type, layout_type,
              stored_name, size_bytes, created_at, updated_at
       FROM display_assets WHERE id = ?`,
    )
    .get(id) as AssetRow | undefined

  return row ?? null
}

export function listDisplayAssets(): DisplayAsset[] {
  ensureDisplayAssetColumns()
  migrateLegacyDisplayAssets()

  const rows = getDb()
    .prepare(
      `SELECT id, title, file_url, file_type, original_name, mime_type, layout_type,
              stored_name, size_bytes, created_at, updated_at
       FROM display_assets
       ORDER BY created_at DESC`,
    )
    .all() as AssetRow[]

  return rows.map(mapAsset)
}

export function getDisplayAssetById(id: number): DisplayAsset | null {
  ensureDisplayAssetColumns()
  migrateLegacyDisplayAsset(id)
  const row = getRawAssetById(id)
  return row ? mapAsset(row) : null
}

export function getDisplayAssetStorageMeta(id: number): {
  id: number
  storedName: string | null
  mimeType: string
  originalName: string
  title: string
  fileType: AssetFileType
  updatedAt: string
} | null {
  ensureDisplayAssetColumns()
  migrateLegacyDisplayAsset(id)
  const row = getRawAssetById(id)
  if (!row) return null

  return {
    id: row.id,
    storedName:
      row.stored_name ||
      (row.file_url.startsWith("/uploads/display/")
        ? path.basename(row.file_url)
        : null),
    mimeType: row.mime_type,
    originalName: row.original_name,
    title: row.title,
    fileType: row.file_type,
    updatedAt: row.updated_at,
  }
}

export function createDisplayAsset(input: {
  title: string
  file_type: AssetFileType
  original_name: string
  mime_type: string
  layout_type: AssetLayoutType
  stored_name: string
  size_bytes: number
}): DisplayAsset {
  ensureDisplayAssetColumns()
  const db = getDb()

  const result = db
    .prepare(
      `INSERT INTO display_assets (
        title, file_url, file_type, original_name, mime_type, layout_type,
        stored_name, size_bytes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.title,
      "pending",
      input.file_type,
      input.original_name,
      input.mime_type,
      input.layout_type,
      input.stored_name,
      input.size_bytes,
    )

  const id = Number(result.lastInsertRowid)
  const fileUrl = buildPublicAssetUrl(id)

  db.prepare(
    `UPDATE display_assets
     SET file_url = ?, updated_at = datetime('now')
     WHERE id = ?`,
  ).run(fileUrl, id)

  const asset = getDisplayAssetById(id)
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
    id: asset.id,
    title: asset.title,
    originalName: asset.original_name,
    fileUrl: asset.file_url,
    fileType: asset.file_type,
    mimeType: asset.mime_type,
    fileMissing: Boolean(asset.file_missing),
  }
}

function migrateLegacyDisplayAsset(id: number): void {
  const row = getRawAssetById(id)
  if (!row) return
  migrateLegacyRow(row)
}

function migrateLegacyDisplayAssets(): void {
  ensureDisplayAssetColumns()
  const rows = getDb()
    .prepare(
      `SELECT id, title, file_url, file_type, original_name, mime_type, layout_type,
              stored_name, size_bytes, created_at, updated_at
       FROM display_assets
       WHERE file_url LIKE '/uploads/display/%' OR file_url = 'pending'`,
    )
    .all() as AssetRow[]

  for (const row of rows) {
    migrateLegacyRow(row)
  }
}

function migrateLegacyRow(row: AssetRow): void {
  try {
    if (row.file_url.startsWith("/uploads/display/")) {
      const migrated = migrateLegacyFileIfPresent(row.file_url, row.stored_name)
      const storedName = migrated?.storedName ?? path.basename(row.file_url)
      const fileUrl = buildPublicAssetUrl(row.id, row.updated_at)

      getDb()
        .prepare(
          `UPDATE display_assets
           SET stored_name = COALESCE(stored_name, ?),
               file_url = ?,
               updated_at = datetime('now')
           WHERE id = ?`,
        )
        .run(storedName, fileUrl, row.id)

      if (migrated) {
        console.log(
          `[display-assets] legacy migrated assetId=${row.id}`,
        )
      } else {
        console.warn(
          `[display-assets] legacy file missing assetId=${row.id}`,
        )
      }
      return
    }

    if (row.file_url === "pending") {
      const fileUrl = buildPublicAssetUrl(row.id, row.updated_at)
      getDb()
        .prepare(
          `UPDATE display_assets SET file_url = ?, updated_at = datetime('now') WHERE id = ?`,
        )
        .run(fileUrl, row.id)
    }
  } catch (error) {
    console.warn(`[display-assets] migration failed assetId=${row.id}:`, error)
  }
}

export function logDisplayAssetDiagnostics(assetId: number): void {
  const meta = getDisplayAssetStorageMeta(assetId)
  if (!meta) {
    console.warn(`[display-assets] assetId=${assetId} not found`)
    return
  }

  const exists = meta.storedName ? fileExists(meta.storedName) : false
  console.log(
    `[display-assets] assetId=${meta.id} fileUrl=${buildPublicAssetUrl(meta.id, meta.updatedAt)} exists=${exists} mime=${meta.mimeType}`,
  )
}
