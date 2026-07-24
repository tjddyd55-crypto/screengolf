import { describe, expect, it } from "vitest"
import {
  formatCurrentAppliedSceneLabel,
  formatSettingsUpdatedAt,
  getDisplayModeLabel,
  isQuickSettingModeApplied,
  isSceneCurrentlyApplied,
  resolveCurrentAppliedState,
} from "@/lib/display/current-applied"
import {
  isProtectedDisplayUnitCode,
  protectedUnitDeleteErrorMessage,
} from "@/lib/display/protected-units"

describe("current-applied helpers", () => {
  it("matches quick-setting mode against current settings mode", () => {
    expect(isQuickSettingModeApplied("ranking", "ranking")).toBe(true)
    expect(isQuickSettingModeApplied("media_split", "ranking")).toBe(false)
    expect(isQuickSettingModeApplied(null, "ranking")).toBe(false)
    expect(isQuickSettingModeApplied(undefined, "notice")).toBe(false)
  })

  it("matches current scene id", () => {
    expect(isSceneCurrentlyApplied(12, 12)).toBe(true)
    expect(isSceneCurrentlyApplied(12, 13)).toBe(false)
    expect(isSceneCurrentlyApplied(null, 12)).toBe(false)
    expect(isSceneCurrentlyApplied(12, null)).toBe(false)
  })

  it("prefers scene name for current applied label", () => {
    expect(
      formatCurrentAppliedSceneLabel({
        sceneName: "더위사냥",
        modeLabel: "세로 2분할 화면",
      }),
    ).toBe("더위사냥")

    expect(
      formatCurrentAppliedSceneLabel({
        sceneName: "  ",
        modeLabel: "랭킹 화면",
      }),
    ).toBe("랭킹 화면")

    expect(
      formatCurrentAppliedSceneLabel({
        sceneName: null,
        modeLabel: "공지사항",
      }),
    ).toBe("공지사항")
  })

  it("resolves applied state with mode fallback when scene is null", () => {
    const state = resolveCurrentAppliedState({
      mode: "ranking",
      currentSceneId: null,
      currentSceneName: null,
      cardMode: "ranking",
    })
    expect(state.isApplied).toBe(true)
    expect(state.sceneName).toBeNull()
    expect(state.modeLabel).toBe("랭킹 화면")
  })

  it("resolves scene applied state by id", () => {
    const applied = resolveCurrentAppliedState({
      mode: "media_split",
      currentSceneId: 7,
      currentSceneName: "더위사냥",
      sceneId: 7,
    })
    expect(applied.isApplied).toBe(true)
    expect(applied.sceneName).toBe("더위사냥")
    expect(applied.modeLabel).toBe("세로 2분할 화면")

    const other = resolveCurrentAppliedState({
      mode: "media_split",
      currentSceneId: 7,
      currentSceneName: "더위사냥",
      sceneId: 8,
    })
    expect(other.isApplied).toBe(false)
  })

  it("converts mode labels to Korean", () => {
    expect(getDisplayModeLabel("ranking")).toBe("랭킹 화면")
    expect(getDisplayModeLabel("media_split")).toBe("세로 2분할 화면")
    expect(getDisplayModeLabel(null)).toBe("랭킹 화면")
  })

  it("formats settings updated_at relatively when parseable", () => {
    const now = Date.parse("2026-07-24T12:00:00Z")
    expect(formatSettingsUpdatedAt("2026-07-24 11:59:30", now)).toBe("방금 전")
    expect(formatSettingsUpdatedAt("2026-07-24 11:40:00", now)).toBe("20분 전")
    expect(formatSettingsUpdatedAt("2026-07-24 09:00:00", now)).toBe("3시간 전")
    expect(formatSettingsUpdatedAt("not-a-date", now)).toBeNull()
    expect(formatSettingsUpdatedAt(null, now)).toBeNull()
  })
})

describe("protected display units", () => {
  it("protects display-1 and display-2 only", () => {
    expect(isProtectedDisplayUnitCode("display-1")).toBe(true)
    expect(isProtectedDisplayUnitCode("display-2")).toBe(true)
    expect(isProtectedDisplayUnitCode("display-3")).toBe(false)
    expect(isProtectedDisplayUnitCode("display-10")).toBe(false)
  })

  it("normalizes blank and case for protection checks", () => {
    expect(isProtectedDisplayUnitCode(" DISPLAY-1 ")).toBe(true)
    expect(isProtectedDisplayUnitCode("Display-2")).toBe(true)
    expect(isProtectedDisplayUnitCode("")).toBe(false)
    expect(isProtectedDisplayUnitCode(null)).toBe(false)
    expect(isProtectedDisplayUnitCode(undefined)).toBe(false)
  })

  it("returns unified delete error message", () => {
    expect(protectedUnitDeleteErrorMessage()).toBe(
      "기본 전광판은 삭제할 수 없습니다.",
    )
  })
})
