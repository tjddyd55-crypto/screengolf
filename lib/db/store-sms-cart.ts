import { getDb } from "@/lib/db/sqlite"
import {
  getStoreGoogleContactsByIds,
  listStoreGoogleContacts,
  type StoreGoogleContact,
  type StoreGoogleContactListQuery,
} from "@/lib/db/store-google-contacts"

export type StoreSmsCart = {
  id: number
  cart_key: string
  name: string | null
  status: "active" | "converted" | "expired"
  created_at: string
  updated_at: string
  expires_at: string | null
}

export function getOrCreateActiveCart(cartKey: string): StoreSmsCart {
  const db = getDb()
  const existing = db
    .prepare(
      `SELECT id, cart_key, name, status, created_at, updated_at, expires_at
       FROM store_sms_contact_carts
       WHERE cart_key = ? AND status = 'active'`,
    )
    .get(cartKey) as StoreSmsCart | undefined

  if (existing) return existing

  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
  const result = db
    .prepare(
      `INSERT INTO store_sms_contact_carts (cart_key, status, expires_at)
       VALUES (?, 'active', ?)`,
    )
    .run(cartKey, expiresAt)

  return db
    .prepare(
      `SELECT id, cart_key, name, status, created_at, updated_at, expires_at
       FROM store_sms_contact_carts WHERE id = ?`,
    )
    .get(Number(result.lastInsertRowid)) as StoreSmsCart
}

export function countCartItems(cartId: number): number {
  const row = getDb()
    .prepare(
      `SELECT COUNT(*) AS c FROM store_sms_contact_cart_items WHERE cart_id = ?`,
    )
    .get(cartId) as { c: number }
  return row.c
}

export function listCartContactIds(cartId: number): number[] {
  const rows = getDb()
    .prepare(
      `SELECT google_contact_id
       FROM store_sms_contact_cart_items
       WHERE cart_id = ?
       ORDER BY added_at ASC, id ASC`,
    )
    .all(cartId) as Array<{ google_contact_id: number }>
  return rows.map((row) => row.google_contact_id)
}

export function addContactsToCart(
  cartId: number,
  contactIds: number[],
): { added: number; alreadyExists: number; total: number } {
  const unique = [
    ...new Set(contactIds.filter((id) => Number.isInteger(id) && id > 0)),
  ]
  if (unique.length === 0) {
    return { added: 0, alreadyExists: 0, total: countCartItems(cartId) }
  }

  const db = getDb()
  const insert = db.prepare(
    `INSERT OR IGNORE INTO store_sms_contact_cart_items (cart_id, google_contact_id)
     VALUES (?, ?)`,
  )
  let added = 0
  const tx = db.transaction(() => {
    for (const id of unique) {
      const result = insert.run(cartId, id)
      if (result.changes > 0) added += 1
    }
    db.prepare(
      `UPDATE store_sms_contact_carts
       SET updated_at = datetime('now') WHERE id = ?`,
    ).run(cartId)
  })
  tx()

  const total = countCartItems(cartId)
  return {
    added,
    alreadyExists: unique.length - added,
    total,
  }
}

export function addFilteredContactsToCart(
  cartId: number,
  filter: StoreGoogleContactListQuery,
): {
  matched: number
  added: number
  alreadyExists: number
  total: number
} {
  const contacts = listStoreGoogleContacts(filter)
  const ids = contacts.map((contact) => contact.id)
  const result = addContactsToCart(cartId, ids)
  return {
    matched: ids.length,
    added: result.added,
    alreadyExists: result.alreadyExists,
    total: result.total,
  }
}

export function removeCartItem(cartId: number, contactId: number): boolean {
  const result = getDb()
    .prepare(
      `DELETE FROM store_sms_contact_cart_items
       WHERE cart_id = ? AND google_contact_id = ?`,
    )
    .run(cartId, contactId)
  if (result.changes > 0) {
    getDb()
      .prepare(
        `UPDATE store_sms_contact_carts
         SET updated_at = datetime('now') WHERE id = ?`,
      )
      .run(cartId)
  }
  return result.changes > 0
}

export function removeCartItems(cartId: number, contactIds: number[]): number {
  if (contactIds.length === 0) return 0
  const db = getDb()
  const del = db.prepare(
    `DELETE FROM store_sms_contact_cart_items
     WHERE cart_id = ? AND google_contact_id = ?`,
  )
  let removed = 0
  const tx = db.transaction(() => {
    for (const id of contactIds) {
      removed += del.run(cartId, id).changes
    }
    db.prepare(
      `UPDATE store_sms_contact_carts
       SET updated_at = datetime('now') WHERE id = ?`,
    ).run(cartId)
  })
  tx()
  return removed
}

export function clearCart(cartId: number): number {
  const result = getDb()
    .prepare(`DELETE FROM store_sms_contact_cart_items WHERE cart_id = ?`)
    .run(cartId)
  getDb()
    .prepare(
      `UPDATE store_sms_contact_carts
       SET updated_at = datetime('now') WHERE id = ?`,
    )
    .run(cartId)
  return result.changes
}

export function replaceCartWithContacts(
  cartId: number,
  contactIds: number[],
): { total: number } {
  const db = getDb()
  const tx = db.transaction(() => {
    db.prepare(`DELETE FROM store_sms_contact_cart_items WHERE cart_id = ?`).run(
      cartId,
    )
    const insert = db.prepare(
      `INSERT INTO store_sms_contact_cart_items (cart_id, google_contact_id)
       VALUES (?, ?)`,
    )
    for (const id of [...new Set(contactIds)]) {
      if (Number.isInteger(id) && id > 0) insert.run(cartId, id)
    }
    db.prepare(
      `UPDATE store_sms_contact_carts
       SET updated_at = datetime('now') WHERE id = ?`,
    ).run(cartId)
  })
  tx()
  return { total: countCartItems(cartId) }
}

export function listCartItemsPage(
  cartId: number,
  options?: { query?: string; page?: number; pageSize?: number },
): {
  data: StoreGoogleContact[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
} {
  const ids = listCartContactIds(cartId)
  const page = Math.max(1, Math.floor(options?.page ?? 1))
  const allowed = new Set([30, 50, 100])
  const pageSize = allowed.has(options?.pageSize ?? 50)
    ? (options?.pageSize as number)
    : 50

  let contacts = getStoreGoogleContactsByIds(ids)
  const order = new Map(ids.map((id, index) => [id, index]))
  contacts.sort(
    (a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0),
  )

  const q = options?.query?.trim().toLowerCase()
  if (q) {
    contacts = contacts.filter((contact) => {
      const hay = `${contact.name} ${contact.nickname ?? ""} ${contact.phone}`
        .toLowerCase()
      return hay.includes(q)
    })
  }

  const total = contacts.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
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
  }
}

/** Used only for type re-export convenience in callers */
export type { StoreGoogleContactListQuery }
