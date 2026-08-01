import type { DisplayMode } from "@/lib/admin/constants"
import { getDisplayAssetById } from "@/lib/db/display-assets"
import { getNoticeById } from "@/lib/db/display-notices"
import {
  getDisplaySettings,
  type DisplaySettings,
} from "@/lib/db/display-settings"
import {
  applyDisplayScene,
  createDisplayScene,
  listDisplayScenes,
  type DisplayScene,
} from "@/lib/db/display-scenes"
import { getDisplayUnitById, listDisplayUnits } from "@/lib/db/display-units"
import { getDb } from "@/lib/db/sqlite"

/** 사용자에게 보이는 이관 Scene 기본 이름 (식별 키가 아님) */
export const DIRECT_MIGRATION_SCENE_NAMES: Record<DisplayMode, string> = {
  ranking: "기존 랭킹 화면",
  notice: "기존 공지 화면",
  media_full: "기존 가로 화면",
  media_split: "기존 2분할 화면",
}

let markerTableReady = false

function ensureMigrationMarkerTable(): void {
  if (markerTableReady) return
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS display_direct_scene_migrations (
      display_unit_id INTEGER PRIMARY KEY,
      source_mode TEXT NOT NULL,
      scene_id INTEGER,
      migrated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (display_unit_id) REFERENCES display_units(id)
    );
  `)
  markerTableReady = true
}

/** 테스트용: 모듈 캐시 리셋 */
export function resetDirectMigrationMarkerCacheForTests(): void {
  markerTableReady = false
}

function hasMigrationMarker(unitId: number): boolean {
  ensureMigrationMarkerTable()
  const row = getDb()
    .prepare(
      `SELECT display_unit_id FROM display_direct_scene_migrations
       WHERE display_unit_id = ?`,
    )
    .get(unitId) as { display_unit_id: number } | undefined
  return Boolean(row)
}

function writeMigrationMarker(
  unitId: number,
  mode: DisplayMode,
  sceneId: number,
): void {
  ensureMigrationMarkerTable()
  getDb()
    .prepare(
      `INSERT INTO display_direct_scene_migrations
         (display_unit_id, source_mode, scene_id, migrated_at)
       VALUES (?, ?, ?, datetime('now'))
       ON CONFLICT(display_unit_id) DO UPDATE SET
         source_mode = excluded.source_mode,
         scene_id = excluded.scene_id,
         migrated_at = excluded.migrated_at`,
    )
    .run(unitId, mode, sceneId)
}

function probeNotice(noticeId: number | null): boolean {
  if (!noticeId) return false
  const notice = getNoticeById(noticeId)
  return Boolean(notice && notice.is_active)
}

function probeMediaFull(fileId: number | null): boolean {
  if (!fileId) return false
  const asset = getDisplayAssetById(fileId)
  return Boolean(asset && !asset.file_missing)
}

function probeMediaSplit(
  leftId: number | null,
  rightId: number | null,
): boolean {
  if (!leftId || !rightId) return false
  const left = getDisplayAssetById(leftId)
  const right = getDisplayAssetById(rightId)
  return Boolean(left && right && !left.file_missing && !right.file_missing)
}

/**
 * current_scene_id 없는 settings가 Scene으로 이관할 만큼 유효한지.
 */
export function isMigratableDirectSettings(settings: DisplaySettings): boolean {
  if (settings.current_scene_id != null) return false

  if (settings.mode === "ranking") return true
  if (settings.mode === "notice") {
    return probeNotice(settings.active_notice_id)
  }
  if (settings.mode === "media_full") {
    return probeMediaFull(settings.media_full_file_id)
  }
  if (settings.mode === "media_split") {
    return probeMediaSplit(
      settings.media_left_file_id,
      settings.media_right_file_id,
    )
  }
  return false
}

/** Unit + mode + 콘텐츠 ID 일치로 재사용 후보를 찾는다 (이름만으로 판정하지 않음). */
export function findSceneMatchingDirectSettings(
  unitId: number,
  settings: DisplaySettings,
): DisplayScene | null {
  const scenes = listDisplayScenes(unitId).filter((scene) => scene.is_active)
  const match = scenes.find(
    (scene) =>
      scene.mode === settings.mode &&
      scene.notice_id === settings.active_notice_id &&
      scene.media_full_file_id === settings.media_full_file_id &&
      scene.media_left_file_id === settings.media_left_file_id &&
      scene.media_right_file_id === settings.media_right_file_id,
  )
  return match ?? null
}

/**
 * 유효 direct mode를 Scene으로 이관하고 current_scene_id에 연결한다.
 * - 이미 current_scene_id가 있으면 no-op
 * - Unit에 이관 marker가 있으면 no-op (해제 후 startup 재적용 방지)
 * - 콘텐츠 무효면 no-op (WAITING 유지)
 * - 동일 콘텐츠 Scene이 있으면 재사용 (이름만 같다고 재사용하지 않음)
 * @returns 이관으로 Scene을 적용했으면 true
 */
export function migrateDirectModeToSceneIfNeeded(unitId: number): boolean {
  const unit = getDisplayUnitById(unitId)
  if (!unit || !unit.is_active) return false

  const settings = getDisplaySettings(unitId)
  if (settings.current_scene_id != null) return false
  if (hasMigrationMarker(unitId)) return false
  if (!isMigratableDirectSettings(settings)) return false

  const existing = findSceneMatchingDirectSettings(unitId, settings)
  const scene =
    existing ??
    createDisplayScene({
      display_unit_id: unitId,
      name: DIRECT_MIGRATION_SCENE_NAMES[settings.mode],
      mode: settings.mode,
      notice_id: settings.active_notice_id,
      media_full_file_id: settings.media_full_file_id,
      media_left_file_id: settings.media_left_file_id,
      media_right_file_id: settings.media_right_file_id,
      is_active: true,
    })

  applyDisplayScene(scene.id)
  writeMigrationMarker(unitId, settings.mode, scene.id)
  return true
}

/**
 * 모든 활성 Unit에 대해 1회 idempotent direct→Scene 이관.
 * startup에서만 호출한다. 상태 조회 경로에서 호출하지 않는다.
 * @returns 이관이 수행된 Unit 수
 */
export function migrateAllDirectModesToScenes(): number {
  ensureMigrationMarkerTable()
  let migrated = 0
  for (const unit of listDisplayUnits({ activeOnly: true })) {
    if (migrateDirectModeToSceneIfNeeded(unit.id)) {
      migrated += 1
    }
  }
  return migrated
}
