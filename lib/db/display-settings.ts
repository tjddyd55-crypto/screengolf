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
import type { DisplaySettingsView } from "@/lib/display/types"

export type DisplaySettings = {
  id: number
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

export function getDisplaySettings(): DisplaySettings {
  const row = getDb()
    .prepare(
      `SELECT id, mode, current_scene_id, active_notice_id, media_full_file_id, media_left_file_id, media_right_file_id, updated_at
       FROM display_settings WHERE id = 1`,
    )
    .get() as DisplaySettingsRow

  return row
}

export function getDisplaySettingsView(): DisplaySettingsView {
  const settings = getDisplaySettings()
  const currentScene = settings.current_scene_id
    ? getDisplaySceneById(settings.current_scene_id)
    : null

  return {
    ...settings,
    current_scene: currentScene
      ? { id: currentScene.id, name: currentScene.name }
      : null,
    media_full_asset: loadAsset(settings.media_full_file_id),
    media_left_asset: loadAsset(settings.media_left_file_id),
    media_right_asset: loadAsset(settings.media_right_file_id),
  }
}

export function updateDisplaySettings(input: {
  mode?: DisplayMode
  current_scene_id?: number | null
  active_notice_id?: number | null
  media_full_file_id?: number | null
  media_left_file_id?: number | null
  media_right_file_id?: number | null
}): DisplaySettings {
  const current = getDisplaySettings()

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
       SET mode = ?, current_scene_id = ?, active_notice_id = ?, media_full_file_id = ?, media_left_file_id = ?, media_right_file_id = ?, updated_at = datetime('now')
       WHERE id = 1`,
    )
    .run(
      mode,
      currentSceneId,
      activeNoticeId,
      mediaFullFileId,
      mediaLeftFileId,
      mediaRightFileId,
    )

  return getDisplaySettings()
}
