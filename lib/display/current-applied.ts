import {
  DISPLAY_MODE_LABELS,
  type DisplayMode,
} from "@/lib/admin/constants"
import type { DisplayBroadcastStatus } from "@/lib/display/broadcast-state"

export type CurrentAppliedState = {
  isApplied: boolean
  sceneName: string | null
  mode: DisplayMode | null
  modeLabel: string
}

export type QuickSettingCardUiState = {
  /** BROADCASTING + Scene 없음 + resolvedMode 일치 */
  isDirectApplied: boolean
  /** 폼에서만 선택됨 (아직 실제 적용 아님) */
  isSelectedOnly: boolean
  /** Scene 기반 송출 중이며 Scene mode가 이 카드와 같음 */
  isSceneModeMatch: boolean
  badge: "applied" | "selected" | "scene" | null
  buttonLabel: string
  emphasizeApplied: boolean
}

/**
 * raw settings.mode 비교 (저수준).
 * UI의 "현재 적용 중" 표시에는 사용하지 말고
 * `resolveQuickSettingCardState` / `isDirectQuickSettingApplied`를 사용한다.
 */
export function isQuickSettingModeApplied(
  currentMode: DisplayMode | null | undefined,
  cardMode: DisplayMode,
): boolean {
  return currentMode === cardMode
}

/**
 * 빠른 설정 direct mode가 실제로 송출 중인지 SSOT 기준으로 판정한다.
 * - WAITING이면 무조건 false (raw mode=ranking 이어도 false)
 * - Scene 기반 송출이면 false (direct 적용 아님)
 */
export function isDirectQuickSettingApplied(input: {
  broadcastStatus: DisplayBroadcastStatus | null | undefined
  resolvedMode: DisplayMode | null | undefined
  currentSceneId: number | null | undefined
  cardMode: DisplayMode
}): boolean {
  if (input.broadcastStatus !== "BROADCASTING") return false
  if (input.currentSceneId != null) return false
  return input.resolvedMode === input.cardMode
}

/**
 * 빠른 설정 카드 UI 상태.
 * 실제 적용(B)과 폼 선택(A)을 분리한다.
 */
export function resolveQuickSettingCardState(input: {
  cardMode: DisplayMode
  broadcastStatus: DisplayBroadcastStatus
  resolvedMode: DisplayMode | null | undefined
  currentSceneId: number | null | undefined
  selectedMode: DisplayMode | null | undefined
}): QuickSettingCardUiState {
  const isDirectApplied = isDirectQuickSettingApplied({
    broadcastStatus: input.broadcastStatus,
    resolvedMode: input.resolvedMode,
    currentSceneId: input.currentSceneId,
    cardMode: input.cardMode,
  })

  const isSceneModeMatch =
    input.broadcastStatus === "BROADCASTING" &&
    input.currentSceneId != null &&
    input.resolvedMode === input.cardMode

  const isSelectedOnly =
    !isDirectApplied &&
    !isSceneModeMatch &&
    input.selectedMode === input.cardMode

  if (isDirectApplied) {
    return {
      isDirectApplied: true,
      isSelectedOnly: false,
      isSceneModeMatch: false,
      badge: "applied",
      buttonLabel: "적용 중",
      emphasizeApplied: true,
    }
  }

  if (isSceneModeMatch) {
    return {
      isDirectApplied: false,
      isSelectedOnly: false,
      isSceneModeMatch: true,
      badge: "scene",
      buttonLabel: "적용",
      emphasizeApplied: false,
    }
  }

  if (isSelectedOnly) {
    return {
      isDirectApplied: false,
      isSelectedOnly: true,
      isSceneModeMatch: false,
      badge: "selected",
      buttonLabel: "적용",
      emphasizeApplied: false,
    }
  }

  return {
    isDirectApplied: false,
    isSelectedOnly: false,
    isSceneModeMatch: false,
    badge: null,
    buttonLabel: "적용",
    emphasizeApplied: false,
  }
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
