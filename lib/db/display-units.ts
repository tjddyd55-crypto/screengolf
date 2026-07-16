import { getDb } from "./sqlite"
import type { DisplayMode } from "@/lib/admin/constants"

export const DEFAULT_DISPLAY_UNIT_CODE = "display-1"

export type DisplayUnit = {
  id: number
  name: string
  code: string
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

type UnitRow = {
  id: number
  name: string
  code: string
  sort_order: number
  is_active: number
  created_at: string
  updated_at: string
}

const DEFAULT_UNIT_SCENES: Array<{
  name: string
  mode: DisplayMode
  sort_order: number
}> = [
  { name: "랭킹 화면", mode: "ranking", sort_order: 1 },
  { name: "공지사항 화면", mode: "notice", sort_order: 2 },
  { name: "가로 전체 화면", mode: "media_full", sort_order: 3 },
  { name: "세로 2분할 화면", mode: "media_split", sort_order: 4 },
]

function mapUnit(row: UnitRow): DisplayUnit {
  return {
    ...row,
    is_active: row.is_active === 1,
  }
}

export function listDisplayUnits(options?: {
  activeOnly?: boolean
}): DisplayUnit[] {
  const rows = getDb()
    .prepare(
      `SELECT id, name, code, sort_order, is_active, created_at, updated_at
       FROM display_units
       ${options?.activeOnly ? "WHERE is_active = 1" : ""}
       ORDER BY sort_order ASC, id ASC`,
    )
    .all() as UnitRow[]

  return rows.map(mapUnit)
}

export function getDisplayUnitById(id: number): DisplayUnit | null {
  const row = getDb()
    .prepare(
      `SELECT id, name, code, sort_order, is_active, created_at, updated_at
       FROM display_units WHERE id = ?`,
    )
    .get(id) as UnitRow | undefined

  return row ? mapUnit(row) : null
}

export function getDisplayUnitByCode(code: string): DisplayUnit | null {
  const row = getDb()
    .prepare(
      `SELECT id, name, code, sort_order, is_active, created_at, updated_at
       FROM display_units WHERE code = ?`,
    )
    .get(code) as UnitRow | undefined

  return row ? mapUnit(row) : null
}

export function getDefaultDisplayUnit(): DisplayUnit {
  const unit = getDisplayUnitByCode(DEFAULT_DISPLAY_UNIT_CODE)
  if (!unit) {
    throw new Error("기본 전광판(display-1)을 찾을 수 없습니다.")
  }
  return unit
}

function nextDisplayUnitCode(): string {
  const codes = getDb()
    .prepare("SELECT code FROM display_units")
    .all() as { code: string }[]

  let max = 0
  for (const row of codes) {
    const match = /^display-(\d+)$/.exec(row.code)
    if (match) {
      max = Math.max(max, Number(match[1]))
    }
  }
  return `display-${max + 1}`
}

function seedDefaultScenesForUnit(unitId: number): number {
  const insertScene = getDb().prepare(`
    INSERT INTO display_scenes (
      display_unit_id, name, mode, notice_id, media_full_file_id,
      media_left_file_id, media_right_file_id, sort_order, is_active
    ) VALUES (?, ?, ?, NULL, NULL, NULL, NULL, ?, 1)
  `)

  let rankingSceneId = 0
  for (const scene of DEFAULT_UNIT_SCENES) {
    const result = insertScene.run(
      unitId,
      scene.name,
      scene.mode,
      scene.sort_order,
    )
    if (scene.mode === "ranking") {
      rankingSceneId = Number(result.lastInsertRowid)
    }
  }
  return rankingSceneId
}

function createUnitSettings(unitId: number, currentSceneId: number | null): void {
  getDb()
    .prepare(
      `INSERT INTO display_settings (
        display_unit_id, mode, current_scene_id, active_notice_id
      ) VALUES (?, 'ranking', ?, NULL)`,
    )
    .run(unitId, currentSceneId)
}

export function createDisplayUnit(input?: {
  name?: string
  code?: string
  sort_order?: number
}): DisplayUnit {
  const code = input?.code?.trim() || nextDisplayUnitCode()
  if (!/^display-\d+$/.test(code)) {
    throw new Error("전광판 코드는 display-숫자 형식이어야 합니다.")
  }

  if (getDisplayUnitByCode(code)) {
    throw new Error("이미 존재하는 전광판 코드입니다.")
  }

  const maxSort = getDb()
    .prepare(
      "SELECT COALESCE(MAX(sort_order), 0) AS max_order FROM display_units",
    )
    .get() as { max_order: number }

  const name =
    input?.name?.trim() || `전광판 ${code.replace("display-", "")}`
  const sortOrder = input?.sort_order ?? maxSort.max_order + 1

  const create = getDb().transaction(() => {
    const result = getDb()
      .prepare(
        `INSERT INTO display_units (name, code, sort_order, is_active)
         VALUES (?, ?, ?, 1)`,
      )
      .run(name, code, sortOrder)

    const unitId = Number(result.lastInsertRowid)
    const rankingSceneId = seedDefaultScenesForUnit(unitId)
    createUnitSettings(unitId, rankingSceneId)
    return unitId
  })

  const unitId = create()
  const unit = getDisplayUnitById(unitId)
  if (!unit) throw new Error("전광판 생성 후 조회에 실패했습니다.")
  return unit
}

export function updateDisplayUnit(
  id: number,
  input: Partial<{
    name: string
    sort_order: number
    is_active: boolean
  }>,
): DisplayUnit | null {
  const current = getDisplayUnitById(id)
  if (!current) return null

  if (
    current.code === DEFAULT_DISPLAY_UNIT_CODE &&
    input.is_active === false
  ) {
    throw new Error("기본 전광판(display-1)은 비활성할 수 없습니다.")
  }

  getDb()
    .prepare(
      `UPDATE display_units
       SET name = ?, sort_order = ?, is_active = ?, updated_at = datetime('now')
       WHERE id = ?`,
    )
    .run(
      input.name?.trim() || current.name,
      input.sort_order ?? current.sort_order,
      (input.is_active ?? current.is_active) ? 1 : 0,
      id,
    )

  return getDisplayUnitById(id)
}

export function deactivateDisplayUnit(id: number): boolean {
  const current = getDisplayUnitById(id)
  if (!current) return false

  if (current.code === DEFAULT_DISPLAY_UNIT_CODE) {
    throw new Error("기본 전광판(display-1)은 삭제할 수 없습니다.")
  }

  const result = getDb()
    .prepare(
      `UPDATE display_units
       SET is_active = 0, updated_at = datetime('now')
       WHERE id = ?`,
    )
    .run(id)

  return result.changes > 0
}

export function resolveUnitId(
  unitCodeOrId?: string | number | null,
): number {
  if (typeof unitCodeOrId === "number") {
    const unit = getDisplayUnitById(unitCodeOrId)
    if (!unit) throw new Error("전광판을 찾을 수 없습니다.")
    return unit.id
  }

  if (typeof unitCodeOrId === "string" && unitCodeOrId.trim()) {
    const unit = getDisplayUnitByCode(unitCodeOrId.trim())
    if (!unit) throw new Error("전광판을 찾을 수 없습니다.")
    return unit.id
  }

  return getDefaultDisplayUnit().id
}
