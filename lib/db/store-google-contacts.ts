import { getDb } from "@/lib/db/sqlite"
import type { MappedGoogleContact } from "@/lib/google-contacts/google-contact-mapper"
import { normalizePhone } from "@/lib/google-contacts/phone"

export type StoreGoogleContact = {
  id: number
  google_resource_name: string
  google_contact_etag: string | null
  name: string
  nickname: string | null
  phone: string
  normalized_phone: string
  google_group_name: string
  google_sync_status: string
  is_active: boolean
  memo: string | null
  sms_opt_out: boolean
  last_synced_at: string | null
  created_at: string
  updated_at: string
}

type ContactRow = {
  id: number
  google_resource_name: string
  google_contact_etag: string | null
  name: string
  nickname: string | null
  phone: string
  normalized_phone: string
  google_group_name: string
  google_sync_status: string
  is_active: number
  memo: string | null
  sms_opt_out: number
  last_synced_at: string | null
  created_at: string
  updated_at: string
}

export type GoogleContactFilter =
  | "all"
  | "linked"
  | "not_in_group"
  | "conflict"
  | "missing_phone"
  | "sms_opt_out"

function mapContact(row: ContactRow): StoreGoogleContact {
  return {
    ...row,
    is_active: row.is_active === 1,
    sms_opt_out: row.sms_opt_out === 1,
  }
}

const SELECT = `
  SELECT id, google_resource_name, google_contact_etag, name, nickname, phone,
         normalized_phone, google_group_name, google_sync_status, is_active,
         memo, sms_opt_out, last_synced_at, created_at, updated_at
  FROM store_google_contacts
`

export function listStoreGoogleContacts(options?: {
  search?: string
  filter?: GoogleContactFilter
}): StoreGoogleContact[] {
  const conditions: string[] = []
  const params: string[] = []

  const search = options?.search?.trim()
  if (search) {
    conditions.push("(name LIKE ? OR nickname LIKE ? OR phone LIKE ?)")
    const pattern = `%${search}%`
    params.push(pattern, pattern, pattern)
  }

  const filter = options?.filter ?? "all"
  if (filter === "linked") {
    conditions.push("google_sync_status = 'linked'")
    conditions.push("is_active = 1")
  } else if (filter === "not_in_group") {
    conditions.push("google_sync_status = 'not_in_group'")
  } else if (filter === "conflict") {
    conditions.push("google_sync_status = 'conflict'")
  } else if (filter === "missing_phone") {
    conditions.push("(phone = '' OR normalized_phone = '')")
  } else if (filter === "sms_opt_out") {
    conditions.push("sms_opt_out = 1")
  }

  const where =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : ""

  const rows = getDb()
    .prepare(
      `${SELECT}
       ${where}
       ORDER BY is_active DESC, name ASC, id ASC`,
    )
    .all(...params) as ContactRow[]

  return rows.map(mapContact)
}

export function getStoreGoogleContactById(
  id: number,
): StoreGoogleContact | null {
  const row = getDb()
    .prepare(`${SELECT} WHERE id = ?`)
    .get(id) as ContactRow | undefined
  return row ? mapContact(row) : null
}

function findByResourceName(resourceName: string): ContactRow[] {
  return getDb()
    .prepare(`${SELECT} WHERE google_resource_name = ?`)
    .all(resourceName) as ContactRow[]
}

function findByNormalizedPhone(normalizedPhone: string): ContactRow[] {
  const byNorm = getDb()
    .prepare(`${SELECT} WHERE normalized_phone = ?`)
    .all(normalizedPhone) as ContactRow[]
  if (byNorm.length > 0) return byNorm

  const candidates = getDb()
    .prepare(`${SELECT} WHERE phone IS NOT NULL AND phone != ''`)
    .all() as ContactRow[]
  return candidates.filter(
    (row) => normalizePhone(row.phone) === normalizedPhone,
  )
}

export function matchGoogleContactRow(
  contact: MappedGoogleContact,
):
  | { status: "match"; row: ContactRow }
  | { status: "conflict"; count: number }
  | { status: "none" } {
  const byResource = findByResourceName(contact.resourceName)
  if (byResource.length === 1) {
    return { status: "match", row: byResource[0] }
  }
  if (byResource.length > 1) {
    return { status: "conflict", count: byResource.length }
  }

  const byPhone = findByNormalizedPhone(contact.normalizedPhone)
  const unique = new Map(byPhone.map((row) => [row.id, row]))
  if (unique.size === 1) {
    return { status: "match", row: [...unique.values()][0] }
  }
  if (unique.size > 1) {
    return { status: "conflict", count: unique.size }
  }

  return { status: "none" }
}

export function createStoreGoogleContact(
  contact: MappedGoogleContact,
  groupName: string,
): number {
  const result = getDb()
    .prepare(
      `INSERT INTO store_google_contacts (
        google_resource_name, google_contact_etag, name, nickname, phone,
        normalized_phone, google_group_name, google_sync_status, is_active,
        memo, sms_opt_out, last_synced_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'linked', 1, NULL, 0, datetime('now'))`,
    )
    .run(
      contact.resourceName,
      contact.etag,
      contact.name,
      contact.nickname,
      contact.phone,
      contact.normalizedPhone,
      groupName,
    )

  return Number(result.lastInsertRowid)
}

