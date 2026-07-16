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

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gajaranking-du-"))
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

  closeDbForTests = sqlite.closeDbForTests
  sqlite.getDb()

  return { ...units, ...scenes, ...settings, ...resolve }
}

describe("display units multi-instance", () => {
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
        // Windows may keep a brief lock on deleted WAL files
      }
    }
    vi.resetModules()
    delete process.env.STORE_DB_PATH
    delete process.env.DATA_DIR
  })

  it("seeds display-1 and display-2 with independent settings", async () => {
    const api = await loadWithTempDb()

    const list = api.listDisplayUnits()
    expect(list.map((u) => u.code)).toEqual(["display-1", "display-2"])

    const unit1 = api.getDisplayUnitByCode("display-1")!
    const unit2 = api.getDisplayUnitByCode("display-2")!

    const s1 = api.getDisplaySettings(unit1.id)
    const s2 = api.getDisplaySettings(unit2.id)
    expect(s1.display_unit_id).toBe(unit1.id)
    expect(s2.display_unit_id).toBe(unit2.id)
    expect(s1.mode).toBe("ranking")
    expect(s2.mode).toBe("ranking")

    const scenes1 = api.listDisplayScenes(unit1.id)
    const scenes2 = api.listDisplayScenes(unit2.id)
    expect(scenes1.length).toBeGreaterThanOrEqual(1)
    expect(scenes2.length).toBe(4)
    expect(scenes2.every((s) => s.display_unit_id === unit2.id)).toBe(true)
  })

  it("keeps unit1 apply isolated from unit2", async () => {
    const api = await loadWithTempDb()
    const unit1 = api.getDisplayUnitByCode("display-1")!
    const unit2 = api.getDisplayUnitByCode("display-2")!

    const ranking1 = api
      .listDisplayScenes(unit1.id)
      .find((s) => s.mode === "ranking")!
    const ranking2 = api
      .listDisplayScenes(unit2.id)
      .find((s) => s.mode === "ranking")!

    api.applyDisplayScene(ranking1.id)
    api.applyDisplayScene(ranking2.id)

    expect(api.getDisplaySettings(unit1.id).current_scene_id).toBe(ranking1.id)
    expect(api.getDisplaySettings(unit2.id).current_scene_id).toBe(ranking2.id)

    api.updateDisplaySettings(
      { mode: "ranking", current_scene_id: null },
      unit1.id,
    )
    expect(api.getDisplaySettings(unit1.id).current_scene_id).toBeNull()
    expect(api.getDisplaySettings(unit2.id).current_scene_id).toBe(ranking2.id)

    const state1 = api.resolveDisplayState()
    const state2 = api.resolveDisplayState("display-2")
    expect(state1.mode).toBe("ranking")
    expect(state2.mode).toBe("ranking")
  })

  it("rejects soft-delete of display-1", async () => {
    const api = await loadWithTempDb()
    const unit1 = api.getDisplayUnitByCode("display-1")!
    expect(() => api.deactivateDisplayUnit(unit1.id)).toThrow(/display-1/)
  })

  it("creates additional units with default scenes", async () => {
    const api = await loadWithTempDb()
    const created = api.createDisplayUnit({ name: "전광판 3" })
    expect(created.code).toBe("display-3")

    const scenes = api.listDisplayScenes(created.id)
    expect(scenes).toHaveLength(4)
    expect(api.getDisplaySettings(created.id).mode).toBe("ranking")
  })

  it("aliases resolveDisplayState() to display-1", async () => {
    const api = await loadWithTempDb()
    const a = api.resolveDisplayState()
    const b = api.resolveDisplayState("display-1")
    expect(a).toEqual(b)
  })
})
