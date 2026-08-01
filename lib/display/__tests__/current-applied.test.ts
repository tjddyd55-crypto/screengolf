import { describe, expect, it } from "vitest"
import {
  formatCurrentAppliedSceneLabel,
  formatSettingsUpdatedAt,
  getDisplayModeLabel,
  isDirectQuickSettingApplied,
  isQuickSettingModeApplied,
  isSceneCurrentlyApplied,
  resolveCurrentAppliedState,
  resolveQuickSettingCardState,
} from "@/lib/display/current-applied"
import { getBroadcastStatusLabel } from "@/lib/display/broadcast-state"
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

describe("quick setting card SSOT mapper", () => {
  it("WAITING + raw mode=ranking → 현재 적용 중 아님, 버튼 적용", () => {
    const card = resolveQuickSettingCardState({
      cardMode: "ranking",
      broadcastStatus: "WAITING",
      resolvedMode: "ranking",
      currentSceneId: null,
      selectedMode: null,
    })
    expect(card.isDirectApplied).toBe(false)
    expect(card.badge).toBeNull()
    expect(card.buttonLabel).toBe("적용")
    expect(card.emphasizeApplied).toBe(false)
    expect(
      isDirectQuickSettingApplied({
        broadcastStatus: "WAITING",
        resolvedMode: "ranking",
        currentSceneId: null,
        cardMode: "ranking",
      }),
    ).toBe(false)
  })

  it("BROADCASTING + direct ranking → 현재 적용 중", () => {
    const card = resolveQuickSettingCardState({
      cardMode: "ranking",
      broadcastStatus: "BROADCASTING",
      resolvedMode: "ranking",
      currentSceneId: null,
      selectedMode: "ranking",
    })
    expect(card.isDirectApplied).toBe(true)
    expect(card.badge).toBe("applied")
    expect(card.buttonLabel).toBe("적용 중")
    expect(card.emphasizeApplied).toBe(true)
  })

  it("BROADCASTING + Scene media_split → direct 적용 아님, scene badge", () => {
    const split = resolveQuickSettingCardState({
      cardMode: "media_split",
      broadcastStatus: "BROADCASTING",
      resolvedMode: "media_split",
      currentSceneId: 12,
      selectedMode: "media_split",
    })
    expect(split.isDirectApplied).toBe(false)
    expect(split.isSceneModeMatch).toBe(true)
    expect(split.badge).toBe("scene")
    expect(split.buttonLabel).toBe("적용")
    expect(split.emphasizeApplied).toBe(false)

    const ranking = resolveQuickSettingCardState({
      cardMode: "ranking",
      broadcastStatus: "BROADCASTING",
      resolvedMode: "media_split",
      currentSceneId: 12,
      selectedMode: "media_split",
    })
    expect(ranking.isDirectApplied).toBe(false)
    expect(ranking.badge).toBeNull()
  })

  it("selectedMode=ranking + SSOT WAITING → 선택됨, 현재 적용 중 금지", () => {
    const card = resolveQuickSettingCardState({
      cardMode: "ranking",
      broadcastStatus: "WAITING",
      resolvedMode: "ranking",
      currentSceneId: null,
      selectedMode: "ranking",
    })
    expect(card.isDirectApplied).toBe(false)
    expect(card.isSelectedOnly).toBe(true)
    expect(card.badge).toBe("selected")
    expect(card.buttonLabel).toBe("적용")
  })

  it("적용 성공 후 새 SSOT BROADCASTING 반영", () => {
    const before = resolveQuickSettingCardState({
      cardMode: "ranking",
      broadcastStatus: "WAITING",
      resolvedMode: "ranking",
      currentSceneId: null,
      selectedMode: "ranking",
    })
    expect(before.isDirectApplied).toBe(false)

    const after = resolveQuickSettingCardState({
      cardMode: "ranking",
      broadcastStatus: "BROADCASTING",
      resolvedMode: "ranking",
      currentSceneId: null,
      selectedMode: "ranking",
    })
    expect(after.isDirectApplied).toBe(true)
    expect(after.badge).toBe("applied")
  })

  it("적용 실패 또는 콘텐츠 무효 시 WAITING 유지", () => {
    const card = resolveQuickSettingCardState({
      cardMode: "media_full",
      broadcastStatus: "WAITING",
      resolvedMode: "media_full",
      currentSceneId: null,
      selectedMode: "media_full",
    })
    expect(card.isDirectApplied).toBe(false)
    expect(card.badge).toBe("selected")
    expect(card.buttonLabel).toBe("적용")
  })

  it("관리자 홈과 빠른 설정에 같은 broadcastStatus면 label 일치", () => {
    expect(getBroadcastStatusLabel("WAITING")).toBe("적용된 화면 없음")
    expect(getBroadcastStatusLabel("BROADCASTING")).toBe("현재 송출 중")
  })

  it("raw mode만으로 BROADCASTING 처리하지 않음", () => {
    expect(
      isDirectQuickSettingApplied({
        broadcastStatus: "WAITING",
        resolvedMode: "ranking",
        currentSceneId: null,
        cardMode: "ranking",
      }),
    ).toBe(false)
    expect(isQuickSettingModeApplied("ranking", "ranking")).toBe(true)
  })

  it("display-1 Scene 더위사냥 형태는 direct ranking 적용으로 표시하지 않음", () => {
    const ranking = resolveQuickSettingCardState({
      cardMode: "ranking",
      broadcastStatus: "BROADCASTING",
      resolvedMode: "media_split",
      currentSceneId: 1,
      selectedMode: "media_split",
    })
    const split = resolveQuickSettingCardState({
      cardMode: "media_split",
      broadcastStatus: "BROADCASTING",
      resolvedMode: "media_split",
      currentSceneId: 1,
      selectedMode: "media_split",
    })
    expect(ranking.isDirectApplied).toBe(false)
    expect(split.isDirectApplied).toBe(false)
    expect(split.badge).toBe("scene")
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
