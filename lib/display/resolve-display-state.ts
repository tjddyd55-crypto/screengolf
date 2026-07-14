import type { DisplayMode } from "@/lib/admin/constants"
import { getDisplayAssetById, toPublicMedia } from "@/lib/db/display-assets"
import { getNoticeById } from "@/lib/db/display-notices"
import { getDisplaySettings } from "@/lib/db/display-settings"
import { getDisplaySceneById } from "@/lib/db/display-scenes"
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
  return scene ? { mode: "ranking", scene } : { mode: "ranking" }
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
      }
    }
    return null
  }

  if (source.mode === "ranking") {
    return buildRankingState(scene)
  }

  return null
}

export function resolveDisplayState(): DisplayStatePayload {
  const settings = getDisplaySettings()

  if (settings.current_scene_id) {
    const scene = getDisplaySceneById(settings.current_scene_id)
    if (scene && scene.is_active) {
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

  const fallback = resolveFromSource({
    mode: settings.mode,
    notice_id: settings.active_notice_id,
    media_full_file_id: settings.media_full_file_id,
    media_left_file_id: settings.media_left_file_id,
    media_right_file_id: settings.media_right_file_id,
  })

  return fallback ?? buildRankingState()
}
