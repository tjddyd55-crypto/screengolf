import { getDb } from "./sqlite"
import {
  DISPLAY_MODES,
  type DisplayMode,
} from "@/lib/admin/constants"
import {
  getDisplayAssetById,
  type DisplayAsset,
} from "./display-assets"
import { getDisplaySceneById } from "./display-scenes"
import {
  DEFAULT_DISPLAY_UNIT_CODE,
  getDisplayUnitByCode,
  getDisplayUnitById,
  resolveUnitId,
} from "./display-units"
import type { DisplaySettingsView } from "@/lib/display/types"

export type DisplaySettings = {
  id: number
  display_unit_id: number
  mode: DisplayMode
  current_scene_id: number | null
  active_notice_id: number | null
  media_full_file_id: number | null
  media_left_file_id: number | null
  media_right_file_id: number | null
  updated_at: string
}

type DisplaySettingsRow = DisplaySettings

function isDisplayMode(value: string): value is DisplayMode {
  return DISPLAY_MODES.includes(value as DisplayMode)
}

function loadAsset(id: number | null): DisplayAsset | null {
  if (!id) return null
  return getDisplayAssetById(id)
}

function selectSettingsByUnitId(unitId: number): DisplaySettings {
  const row = getDb()
    .prepare(
      `SELECT id, display_unit_id, mode, current_scene_id, active_notice_id,
              media_full_file_id, media_left_file_id, media_right_file_id,
              updated_at
       FROM display_settings WHERE display_unit_id = ?`,
    )
    .get(unitId) as DisplaySettingsRow | undefined

  if (!row) {
    throw new Error("전광판 설정을 찾을 수 없습니다.")
  }

  return row
}

/** Unit1(alias). unitId 생략 시 display-1 */
export function getDisplaySettings(unitId?: number): DisplaySettings {
  const resolvedUnitId =
    unitId ?? resolveUnitId(DEFAULT_DISPLAY_UNIT_CODE)
  return selectSettingsByUnitId(resolvedUnitId)
}

export function getDisplaySettingsByUnitCode(unitCode: string): DisplaySettings {
  const unit = getDisplayUnitByCode(unitCode)
  if (!unit) {
    throw new Error("전광판을 찾을 수 없습니다.")
  }
  return selectSettingsByUnitId(unit.id)
}

export function getDisplaySettingsView(
  unitIdOrCode?: number | string,
): DisplaySettingsView {
  const unitId =
    typeof unitIdOrCode === "string"
      ? resolveUnitId(unitIdOrCode)
      : unitIdOrCode !== undefined
        ? unitIdOrCode
        : resolveUnitId(DEFAULT_DISPLAY_UNIT_CODE)

  const settings = getDisplaySettings(unitId)
  const currentScene = settings.current_scene_id
    ? getDisplaySceneById(settings.current_scene_id)
    : null

  const unit = getDisplayUnitById(settings.display_unit_id)

  return {
    ...settings,
    unit_code: unit?.code ?? null,
    unit_name: unit?.name ?? null,
    current_scene: currentScene
      ? { id: currentScene.id, name: currentScene.name }
      : null,
    media_full_asset: loadAsset(settings.media_full_file_id),
    media_left_asset: loadAsset(settings.media_left_file_id),
    media_right_asset: loadAsset(settings.media_right_file_id),
  }
}

export function updateDisplaySettings(
  input: {
    mode?: DisplayMode
    current_scene_id?: number | null
    active_notice_id?: number | null
    media_full_file_id?: number | null
    media_left_file_id?: number | null
    media_right_file_id?: number | null
  },
  unitId?: number,
): DisplaySettings {
  const resolvedUnitId =
    unitId ?? resolveUnitId(DEFAULT_DISPLAY_UNIT_CODE)
  const current = getDisplaySettings(resolvedUnitId)

  if (input.mode && !isDisplayMode(input.mode)) {
    throw new Error("유효하지 않은 display mode입니다.")
  }

  const mode = input.mode ?? current.mode
  const currentSceneId =
    input.current_scene_id !== undefined
      ? input.current_scene_id
      : current.current_scene_id
  const activeNoticeId =
    input.active_notice_id !== undefined
      ? input.active_notice_id
      : current.active_notice_id
  const mediaFullFileId =
    input.media_full_file_id !== undefined
      ? input.media_full_file_id
      : current.media_full_file_id
  const mediaLeftFileId =
    input.media_left_file_id !== undefined
      ? input.media_left_file_id
      : current.media_left_file_id
  const mediaRightFileId =
    input.media_right_file_id !== undefined
      ? input.media_right_file_id
      : current.media_right_file_id

  if (mode === "media_full" && !mediaFullFileId) {
    throw new Error("가로 전체 화면 모드에는 파일이 필요합니다.")
  }

  if (mode === "media_split" && (!mediaLeftFileId || !mediaRightFileId)) {
    throw new Error("세로 2분할 화면 모드에는 왼쪽/오른쪽 파일이 모두 필요합니다.")
  }

  if (mediaFullFileId && !getDisplayAssetById(mediaFullFileId)) {
    throw new Error("전체 화면 파일을 찾을 수 없습니다.")
  }

  if (mediaLeftFileId && !getDisplayAssetById(mediaLeftFileId)) {
    throw new Error("왼쪽 파일을 찾을 수 없습니다.")
  }

  if (mediaRightFileId && !getDisplayAssetById(mediaRightFileId)) {
    throw new Error("오른쪽 파일을 찾을 수 없습니다.")
  }

  getDb()
    .prepare(
      `UPDATE display_settings
       SET mode = ?, current_scene_id = ?, active_notice_id = ?,
           media_full_file_id = ?, media_left_file_id = ?, media_right_file_id = ?,
           updated_at = datetime('now')
       WHERE display_unit_id = ?`,
    )
    .run(
      mode,
      currentSceneId,
      activeNoticeId,
      mediaFullFileId,
      mediaLeftFileId,
      mediaRightFileId,
      resolvedUnitId,
    )

  return getDisplaySettings(resolvedUnitId)
}

/**
 * 현재 적용 Scene 참조를 해제한다.
 * - current_scene_id / media / notice 참조만 비운다.
 * - mode는 유지한다. 단 ranking은 콘텐츠 없이 BROADCASTING이 되므로
 *   스키마상 빈 상태(notice + 대상 없음)로만 정규화한다.
 *   (notice 송출이 아니라 WAITING을 위한 빈 상태)
 */
export function clearCurrentAppliedScene(unitId: number): void {
  const current = getDisplaySettings(unitId)
  const nextMode = current.mode === "ranking" ? "notice" : current.mode

  getDb()
    .prepare(
      `UPDATE display_settings
       SET current_scene_id = NULL,
           active_notice_id = NULL,
           media_full_file_id = NULL,
           media_left_file_id = NULL,
           media_right_file_id = NULL,
           mode = ?,
           updated_at = datetime('now')
       WHERE display_unit_id = ?`,
    )
    .run(nextMode, unitId)
}
