import { describe, expect, it } from "vitest"
import {
  evaluateBroadcastState,
  getBroadcastStatusLabel,
  getBroadcastStatusHint,
  getBroadcastCardClass,
  type BroadcastSceneInput,
} from "@/lib/display/broadcast-state"
import type { DisplayMode } from "@/lib/admin/constants"

const probeOk = {
  noticeRenderable: true,
  mediaFullRenderable: true,
  mediaSplitRenderable: true,
}

const probeEmpty = {
  noticeRenderable: false,
  mediaFullRenderable: false,
  mediaSplitRenderable: false,
}

function scene(overrides: Partial<BroadcastSceneInput> = {}): BroadcastSceneInput {
  return {
    id: 10,
    name: "더위사냥",
    mode: "media_split",
    is_active: true,
    display_unit_id: 1,
    notice_id: null,
    media_full_file_id: null,
    media_left_file_id: 1,
    media_right_file_id: 2,
    ...overrides,
  }
}

function base(overrides: {
  unitActive?: boolean
  mode?: DisplayMode | null
  currentSceneId?: number | null
  currentScene?: BroadcastSceneInput | null
  sceneProbe?: typeof probeOk
  settingsProbe?: typeof probeOk
} = {}) {
  return evaluateBroadcastState({
    unitActive: overrides.unitActive ?? true,
    unitId: 1,
    mode: overrides.mode ?? "ranking",
    currentSceneId: overrides.currentSceneId ?? null,
    currentScene: overrides.currentScene ?? null,
    sceneProbe: overrides.sceneProbe ?? probeEmpty,
    settingsProbe: overrides.settingsProbe ?? probeOk,
  })
}

describe("evaluateBroadcastState (Scene-only)", () => {
  it("returns BROADCASTING for active scene with valid content", () => {
    const state = base({
      currentSceneId: 10,
      currentScene: scene(),
      sceneProbe: probeOk,
    })
    expect(state.status).toBe("BROADCASTING")
    expect(state.reason).toBe("ACTIVE_SCENE")
    expect(state.currentSceneName).toBe("더위사냥")
  })

  it("returns WAITING when current_scene_id is null", () => {
    const state = base({
      mode: "ranking",
      currentSceneId: null,
      settingsProbe: probeOk,
    })
    expect(state.status).toBe("WAITING")
    expect(state.reason).toBe("NO_CURRENT_SCENE")
  })

  it("raw mode=ranking without scene stays WAITING", () => {
    const state = base({
      mode: "ranking",
      currentSceneId: null,
      settingsProbe: probeEmpty,
    })
    expect(state.status).toBe("WAITING")
    expect(state.reason).toBe("NO_CURRENT_SCENE")
  })

  it("returns WAITING when scene is missing", () => {
    const state = base({
      currentSceneId: 99,
      currentScene: null,
    })
    expect(state.status).toBe("WAITING")
    expect(state.reason).toBe("SCENE_MISSING")
  })

  it("returns WAITING when scene is inactive", () => {
    const state = base({
      currentSceneId: 10,
      currentScene: scene({ is_active: false }),
      sceneProbe: probeOk,
    })
    expect(state.status).toBe("WAITING")
    expect(state.reason).toBe("SCENE_INACTIVE")
  })

  it("returns WAITING when scene belongs to another unit", () => {
    const state = base({
      currentSceneId: 10,
      currentScene: scene({ display_unit_id: 2 }),
      sceneProbe: probeOk,
    })
    expect(state.status).toBe("WAITING")
    expect(state.reason).toBe("SCENE_UNIT_MISMATCH")
  })

  it("returns WAITING when media_full asset missing", () => {
    const state = base({
      currentSceneId: 10,
      currentScene: scene({ mode: "media_full", media_full_file_id: null }),
      sceneProbe: probeEmpty,
    })
    expect(state.status).toBe("WAITING")
    expect(state.reason).toBe("ASSET_MISSING")
  })

  it("returns WAITING when media_split asset missing", () => {
    const state = base({
      currentSceneId: 10,
      currentScene: scene(),
      sceneProbe: probeEmpty,
    })
    expect(state.status).toBe("WAITING")
    expect(state.reason).toBe("ASSET_MISSING")
  })

  it("returns WAITING when notice content missing on scene", () => {
    const state = base({
      currentSceneId: 10,
      currentScene: scene({ mode: "notice", notice_id: null }),
      sceneProbe: probeEmpty,
    })
    expect(state.status).toBe("WAITING")
    expect(state.reason).toBe("NOTICE_MISSING")
  })

  it("does not treat valid media settings alone as BROADCASTING", () => {
    const state = base({
      mode: "media_full",
      currentSceneId: null,
      settingsProbe: {
        ...probeEmpty,
        mediaFullRenderable: true,
      },
    })
    expect(state.status).toBe("WAITING")
    expect(state.reason).toBe("NO_CURRENT_SCENE")
  })

  it("maps status labels, hints and card classes", () => {
    expect(getBroadcastStatusLabel("BROADCASTING")).toBe("현재 송출 중")
    expect(getBroadcastStatusLabel("WAITING")).toBe("적용된 화면 없음")
    expect(getBroadcastStatusHint("WAITING")).toContain("Scene 관리")
    expect(
      getBroadcastCardClass("BROADCASTING", {
        displayUnitCardBroadcasting: "on",
        displayUnitCardWaiting: "wait",
      }),
    ).toBe("on")
  })
})
