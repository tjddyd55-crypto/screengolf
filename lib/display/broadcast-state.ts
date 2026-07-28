import {
  DISPLAY_MODE_LABELS,
  type DisplayMode,
} from "@/lib/admin/constants"

export type DisplayBroadcastStatus = "BROADCASTING" | "WAITING"

export type DisplayBroadcastReason =
  | "ACTIVE_SCENE"
  | "DIRECT_MODE"
  | "NO_ACTIVE_CONTENT"
  | "SCENE_MISSING"
  | "SCENE_INACTIVE"
  | "SCENE_UNIT_MISMATCH"
  | "ASSET_MISSING"
  | "NOTICE_MISSING"
  | "NO_CURRENT_SCENE"
  | "UNIT_INACTIVE"

export type DisplayBroadcastState = {
  status: DisplayBroadcastStatus
  hasRenderableContent: boolean
  currentSceneId: number | null
  currentSceneName: string | null
  mode: DisplayMode | null
  modeLabel: string | null
  reason: DisplayBroadcastReason
}

export type BroadcastContentProbe = {
  noticeRenderable: boolean
  mediaFullRenderable: boolean
  mediaSplitRenderable: boolean
}

export type BroadcastSceneInput = {
  id: number
  name: string
  mode: DisplayMode
  is_active: boolean
  display_unit_id: number
  notice_id: number | null
  media_full_file_id: number | null
  media_left_file_id: number | null
  media_right_file_id: number | null
}

function modeLabelOf(mode: DisplayMode | null | undefined): string | null {
  if (!mode) return null
  return DISPLAY_MODE_LABELS[mode] ?? mode
}

function contentRenderableForMode(
  mode: DisplayMode,
  probe: BroadcastContentProbe,
): { ok: boolean; reason: DisplayBroadcastReason } {
  if (mode === "ranking") {
    return { ok: true, reason: "DIRECT_MODE" }
  }
  if (mode === "notice") {
    return probe.noticeRenderable
      ? { ok: true, reason: "DIRECT_MODE" }
      : { ok: false, reason: "NOTICE_MISSING" }
  }
  if (mode === "media_full") {
    return probe.mediaFullRenderable
      ? { ok: true, reason: "DIRECT_MODE" }
      : { ok: false, reason: "ASSET_MISSING" }
  }
  if (mode === "media_split") {
    return probe.mediaSplitRenderable
      ? { ok: true, reason: "DIRECT_MODE" }
      : { ok: false, reason: "ASSET_MISSING" }
  }
  return { ok: false, reason: "NO_ACTIVE_CONTENT" }
}

/**
 * 송출 상태 SSOT.
 * - BROADCASTING: 렌더 가능한 화면이 적용됨
 * - WAITING: Unit은 있으나 렌더 가능한 화면이 없음
 */
export function evaluateBroadcastState(input: {
  unitActive?: boolean
  unitId: number
  mode: DisplayMode | null
  currentSceneId: number | null
  currentScene: BroadcastSceneInput | null
  sceneProbe: BroadcastContentProbe
  settingsProbe: BroadcastContentProbe
}): DisplayBroadcastState {
  const mode = input.mode
  const modeLabel = modeLabelOf(mode)

  if (input.unitActive === false) {
    return {
      status: "WAITING",
      hasRenderableContent: false,
      currentSceneId: null,
      currentSceneName: null,
      mode,
      modeLabel,
      reason: "UNIT_INACTIVE",
    }
  }

  if (input.currentSceneId != null) {
    const scene = input.currentScene
    if (!scene) {
      return {
        status: "WAITING",
        hasRenderableContent: false,
        currentSceneId: null,
        currentSceneName: null,
        mode,
        modeLabel,
        reason: "SCENE_MISSING",
      }
    }
    if (scene.display_unit_id !== input.unitId) {
      return {
        status: "WAITING",
        hasRenderableContent: false,
        currentSceneId: null,
        currentSceneName: null,
        mode,
        modeLabel,
        reason: "SCENE_UNIT_MISMATCH",
      }
    }
    if (!scene.is_active) {
      return {
        status: "WAITING",
        hasRenderableContent: false,
        currentSceneId: null,
        currentSceneName: null,
        mode,
        modeLabel,
        reason: "SCENE_INACTIVE",
      }
    }

    const renderable = contentRenderableForMode(scene.mode, input.sceneProbe)
    if (!renderable.ok) {
      return {
        status: "WAITING",
        hasRenderableContent: false,
        currentSceneId: scene.id,
        currentSceneName: scene.name,
        mode: scene.mode,
        modeLabel: modeLabelOf(scene.mode),
        reason: renderable.reason,
      }
    }

    return {
      status: "BROADCASTING",
      hasRenderableContent: true,
      currentSceneId: scene.id,
      currentSceneName: scene.name,
      mode: scene.mode,
      modeLabel: modeLabelOf(scene.mode),
      reason: "ACTIVE_SCENE",
    }
  }

  if (!mode) {
    return {
      status: "WAITING",
      hasRenderableContent: false,
      currentSceneId: null,
      currentSceneName: null,
      mode: null,
      modeLabel: null,
      reason: "NO_CURRENT_SCENE",
    }
  }

  const direct = contentRenderableForMode(mode, input.settingsProbe)
  if (!direct.ok) {
    return {
      status: "WAITING",
      hasRenderableContent: false,
      currentSceneId: null,
      currentSceneName: null,
      mode,
      modeLabel,
      reason: direct.reason,
    }
  }

  return {
    status: "BROADCASTING",
    hasRenderableContent: true,
    currentSceneId: null,
    currentSceneName: null,
    mode,
    modeLabel,
    reason: "DIRECT_MODE",
  }
}

export function getBroadcastStatusLabel(status: DisplayBroadcastStatus): string {
  if (status === "BROADCASTING") return "현재 송출 중"
  return "적용된 화면 없음"
}

export function getBroadcastStatusHint(status: DisplayBroadcastStatus): string {
  if (status === "BROADCASTING") {
    return "현재 이 전광판 URL에 적용된 화면이 표시되고 있습니다."
  }
  return "빠른 설정에서 화면을 적용하거나 Scene을 선택해 주세요."
}

export function getBroadcastCardClass(
  status: DisplayBroadcastStatus,
  styles: {
    displayUnitCardBroadcasting?: string
    displayUnitCardWaiting?: string
  },
): string {
  if (status === "BROADCASTING") {
    return styles.displayUnitCardBroadcasting ?? ""
  }
  return styles.displayUnitCardWaiting ?? ""
}
