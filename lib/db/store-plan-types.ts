import { getDb } from "./sqlite"

export type StorePlanType = {
  id: number
  name: string
  code: string
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

type PlanTypeRow = {
  id: number
  name: string
  code: string
  sort_order: number
  is_active: number
  created_at: string
  updated_at: string
}

function mapPlanType(row: PlanTypeRow): StorePlanType {
  return {
    ...row,
    is_active: row.is_active === 1,
  }
}

export function listPlanTypes(options?: {
  activeOnly?: boolean
}): StorePlanType[] {
  const activeOnly = options?.activeOnly ?? false
  const whereClause = activeOnly ? "WHERE is_active = 1" : ""

  const rows = getDb()
    .prepare(
      `SELECT id, name, code, sort_order, is_active, created_at, updated_at
       FROM store_plan_types
       ${whereClause}
       ORDER BY sort_order ASC, id ASC`,
    )
    .all() as PlanTypeRow[]

  return rows.map(mapPlanType)
}

export function getPlanTypeById(id: number): StorePlanType | null {
  const row = getDb()
    .prepare(
      `SELECT id, name, code, sort_order, is_active, created_at, updated_at
       FROM store_plan_types WHERE id = ?`,
    )
    .get(id) as PlanTypeRow | undefined

  return row ? mapPlanType(row) : null
}

export function getPlanTypeByCode(code: string): StorePlanType | null {
  const row = getDb()
    .prepare(
      `SELECT id, name, code, sort_order, is_active, created_at, updated_at
       FROM store_plan_types WHERE code = ?`,
    )
    .get(code) as PlanTypeRow | undefined

  return row ? mapPlanType(row) : null
}

export function createPlanType(input: {
  name: string
  code: string
  sort_order?: number
  is_active?: boolean
}): StorePlanType {
  const existingCode = getPlanTypeByCode(input.code)
  if (existingCode) {
    throw new Error("이미 사용 중인 요금제 코드입니다.")
  }

  const maxSortOrder = getDb()
    .prepare("SELECT COALESCE(MAX(sort_order), 0) AS max_order FROM store_plan_types")
    .get() as { max_order: number }

  const result = getDb()
    .prepare(
      `INSERT INTO store_plan_types (name, code, sort_order, is_active)
       VALUES (?, ?, ?, ?)`,
    )
    .run(
      input.name,
      input.code,
      input.sort_order ?? maxSortOrder.max_order + 1,
      (input.is_active ?? true) ? 1 : 0,
    )

  const planType = getPlanTypeById(Number(result.lastInsertRowid))
  if (!planType) throw new Error("요금제 생성 후 조회에 실패했습니다.")
  return planType
}

export function updatePlanType(
  id: number,
  input: Partial<{
    name: string
    sort_order: number
    is_active: boolean
  }>,
): StorePlanType | null {
  const current = getPlanTypeById(id)
  if (!current) return null

  getDb()
    .prepare(
      `UPDATE store_plan_types
       SET name = ?, sort_order = ?, is_active = ?, updated_at = datetime('now')
       WHERE id = ?`,
    )
    .run(
      input.name ?? current.name,
      input.sort_order ?? current.sort_order,
      (input.is_active ?? current.is_active) ? 1 : 0,
      id,
    )

  return getPlanTypeById(id)
}

export function deactivatePlanType(id: number): boolean {
  const result = getDb()
    .prepare(
      "UPDATE store_plan_types SET is_active = 0, updated_at = datetime('now') WHERE id = ?",
    )
    .run(id)

  return result.changes > 0
}

export function assertActivePlanType(id: number): StorePlanType {
  const planType = getPlanTypeById(id)
  if (!planType) {
    throw new Error("요금제를 찾을 수 없습니다.")
  }
  if (!planType.is_active) {
    throw new Error("비활성 요금제는 선택할 수 없습니다.")
  }
  return planType
}
