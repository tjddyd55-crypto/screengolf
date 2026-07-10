import { getDb } from "./sqlite"
import {
  assertActivePlanType,
  getPlanTypeById,
  type StorePlanType,
} from "./store-plan-types"
import {
  calcRemainingDays,
  formatRemainingDays,
  getRemainingDaysStatus,
} from "@/lib/admin/member-utils"

export type StoreMember = {
  id: number
  name: string
  nickname: string | null
  phone: string | null
  plan_type_id: number | null
  plan_type: string | null
  plan_name: string | null
  expires_at: string | null
  memo: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export type StoreMemberView = StoreMember & {
  remaining_days: number | null
  remaining_label: string
  remaining_status: "normal" | "warning" | "expired"
}

type MemberRow = {
  id: number
  name: string
  nickname: string | null
  phone: string | null
  plan_type_id: number | null
  plan_type: string | null
  plan_name: string | null
  expires_at: string | null
  memo: string | null
  is_active: number
  created_at: string
  updated_at: string
}

export type MemberFilter =
  | "all"
  | "active"
  | "expired"
  | { type: "plan"; id: number }

const MEMBER_SELECT = `
  SELECT
    m.id,
    m.name,
    m.nickname,
    m.phone,
    m.plan_type_id,
    COALESCE(pt.code, m.plan_type) AS plan_type,
    pt.name AS plan_name,
    m.expires_at,
    m.memo,
    m.is_active,
    m.created_at,
    m.updated_at
  FROM store_members m
  LEFT JOIN store_plan_types pt ON pt.id = m.plan_type_id
`

function mapMember(row: MemberRow): StoreMember {
  return {
    ...row,
    is_active: row.is_active === 1,
  }
}

function toMemberView(member: StoreMember): StoreMemberView {
  return {
    ...member,
    remaining_days: calcRemainingDays(member.expires_at),
    remaining_label: formatRemainingDays(member.expires_at),
    remaining_status: getRemainingDaysStatus(member.expires_at),
  }
}

export function listMembers(options?: {
  search?: string
  filter?: MemberFilter
}): StoreMemberView[] {
  const conditions: string[] = []
  const params: (string | number)[] = []

  const search = options?.search?.trim()
  if (search) {
    conditions.push("(m.name LIKE ? OR m.nickname LIKE ? OR m.phone LIKE ?)")
    const pattern = `%${search}%`
    params.push(pattern, pattern, pattern)
  }

  const filter = options?.filter ?? "all"
  if (filter === "active") {
    conditions.push("m.is_active = 1")
    conditions.push(
      "(m.expires_at IS NULL OR date(m.expires_at) >= date('now', 'localtime'))",
    )
  } else if (filter === "expired") {
    conditions.push(
      "(m.expires_at IS NOT NULL AND date(m.expires_at) < date('now', 'localtime'))",
    )
  } else if (typeof filter === "object" && filter.type === "plan") {
    conditions.push("m.plan_type_id = ?")
    params.push(filter.id)
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : ""

  const rows = getDb()
    .prepare(
      `${MEMBER_SELECT}
       ${whereClause}
       ORDER BY m.is_active DESC, m.expires_at ASC, m.name ASC`,
    )
    .all(...params) as MemberRow[]

  return rows.map((row) => toMemberView(mapMember(row)))
}

export function getMemberById(id: number): StoreMember | null {
  const row = getDb()
    .prepare(`${MEMBER_SELECT} WHERE m.id = ?`)
    .get(id) as MemberRow | undefined

  return row ? mapMember(row) : null
}

function resolvePlanType(planTypeId: number): StorePlanType {
  return assertActivePlanType(planTypeId)
}

export function createMember(input: {
  name: string
  nickname?: string | null
  phone?: string | null
  plan_type_id: number
  expires_at?: string | null
  memo?: string | null
  is_active?: boolean
}): StoreMember {
  const planType = resolvePlanType(input.plan_type_id)

  const result = getDb()
    .prepare(
      `INSERT INTO store_members (
        name, nickname, phone, plan_type, plan_type_id, expires_at, memo, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.name,
      input.nickname ?? null,
      input.phone ?? null,
      planType.code,
      planType.id,
      input.expires_at ?? null,
      input.memo ?? null,
      (input.is_active ?? true) ? 1 : 0,
    )

  const member = getMemberById(Number(result.lastInsertRowid))
  if (!member) throw new Error("회원 생성 후 조회에 실패했습니다.")
  return member
}

export function updateMember(
  id: number,
  input: Partial<{
    name: string
    nickname: string | null
    phone: string | null
    plan_type_id: number
    expires_at: string | null
    memo: string | null
    is_active: boolean
  }>,
): StoreMember | null {
  const current = getMemberById(id)
  if (!current) return null

  let planTypeId = current.plan_type_id
  let planTypeCode = current.plan_type

  if (input.plan_type_id !== undefined) {
    const planType = getPlanTypeById(input.plan_type_id)
    if (!planType) {
      throw new Error("요금제를 찾을 수 없습니다.")
    }

    if (!planType.is_active && input.plan_type_id !== current.plan_type_id) {
      throw new Error("비활성 요금제는 선택할 수 없습니다.")
    }

    planTypeId = planType.id
    planTypeCode = planType.code
  }

  getDb()
    .prepare(
      `UPDATE store_members
       SET name = ?, nickname = ?, phone = ?, plan_type = ?, plan_type_id = ?,
           expires_at = ?, memo = ?, is_active = ?, updated_at = datetime('now')
       WHERE id = ?`,
    )
    .run(
      input.name ?? current.name,
      input.nickname !== undefined ? input.nickname : current.nickname,
      input.phone !== undefined ? input.phone : current.phone,
      planTypeCode,
      planTypeId,
      input.expires_at !== undefined ? input.expires_at : current.expires_at,
      input.memo !== undefined ? input.memo : current.memo,
      (input.is_active ?? current.is_active) ? 1 : 0,
      id,
    )

  return getMemberById(id)
}

export function deactivateMember(id: number): boolean {
  const result = getDb()
    .prepare(
      "UPDATE store_members SET is_active = 0, updated_at = datetime('now') WHERE id = ?",
    )
    .run(id)

  return result.changes > 0
}
