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
    expect(() => api.deactivateDisplayUnit(unit1.id)).toThrow(
      /기본 전광판은 삭제할 수 없습니다/,
    )
  })

  it("rejects soft-delete of display-2", async () => {
    const api = await loadWithTempDb()
    const unit2 = api.getDisplayUnitByCode("display-2")!
    expect(() => api.deactivateDisplayUnit(unit2.id)).toThrow(
      /기본 전광판은 삭제할 수 없습니다/,
    )
  })

  it("rejects hard-delete of display-1 and display-2", async () => {
    const api = await loadWithTempDb()
    expect(() => api.deleteDisplayUnitByCode("display-1")).toThrow(
      /기본 전광판은 삭제할 수 없습니다/,
    )
    expect(() => api.deleteDisplayUnitByCode("display-2")).toThrow(
      /기본 전광판은 삭제할 수 없습니다/,
    )
    expect(api.getDisplayUnitByCode("display-1")).not.toBeNull()
    expect(api.getDisplayUnitByCode("display-2")).not.toBeNull()
  })

  it("hard-deletes user unit settings and scenes only", async () => {
    const api = await loadWithTempDb()
    const sqlite = await import("@/lib/db/sqlite")
    const db = sqlite.getDb()

    const unit1 = api.getDisplayUnitByCode("display-1")!
    const unit2 = api.getDisplayUnitByCode("display-2")!
    const scenes1Before = api.listDisplayScenes(unit1.id)
    const scenes2Before = api.listDisplayScenes(unit2.id)
    const settings1Before = api.getDisplaySettings(unit1.id)
    const settings2Before = api.getDisplaySettings(unit2.id)

    const assetInsert = db
      .prepare(
        `INSERT INTO display_assets (
          title, file_url, file_type, original_name, mime_type, layout_type
        ) VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        "shared-image",
        "/uploads/display/shared.png",
        "image",
        "shared.png",
        "image/png",
        "full",
      )
    const assetId = Number(assetInsert.lastInsertRowid)

    const created = api.createDisplayUnit({ name: "전광판 3" })
    expect(created.code).toBe("display-3")
    const scenes3 = api.listDisplayScenes(created.id)
    expect(scenes3).toHaveLength(4)

    const fullScene = scenes3.find((scene) => scene.mode === "media_full")!
    db.prepare(
      "UPDATE display_scenes SET media_full_file_id = ? WHERE id = ?",
    ).run(assetId, fullScene.id)

    const deleted = api.deleteDisplayUnitByCode("display-3")
    expect(deleted.code).toBe("display-3")
    expect(api.getDisplayUnitByCode("display-3")).toBeNull()

    const remainingScenes3 = db
      .prepare(
        "SELECT COUNT(*) AS count FROM display_scenes WHERE display_unit_id = ?",
      )
      .get(created.id) as { count: number }
    const remainingSettings3 = db
      .prepare(
        "SELECT COUNT(*) AS count FROM display_settings WHERE display_unit_id = ?",
      )
      .get(created.id) as { count: number }

    expect(remainingScenes3.count).toBe(0)
    expect(remainingSettings3.count).toBe(0)

    const assetRow = db
      .prepare("SELECT id, title FROM display_assets WHERE id = ?")
      .get(assetId) as { id: number; title: string } | undefined
    expect(assetRow?.title).toBe("shared-image")

    expect(api.listDisplayScenes(unit1.id)).toHaveLength(scenes1Before.length)
    expect(api.listDisplayScenes(unit2.id)).toHaveLength(scenes2Before.length)
    expect(api.getDisplaySettings(unit1.id).mode).toBe(settings1Before.mode)
    expect(api.getDisplaySettings(unit2.id).mode).toBe(settings2Before.mode)
    expect(api.getDisplaySettings(unit1.id).current_scene_id).toBe(
      settings1Before.current_scene_id,
    )
    expect(api.getDisplaySettings(unit2.id).current_scene_id).toBe(
      settings2Before.current_scene_id,
    )
  })

  it("rejects invalid unit codes for hard-delete", async () => {
    const api = await loadWithTempDb()
    expect(() => api.deleteDisplayUnitByCode("not-a-unit")).toThrow(
      /올바르지 않은 전광판 코드/,
    )
    expect(() => api.deleteDisplayUnitByCode("display-999")).toThrow(
      /찾을 수 없습니다/,
    )
  })

  it("DELETE API returns 403 for protected units and 400/404 for bad codes", async () => {
    await loadWithTempDb()
    const route = await import("@/app/api/admin/display-units/[code]/route")

    const protectedRes = await route.DELETE(new Request("http://localhost"), {
      params: Promise.resolve({ code: "display-1" }),
    })
    expect(protectedRes.status).toBe(403)
    const protectedJson = (await protectedRes.json()) as { error?: string }
    expect(protectedJson.error).toBe("기본 전광판은 삭제할 수 없습니다.")

    const protected2 = await route.DELETE(new Request("http://localhost"), {
      params: Promise.resolve({ code: "display-2" }),
    })
    expect(protected2.status).toBe(403)

    const invalid = await route.DELETE(new Request("http://localhost"), {
      params: Promise.resolve({ code: "bad-code" }),
    })
    expect(invalid.status).toBe(400)

    const missing = await route.DELETE(new Request("http://localhost"), {
      params: Promise.resolve({ code: "display-999" }),
    })
    expect(missing.status).toBe(404)
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
