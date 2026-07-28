import type { DisplayMode } from "@/lib/admin/constants"
import { getDisplayAssetById, toPublicMedia } from "@/lib/db/display-assets"
import { getNoticeById } from "@/lib/db/display-notices"
import {
  clearCurrentAppliedScene,
  getDisplaySettings,
} from "@/lib/db/display-settings"
import { getDisplaySceneById } from "@/lib/db/display-scenes"
import {
  DEFAULT_DISPLAY_UNIT_CODE,
  getDisplayUnitByCode,
} from "@/lib/db/display-units"
import { getUnitBroadcastState } from "@/lib/display/resolve-broadcast-state"
import type { DisplaySceneRef, DisplayStatePayload } from "@/lib/display/types"

export type DisplaySource = {
  mode: DisplayMode
  notice_id: number | null
  media_full_file_id: number | null
  media_left_file_id: number | null
  media_right_file_id: number | null
  scene?: DisplaySceneRef
}

function buildRankingState(scene?: DisplaySceneRef): DisplayStatePayload {
  return {
    mode: "ranking",
    scene,
    broadcastStatus: "BROADCASTING",
    hasRenderableContent: true,
  }
}

function buildWaitingState(): DisplayStatePayload {
  return {
    mode: "off",
    broadcastStatus: "WAITING",
    hasRenderableContent: false,
    scene: null,
  }
}

function resolveFromSource(source: DisplaySource): DisplayStatePayload | null {
  const scene = source.scene

  if (source.mode === "notice" && source.notice_id) {
    const notice = getNoticeById(source.notice_id)
    if (notice && notice.is_active) {
      return {
        mode: "notice",
        scene,
        notice: {
          id: notice.id,
          title: notice.title,
          body: notice.body,
          theme: notice.theme,
        },
        broadcastStatus: "BROADCASTING",
        hasRenderableContent: true,
      }
    }
    return null
  }

  if (source.mode === "media_full" && source.media_full_file_id) {
    const asset = getDisplayAssetById(source.media_full_file_id)
    if (asset && !asset.file_missing) {
      return {
        mode: "media_full",
        scene,
        media: toPublicMedia(asset),
        broadcastStatus: "BROADCASTING",
        hasRenderableContent: true,
      }
    }
    return null
  }

  if (
    source.mode === "media_split" &&
    source.media_left_file_id &&
    source.media_right_file_id
  ) {
    const left = getDisplayAssetById(source.media_left_file_id)
    const right = getDisplayAssetById(source.media_right_file_id)
    if (left && right && !left.file_missing && !right.file_missing) {
      return {
        mode: "media_split",
        scene,
        left: toPublicMedia(left),
        right: toPublicMedia(right),
        broadcastStatus: "BROADCASTING",
        hasRenderableContent: true,
      }
    }
    return null
  }

  if (source.mode === "ranking") {
    return buildRankingState(scene)
  }

  return null
}

function healInvalidCurrentScene(unitId: number, currentSceneId: number): void {
  const scene = getDisplaySceneById(currentSceneId)
  if (!scene || !scene.is_active || scene.display_unit_id !== unitId) {
    clearCurrentAppliedScene(unitId)
  }
}

/** unitCode 생략 시 display-1 (기존 /api/display-state 호환) */
export function resolveDisplayState(unitCode?: string): DisplayStatePayload {
  const explicitCode = unitCode?.trim()
  const code = explicitCode || DEFAULT_DISPLAY_UNIT_CODE
  const unit = getDisplayUnitByCode(code)

  if (!unit) {
    if (explicitCode) {
      throw new Error("UNIT_NOT_FOUND")
    }
    return buildWaitingState()
  }

  const settings = getDisplaySettings(unit.id)

  if (settings.current_scene_id) {
    healInvalidCurrentScene(unit.id, settings.current_scene_id)
  }

  const broadcast = getUnitBroadcastState(unit.id)

  if (broadcast.status === "WAITING") {
    return buildWaitingState()
  }

  const fresh = getDisplaySettings(unit.id)

  if (fresh.current_scene_id) {
    const scene = getDisplaySceneById(fresh.current_scene_id)
    if (scene && scene.is_active && scene.display_unit_id === unit.id) {
      const resolved = resolveFromSource({
        mode: scene.mode,
        notice_id: scene.notice_id,
        media_full_file_id: scene.media_full_file_id,
        media_left_file_id: scene.media_left_file_id,
        media_right_file_id: scene.media_right_file_id,
        scene: { id: scene.id, name: scene.name },
      })
      if (resolved) return resolved
    }
  }

  const direct = resolveFromSource({
    mode: fresh.mode,
    notice_id: fresh.active_notice_id,
    media_full_file_id: fresh.media_full_file_id,
    media_left_file_id: fresh.media_left_file_id,
    media_right_file_id: fresh.media_right_file_id,
  })

  if (direct) return direct

  return buildWaitingState()
}
