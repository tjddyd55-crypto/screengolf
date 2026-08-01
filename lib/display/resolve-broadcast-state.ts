import { DISPLAY_MODE_LABELS, type DisplayMode } from "@/lib/admin/constants"
import { getDisplayAssetById } from "@/lib/db/display-assets"
import { getNoticeById } from "@/lib/db/display-notices"
import { getDisplaySettings } from "@/lib/db/display-settings"
import { getDisplaySceneById } from "@/lib/db/display-scenes"
import { getDisplayUnitById } from "@/lib/db/display-units"
import {
  evaluateBroadcastState,
  getBroadcastStatusLabel,
  type BroadcastContentProbe,
  type DisplayBroadcastState,
} from "@/lib/display/broadcast-state"

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
  return Boolean(
    left && right && !left.file_missing && !right.file_missing,
  )
}

function buildProbe(input: {
  noticeId: number | null
  mediaFullId: number | null
  mediaLeftId: number | null
  mediaRightId: number | null
}): BroadcastContentProbe {
  return {
    noticeRenderable: probeNotice(input.noticeId),
    mediaFullRenderable: probeMediaFull(input.mediaFullId),
    mediaSplitRenderable: probeMediaSplit(
      input.mediaLeftId,
      input.mediaRightId,
    ),
  }
}

/** 읽기 전용. DB write / migration을 수행하지 않는다. */
export function getUnitBroadcastState(unitId: number): DisplayBroadcastState {
  const unit = getDisplayUnitById(unitId)
  const settings = getDisplaySettings(unitId)
  const scene = settings.current_scene_id
    ? getDisplaySceneById(settings.current_scene_id)
    : null

  const sceneProbe = scene
    ? buildProbe({
        noticeId: scene.notice_id,
        mediaFullId: scene.media_full_file_id,
        mediaLeftId: scene.media_left_file_id,
        mediaRightId: scene.media_right_file_id,
      })
    : {
        noticeRenderable: false,
        mediaFullRenderable: false,
        mediaSplitRenderable: false,
      }

  const settingsProbe = buildProbe({
    noticeId: settings.active_notice_id,
    mediaFullId: settings.media_full_file_id,
    mediaLeftId: settings.media_left_file_id,
    mediaRightId: settings.media_right_file_id,
  })

  return evaluateBroadcastState({
    unitActive: unit?.is_active ?? false,
    unitId,
    mode: settings.mode,
    currentSceneId: settings.current_scene_id,
    currentScene: scene
      ? {
          id: scene.id,
          name: scene.name,
          mode: scene.mode,
          is_active: scene.is_active,
          display_unit_id: scene.display_unit_id,
          notice_id: scene.notice_id,
          media_full_file_id: scene.media_full_file_id,
          media_left_file_id: scene.media_left_file_id,
          media_right_file_id: scene.media_right_file_id,
        }
      : null,
    sceneProbe,
    settingsProbe,
  })
}

export function toAdminBroadcastFields(state: DisplayBroadcastState): {
  broadcast_status: DisplayBroadcastState["status"]
  has_renderable_content: boolean
  broadcast_reason: DisplayBroadcastState["reason"]
  broadcast_label: string
  current_scene_name: string | null
  mode_label: string | null
} {
  return {
    broadcast_status: state.status,
    has_renderable_content: state.hasRenderableContent,
    broadcast_reason: state.reason,
    broadcast_label: getBroadcastStatusLabel(state.status),
    current_scene_name: state.currentSceneName,
    mode_label: state.modeLabel,
  }
}

export function mapModeLabel(mode: DisplayMode | null): string | null {
  if (!mode) return null
  return DISPLAY_MODE_LABELS[mode] ?? mode
}
