import {
  DISPLAY_MODE_LABELS,
  type DisplayMode,
} from "@/lib/admin/constants"

export type CurrentAppliedState = {
  isApplied: boolean
  sceneName: string | null
  mode: DisplayMode | null
  modeLabel: string
}

/**
 * 빠른 설정 카드가 현재 전광판에 적용 중인지 판별한다.
 * Scene 적용 여부와 무관하게 settings.mode 기준이다.
 */
export function isQuickSettingModeApplied(
  currentMode: DisplayMode | null | undefined,
  cardMode: DisplayMode,
): boolean {
  return currentMode === cardMode
}

export function isSceneCurrentlyApplied(
  currentSceneId: number | null | undefined,
  sceneId: number | null | undefined,
): boolean {
  if (currentSceneId == null || sceneId == null) return false
  return currentSceneId === sceneId
}

export function getDisplayModeLabel(
  mode: DisplayMode | string | null | undefined,
): string {
  if (!mode) return "랭킹 화면"
  return DISPLAY_MODE_LABELS[mode as DisplayMode] ?? String(mode)
}

export function formatCurrentAppliedSceneLabel(input: {
  sceneName?: string | null
  modeLabel: string
}): string {
  const name = input.sceneName?.trim()
  return name || input.modeLabel
}

/**
 * 관리자 UI용 현재 적용 상태 요약.
 * current_scene이 없으면 mode 라벨로 fallback한다.
 */
export function resolveCurrentAppliedState(input: {
  mode?: DisplayMode | null
  currentSceneId?: number | null
  currentSceneName?: string | null
  sceneId?: number | null
  cardMode?: DisplayMode
}): CurrentAppliedState {
  const mode = input.mode ?? null
  const modeLabel = getDisplayModeLabel(mode)
  const sceneName = input.currentSceneName?.trim() || null

  let isApplied = false
  if (input.sceneId != null) {
    isApplied = isSceneCurrentlyApplied(input.currentSceneId, input.sceneId)
  } else if (input.cardMode != null) {
    isApplied = isQuickSettingModeApplied(mode, input.cardMode)
  }

  return {
    isApplied,
    sceneName,
    mode,
    modeLabel,
  }
}

/**
 * display_settings.updated_at 기준 상대 시각.
 * 파싱 불가하면 null (추정 표시 금지).
 */
export function formatSettingsUpdatedAt(
  updatedAt: string | null | undefined,
  nowMs: number = Date.now(),
): string | null {
  if (!updatedAt?.trim()) return null

  const raw = updatedAt.trim()
  const isoLike = raw.includes("T")
    ? raw
    : raw.includes(" ")
      ? `${raw.replace(" ", "T")}Z`
      : raw
  const parsed = Date.parse(isoLike)
  if (Number.isNaN(parsed)) return null

  const diffMs = Math.max(0, nowMs - parsed)
  const diffSec = Math.floor(diffMs / 1000)
  if (diffSec < 60) return "방금 전"

  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin}분 전`

  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) return `${diffHour}시간 전`

  const date = new Date(parsed)
  const y = date.getFullYear()
  const m = date.getMonth() + 1
  const d = date.getDate()
  const hh = String(date.getHours()).padStart(2, "0")
  const mm = String(date.getMinutes()).padStart(2, "0")
  return `${y}. ${m}. ${d}. ${hh}:${mm}`
}
