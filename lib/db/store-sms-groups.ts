import { getDb } from "@/lib/db/sqlite"
import {
  getStoreGoogleContactsByIds,
  type StoreGoogleContact,
} from "@/lib/db/store-google-contacts"
import { summarizeStoreSmsTarget } from "@/lib/store-sms/store-sms-targets"

export type StoreSmsContactGroup = {
  id: number
  name: string
  description: string | null
  is_active: boolean
  member_count: number
  created_at: string
  updated_at: string
}

type GroupRow = {
  id: number
  name: string
  description: string | null
  is_active: number
  member_count: number
  created_at: string
  updated_at: string
}

function mapGroup(row: GroupRow): StoreSmsContactGroup {
  return {
    ...row,
    is_active: row.is_active === 1,
  }
}

export function listStoreSmsContactGroups(options?: {
  includeInactive?: boolean
}): StoreSmsContactGroup[] {
  const rows = getDb()
    .prepare(
      `SELECT id, name, description, is_active, member_count, created_at, updated_at
       FROM store_sms_contact_groups
       ${options?.includeInactive ? "" : "WHERE is_active = 1"}
       ORDER BY updated_at DESC, id DESC`,
    )
    .all() as GroupRow[]
  return rows.map(mapGroup)
}

export function getStoreSmsContactGroup(
  id: number,
): StoreSmsContactGroup | null {
  const row = getDb()
    .prepare(
      `SELECT id, name, description, is_active, member_count, created_at, updated_at
       FROM store_sms_contact_groups WHERE id = ?`,
    )
    .get(id) as GroupRow | undefined
  return row ? mapGroup(row) : null
}

export function findStoreSmsContactGroupByName(
  name: string,
): StoreSmsContactGroup | null {
  const row = getDb()
    .prepare(
      `SELECT id, name, description, is_active, member_count, created_at, updated_at
       FROM store_sms_contact_groups
       WHERE lower(name) = lower(?) AND is_active = 1`,
    )
    .get(name.trim()) as GroupRow | undefined
  return row ? mapGroup(row) : null
}

export function listGroupMemberIds(groupId: number): number[] {
  const rows = getDb()
    .prepare(
      `SELECT google_contact_id
       FROM store_sms_contact_group_members
       WHERE group_id = ?
       ORDER BY id ASC`,
    )
    .all(groupId) as Array<{ google_contact_id: number }>
  return rows.map((row) => row.google_contact_id)
}

function refreshMemberCount(groupId: number): number {
  const row = getDb()
    .prepare(
      `SELECT COUNT(*) AS c FROM store_sms_contact_group_members WHERE group_id = ?`,
    )
    .get(groupId) as { c: number }
  getDb()
    .prepare(
      `UPDATE store_sms_contact_groups
       SET member_count = ?, updated_at = datetime('now')
       WHERE id = ?`,
    )
    .run(row.c, groupId)
  return row.c
}

export function createStoreSmsContactGroup(input: {
  name: string
  description?: string | null
  contactIds: number[]
}): number {
  const name = input.name.trim()
  if (!name) throw new Error("name_required")
  if (findStoreSmsContactGroupByName(name)) throw new Error("name_duplicate")

  const db = getDb()
  const result = db
    .prepare(
      `INSERT INTO store_sms_contact_groups (name, description, is_active, member_count)
       VALUES (?, ?, 1, 0)`,
    )
    .run(name, input.description?.trim() || null)

  const groupId = Number(result.lastInsertRowid)
  const insert = db.prepare(
    `INSERT OR IGNORE INTO store_sms_contact_group_members (group_id, google_contact_id)
     VALUES (?, ?)`,
  )
  const tx = db.transaction(() => {
    for (const id of [...new Set(input.contactIds)]) {
      if (Number.isInteger(id) && id > 0) insert.run(groupId, id)
    }
  })
  tx()
  refreshMemberCount(groupId)
  return groupId
}

