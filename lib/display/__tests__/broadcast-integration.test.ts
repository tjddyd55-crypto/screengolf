import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { afterEach, describe, expect, it, vi } from "vitest"

const tempDirs: string[] = []
let closeDbForTests: (() => void) | null = null

async function loadWithTempDb() {
  if (closeDbForTests) {
    closeDbForTests()
    closeDbForTests = null
  }

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gajaranking-bcast-"))
  tempDirs.push(dir)
  const dbPath = path.join(dir, "store.db")

  vi.resetModules()
  process.env.STORE_DB_PATH = dbPath
  process.env.DATA_DIR = dir

  const sqlite = await import("@/lib/db/sqlite")
  const units = await import("@/lib/db/display-units")
  const scenes = await import("@/lib/db/display-scenes")
  const settings = await import("@/lib/db/display-settings")
  const resolve = await import("@/lib/display/resolve-display-state")
  const broadcast = await import("@/lib/display/resolve-broadcast-state")

  closeDbForTests = sqlite.closeDbForTests
  sqlite.getDb()

  return { ...units, ...scenes, ...settings, ...resolve, ...broadcast }
}

describe("broadcast state integration", () => {
  afterEach(() => {
    if (closeDbForTests) {
      closeDbForTests()
      closeDbForTests = null
    }
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop()
      if (!dir) continue
      try {
        fs.rmSync(dir, { recursive: true, force: true })
      } catch {
        // ignore
      }
    }
    vi.resetModules()
    delete process.env.STORE_DB_PATH
    delete process.env.DATA_DIR
  })

  it("seeds BROADCASTING for ranking defaults", async () => {
    const api = await loadWithTempDb()
    const unit1 = api.getDisplayUnitByCode("display-1")!
    expect(api.getUnitBroadcastState(unit1.id).status).toBe("BROADCASTING")
  })

  it("clears current_scene_id when current scene is deactivated", async () => {
    const api = await loadWithTempDb()
    const unit1 = api.getDisplayUnitByCode("display-1")!
    const ranking = api.getRankingScene(unit1.id)!
    api.applyDisplayScene(ranking.id)
    expect(api.getDisplaySettings(unit1.id).current_scene_id).toBe(ranking.id)

    api.deactivateDisplayScene(ranking.id)

    const settings = api.getDisplaySettings(unit1.id)
    expect(settings.current_scene_id).toBeNull()
    expect(api.getUnitBroadcastState(unit1.id).status).toBe("WAITING")
    const payload = api.resolveDisplayState("display-1")
    expect(payload.mode).toBe("off")
    expect(payload.broadcastStatus).toBe("WAITING")
    expect(payload.hasRenderableContent).toBe(false)
  })

  it("keeps current_scene_id when another scene is deactivated", async () => {
    const api = await loadWithTempDb()
    const unit1 = api.getDisplayUnitByCode("display-1")!
    const ranking = api.getRankingScene(unit1.id)!
    api.applyDisplayScene(ranking.id)

    const other = api.createDisplayScene({
      display_unit_id: unit1.id,
      name: "기타",
      mode: "ranking",
    })
    api.deactivateDisplayScene(other.id)

    expect(api.getDisplaySettings(unit1.id).current_scene_id).toBe(ranking.id)
    expect(api.getUnitBroadcastState(unit1.id).status).toBe("BROADCASTING")
  })

  it("does not auto-fallback to ranking after clearing current scene", async () => {
    const api = await loadWithTempDb()
    const unit1 = api.getDisplayUnitByCode("display-1")!
    const ranking = api.getRankingScene(unit1.id)!
    api.applyDisplayScene(ranking.id)
    api.deactivateDisplayScene(ranking.id)

    expect(api.getDisplaySettings(unit1.id).current_scene_id).toBeNull()
    expect(api.resolveDisplayState("display-1").mode).not.toBe("ranking")
    expect(api.getUnitBroadcastState(unit1.id).status).toBe("WAITING")
  })

  it("does not re-apply null current_scene_id on startup migration", async () => {
    const api = await loadWithTempDb()
    const unit1 = api.getDisplayUnitByCode("display-1")!
    api.clearCurrentAppliedScene(unit1.id)
    expect(api.getDisplaySettings(unit1.id).current_scene_id).toBeNull()

    if (closeDbForTests) {
      closeDbForTests()
      closeDbForTests = null
    }
    vi.resetModules()
    process.env.STORE_DB_PATH = path.join(tempDirs[tempDirs.length - 1]!, "store.db")
    process.env.DATA_DIR = tempDirs[tempDirs.length - 1]!
    const sqlite = await import("@/lib/db/sqlite")
    const settings = await import("@/lib/db/display-settings")
    const broadcast = await import("@/lib/display/resolve-broadcast-state")
    const migrate = await import("@/lib/display/migrate-direct-to-scene")
    const startup = await import("@/lib/storage/display-startup")
    closeDbForTests = sqlite.closeDbForTests
    sqlite.getDb()
    startup.resetDisplayStartupFlagsForTests()
    startup.runDirectModeSceneMigrationOnce()

    const unit = (await import("@/lib/db/display-units")).getDisplayUnitByCode(
      "display-1",
    )!
    expect(settings.getDisplaySettings(unit.id).current_scene_id).toBeNull()
    expect(broadcast.getUnitBroadcastState(unit.id).status).toBe("WAITING")
    expect(migrate.migrateAllDirectModesToScenes()).toBe(0)
  })

  it("WAITING display-state has no previous content payload", async () => {
    const api = await loadWithTempDb()
    const unit1 = api.getDisplayUnitByCode("display-1")!
    api.clearCurrentAppliedScene(unit1.id)
    const payload = api.resolveDisplayState("display-1")
    expect(payload.mode).toBe("off")
    expect(payload.broadcastStatus).toBe("WAITING")
    expect("notice" in payload).toBe(false)
    expect("media" in payload).toBe(false)
    expect("left" in payload).toBe(false)
  })

  it("BROADCASTING display-state returns ranking content", async () => {
    const api = await loadWithTempDb()
    const payload = api.resolveDisplayState("display-1")
    expect(payload.broadcastStatus).toBe("BROADCASTING")
    expect(payload.mode).toBe("ranking")
  })

  it("keeps other unit settings when one unit is cleared", async () => {
    const api = await loadWithTempDb()
    const u1 = api.getDisplayUnitByCode("display-1")!
    const u2 = api.getDisplayUnitByCode("display-2")!
    const before2 = api.getDisplaySettings(u2.id)
    api.clearCurrentAppliedScene(u1.id)
    const after2 = api.getDisplaySettings(u2.id)
    expect(after2.current_scene_id).toBe(before2.current_scene_id)
    expect(after2.mode).toBe(before2.mode)
    expect(api.getUnitBroadcastState(u2.id).status).toBe("BROADCASTING")
  })

  it("getUnitBroadcastState is read-only and does not migrate", async () => {
    const api = await loadWithTempDb()
    const u1 = api.getDisplayUnitByCode("display-1")!
    api.clearCurrentAppliedScene(u1.id)
    api.updateDisplaySettings(
      { mode: "ranking", current_scene_id: null },
      u1.id,
    )
    const beforeScenes = api.listDisplayScenes(u1.id).length
    expect(api.getUnitBroadcastState(u1.id).status).toBe("WAITING")
    expect(api.getDisplaySettings(u1.id).current_scene_id).toBeNull()
    expect(api.listDisplayScenes(u1.id)).toHaveLength(beforeScenes)
  })

  it("migrates valid direct ranking via startup migration", async () => {
    const api = await loadWithTempDb()
    const migrate = await import("@/lib/display/migrate-direct-to-scene")
    const u1 = api.getDisplayUnitByCode("display-1")!
    api.clearCurrentAppliedScene(u1.id)
    api.updateDisplaySettings(
      { mode: "ranking", current_scene_id: null },
      u1.id,
    )

    expect(migrate.migrateDirectModeToSceneIfNeeded(u1.id)).toBe(true)
    const state = api.getUnitBroadcastState(u1.id)
    expect(state.status).toBe("BROADCASTING")
    expect(state.reason).toBe("ACTIVE_SCENE")
    expect(api.getDisplaySettings(u1.id).current_scene_id).not.toBeNull()
    expect(api.resolveDisplayState("display-1").mode).toBe("ranking")
  })

  it("migration is idempotent and does not duplicate scenes", async () => {
    const api = await loadWithTempDb()
    const migrate = await import("@/lib/display/migrate-direct-to-scene")
    const u1 = api.getDisplayUnitByCode("display-1")!
    api.clearCurrentAppliedScene(u1.id)
    api.updateDisplaySettings(
      { mode: "ranking", current_scene_id: null },
      u1.id,
    )

    const before = api.listDisplayScenes(u1.id).length
    expect(migrate.migrateDirectModeToSceneIfNeeded(u1.id)).toBe(true)
    const afterFirst = api.listDisplayScenes(u1.id).length
    // 기존 동일 콘텐츠 ranking Scene 재사용 → 개수 증가 없음
    expect(afterFirst).toBe(before)

    expect(migrate.migrateDirectModeToSceneIfNeeded(u1.id)).toBe(false)
    expect(api.listDisplayScenes(u1.id)).toHaveLength(afterFirst)
  })

  it("does not re-apply after clear when migration marker exists", async () => {
    const api = await loadWithTempDb()
    const migrate = await import("@/lib/display/migrate-direct-to-scene")
    const u1 = api.getDisplayUnitByCode("display-1")!
    api.clearCurrentAppliedScene(u1.id)
    api.updateDisplaySettings(
      { mode: "ranking", current_scene_id: null },
      u1.id,
    )
    expect(migrate.migrateDirectModeToSceneIfNeeded(u1.id)).toBe(true)
    api.clearCurrentAppliedScene(u1.id)
    api.updateDisplaySettings(
      { mode: "ranking", current_scene_id: null },
      u1.id,
    )
    expect(migrate.migrateDirectModeToSceneIfNeeded(u1.id)).toBe(false)
    expect(api.getUnitBroadcastState(u1.id).status).toBe("WAITING")
  })

  it("skips migration when current_scene_id already set", async () => {
    const api = await loadWithTempDb()
    const migrate = await import("@/lib/display/migrate-direct-to-scene")
    const u1 = api.getDisplayUnitByCode("display-1")!
    const ranking = api.getRankingScene(u1.id)!
    api.applyDisplayScene(ranking.id)
    const before = api.listDisplayScenes(u1.id).length
    expect(api.getDisplaySettings(u1.id).current_scene_id).toBe(ranking.id)
    expect(migrate.migrateDirectModeToSceneIfNeeded(u1.id)).toBe(false)
    expect(api.listDisplayScenes(u1.id)).toHaveLength(before)
  })

  it("does not migrate incomplete WAITING direct settings", async () => {
    const api = await loadWithTempDb()
    const migrate = await import("@/lib/display/migrate-direct-to-scene")
    const u1 = api.getDisplayUnitByCode("display-1")!
    api.clearCurrentAppliedScene(u1.id)
    // mode=notice + no notice → not migratable
    expect(migrate.isMigratableDirectSettings(api.getDisplaySettings(u1.id))).toBe(
      false,
    )
    expect(migrate.migrateDirectModeToSceneIfNeeded(u1.id)).toBe(false)
    expect(api.getUnitBroadcastState(u1.id).status).toBe("WAITING")
  })

  it("exposes no broadcast scene id when unit is inactive", async () => {
    const api = await loadWithTempDb()
    const unit = api.createDisplayUnit({ name: "테스트 전광판" })
    const ranking = api
      .listDisplayScenes(unit.id)
      .find((scene) => scene.mode === "ranking")!
    api.applyDisplayScene(ranking.id)

    const broadcasting = api.toAdminBroadcastFields(
      api.getUnitBroadcastState(unit.id),
    )
    expect(broadcasting.broadcast_status).toBe("BROADCASTING")
    expect(broadcasting.broadcast_scene_id).toBe(ranking.id)

    api.deactivateDisplayUnit(unit.id)

    // raw current_scene_id는 남아 있어도 카드 SSOT는 WAITING이어야 한다
    expect(api.getDisplaySettings(unit.id).current_scene_id).toBe(ranking.id)
    const waiting = api.toAdminBroadcastFields(
      api.getUnitBroadcastState(unit.id),
    )
    expect(waiting.broadcast_status).toBe("WAITING")
    expect(waiting.broadcast_scene_id).toBeNull()
    expect(waiting.current_scene_name).toBeNull()
  })

  it("matches reusable scene by content ids, not by name alone", async () => {
    const api = await loadWithTempDb()
    const migrate = await import("@/lib/display/migrate-direct-to-scene")
    const u1 = api.getDisplayUnitByCode("display-1")!
    api.clearCurrentAppliedScene(u1.id)
    api.updateDisplaySettings(
      { mode: "ranking", current_scene_id: null },
      u1.id,
    )

    // 같은 표시 이름이어도 mode/콘텐츠가 다르면 매칭되지 않음 → ranking 후보만 선택
    const rankingMatch = migrate.findSceneMatchingDirectSettings(
      u1.id,
      api.getDisplaySettings(u1.id),
    )
    expect(rankingMatch).not.toBeNull()
    expect(rankingMatch!.mode).toBe("ranking")
    expect(rankingMatch!.notice_id).toBeNull()
    expect(rankingMatch!.media_full_file_id).toBeNull()
  })
})