export function updateStoreGoogleContactFromSync(
  id: number,
  contact: MappedGoogleContact,
  groupName: string,
): "updated" | "unchanged" {
  const current = getDb()
    .prepare(
      `SELECT name, nickname, phone, normalized_phone, google_resource_name,
              google_contact_etag, google_group_name, google_sync_status
       FROM store_google_contacts WHERE id = ?`,
    )
    .get(id) as
    | {
        name: string
        nickname: string | null
        phone: string
        normalized_phone: string
        google_resource_name: string
        google_contact_etag: string | null
        google_group_name: string
        google_sync_status: string
      }
    | undefined

  if (!current) throw new Error("연락처를 찾을 수 없습니다.")

  const same =
    current.name === contact.name &&
    (current.nickname ?? "") === contact.nickname &&
    current.phone === contact.phone &&
    current.normalized_phone === contact.normalizedPhone &&
    current.google_resource_name === contact.resourceName &&
    (current.google_contact_etag ?? null) === contact.etag &&
    current.google_group_name === groupName &&
    current.google_sync_status === "linked"

  if (same) {
    getDb()
      .prepare(
        `UPDATE store_google_contacts
         SET last_synced_at = datetime('now'),
             google_sync_status = 'linked',
             updated_at = datetime('now')
         WHERE id = ?`,
      )
      .run(id)
    return "unchanged"
  }

  getDb()
    .prepare(
      `UPDATE store_google_contacts
       SET name = ?,
           nickname = ?,
           phone = ?,
           normalized_phone = ?,
           google_resource_name = ?,
           google_contact_etag = ?,
           google_group_name = ?,
           google_sync_status = 'linked',
           last_synced_at = datetime('now'),
           updated_at = datetime('now')
       WHERE id = ?`,
    )
    .run(
      contact.name,
      contact.nickname,
      contact.phone,
      contact.normalizedPhone,
      contact.resourceName,
      contact.etag,
      groupName,
      id,
    )

  return "updated"
}

export function markStoreGoogleContactsNotInGroup(
  seenResourceNames: Set<string>,
): number {
  const linked = getDb()
    .prepare(
      `SELECT id, google_resource_name
       FROM store_google_contacts
       WHERE google_resource_name IS NOT NULL
         AND IFNULL(google_sync_status, '') != 'not_in_group'`,
    )
    .all() as Array<{ id: number; google_resource_name: string }>

  let count = 0
  const update = getDb().prepare(
    `UPDATE store_google_contacts
     SET google_sync_status = 'not_in_group',
         last_synced_at = datetime('now'),
         updated_at = datetime('now')
     WHERE id = ?`,
  )

  for (const row of linked) {
    if (!seenResourceNames.has(row.google_resource_name)) {
      update.run(row.id)
      count += 1
    }
  }

  return count
}

export function markStoreGoogleContactConflict(
  id: number,
): void {
  getDb()
    .prepare(
      `UPDATE store_google_contacts
       SET google_sync_status = 'conflict',
           last_synced_at = datetime('now'),
           updated_at = datetime('now')
       WHERE id = ?`,
    )
    .run(id)
}

export function updateStoreGoogleContactAdmin(
  id: number,
  input: Partial<{
    nickname: string | null
    memo: string | null
    sms_opt_out: boolean
    is_active: boolean
  }>,
): StoreGoogleContact | null {
  const current = getStoreGoogleContactById(id)
  if (!current) return null

  getDb()
    .prepare(
      `UPDATE store_google_contacts
       SET nickname = ?,
           memo = ?,
           sms_opt_out = ?,
           is_active = ?,
           updated_at = datetime('now')
       WHERE id = ?`,
    )
    .run(
      input.nickname !== undefined ? input.nickname : current.nickname,
      input.memo !== undefined ? input.memo : current.memo,
      (input.sms_opt_out ?? current.sms_opt_out) ? 1 : 0,
      (input.is_active ?? current.is_active) ? 1 : 0,
      id,
    )

  return getStoreGoogleContactById(id)
}

export function deactivateStoreGoogleContact(id: number): boolean {
  const result = getDb()
    .prepare(
      `UPDATE store_google_contacts
       SET is_active = 0, updated_at = datetime('now')
       WHERE id = ?`,
    )
    .run(id)
  return result.changes > 0
}

/** production에 Google로 생성된 store_members가 있는지 점검용 */
export function countStoreMembersWithGoogleLink(): number {
  try {
    const row = getDb()
      .prepare(
        `SELECT COUNT(*) AS count FROM store_members
         WHERE google_resource_name IS NOT NULL`,
      )
      .get() as { count: number }
    return row.count
  } catch {
    return 0
  }
}