export function updateStoreSmsContactGroup(
  id: number,
  input: Partial<{
    name: string
    description: string | null
    is_active: boolean
  }>,
): StoreSmsContactGroup | null {
  const current = getStoreSmsContactGroup(id)
  if (!current) return null

  if (input.name != null) {
    const nextName = input.name.trim()
    if (!nextName) throw new Error("name_required")
    const dup = findStoreSmsContactGroupByName(nextName)
    if (dup && dup.id !== id) throw new Error("name_duplicate")
  }

  getDb()
    .prepare(
      `UPDATE store_sms_contact_groups
       SET name = ?,
           description = ?,
           is_active = ?,
           updated_at = datetime('now')
       WHERE id = ?`,
    )
    .run(
      input.name != null ? input.name.trim() : current.name,
      input.description !== undefined
        ? input.description?.trim() || null
        : current.description,
      (input.is_active ?? current.is_active) ? 1 : 0,
      id,
    )

  return getStoreSmsContactGroup(id)
}

export function softDeleteStoreSmsContactGroup(id: number): boolean {
  const result = getDb()
    .prepare(
      `UPDATE store_sms_contact_groups
       SET is_active = 0, updated_at = datetime('now')
       WHERE id = ? AND is_active = 1`,
    )
    .run(id)
  return result.changes === 1
}

export function replaceGroupMembers(
  groupId: number,
  contactIds: number[],
): number {
  const db = getDb()
  const tx = db.transaction(() => {
    db.prepare(
      `DELETE FROM store_sms_contact_group_members WHERE group_id = ?`,
    ).run(groupId)
    const insert = db.prepare(
      `INSERT OR IGNORE INTO store_sms_contact_group_members (group_id, google_contact_id)
       VALUES (?, ?)`,
    )
    for (const id of [...new Set(contactIds)]) {
      if (Number.isInteger(id) && id > 0) insert.run(groupId, id)
    }
  })
  tx()
  return refreshMemberCount(groupId)
}

export function removeGroupMember(groupId: number, contactId: number): boolean {
  const result = getDb()
    .prepare(
      `DELETE FROM store_sms_contact_group_members
       WHERE group_id = ? AND google_contact_id = ?`,
    )
    .run(groupId, contactId)
  if (result.changes > 0) refreshMemberCount(groupId)
  return result.changes > 0
}

export function listGroupMembersPage(
  groupId: number,
  options?: { query?: string; page?: number; pageSize?: number },
): {
  data: StoreGoogleContact[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
  sendableEstimate: number
} {
  const ids = listGroupMemberIds(groupId)
  const page = Math.max(1, Math.floor(options?.page ?? 1))
  const allowed = new Set([30, 50, 100])
  const pageSize = allowed.has(options?.pageSize ?? 50)
    ? (options?.pageSize as number)
    : 50

  let contacts = getStoreGoogleContactsByIds(ids)
  const order = new Map(ids.map((id, index) => [id, index]))
  contacts.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))

  const q = options?.query?.trim().toLowerCase()
  if (q) {
    contacts = contacts.filter((contact) => {
      const hay = `${contact.name} ${contact.nickname ?? ""} ${contact.phone}`
        .toLowerCase()
      return hay.includes(q)
    })
  }

  const summary = summarizeStoreSmsTarget({
    type: "selected",
    contactIds: ids,
  })

  const total = contacts.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1)
  const safePage = Math.min(page, totalPages)
  const start = (safePage - 1) * pageSize

  return {
    data: contacts.slice(start, start + pageSize),
    pagination: {
      page: safePage,
      pageSize,
      total,
      totalPages,
    },
    sendableEstimate: summary.sendable,
  }
}

export function duplicateStoreSmsContactGroup(id: number): number {
  const group = getStoreSmsContactGroup(id)
  if (!group) throw new Error("group_not_found")
  const ids = listGroupMemberIds(id)
  let name = `${group.name} 복사`
  let suffix = 2
  while (findStoreSmsContactGroupByName(name)) {
    name = `${group.name} 복사 ${suffix}`
    suffix += 1
  }
  return createStoreSmsContactGroup({
    name,
    description: group.description,
    contactIds: ids,
  })
}
