import { describe, expect, it } from "vitest"
import {
  formatStoreSmsExclusionCounts,
  storeSmsExclusionLabel,
} from "@/lib/store-sms/store-sms-exclusion-labels"
import { addContactsToCart, getOrCreateActiveCart } from "@/lib/db/store-sms-cart"
import { getDb } from "@/lib/db/sqlite"
import { randomUUID } from "node:crypto"

describe("store-sms exclusion labels", () => {
  it("maps internal reasons to Korean labels", () => {
    expect(storeSmsExclusionLabel("invalid_phone")).toBe("잘못된 전화번호")
    expect(storeSmsExclusionLabel("sms_opt_out")).toBe("문자 수신거부")
    expect(storeSmsExclusionLabel("duplicate_phone")).toBe("중복 전화번호")
  })

  it("formats exclusion count cards", () => {
    const rows = formatStoreSmsExclusionCounts({
      invalid_phone: 19,
      sms_opt_out: 3,
    })
    expect(rows[0]).toEqual({
      reason: "invalid_phone",
      label: "잘못된 전화번호",
      count: 19,
    })
    expect(rows).toHaveLength(2)
  })
})

describe("store-sms cart persistence", () => {
  it("deduplicates contacts in the same cart", () => {
    const db = getDb()
    db.exec(`
      INSERT OR IGNORE INTO store_google_contacts (
        id, google_resource_name, name, phone, normalized_phone,
        google_group_name, google_sync_status, is_active, sms_opt_out
      ) VALUES
        (900001, 'people/cart-test-1', 'Cart A', '01011112222', '01011112222', '가자스크린', 'linked', 1, 0),
        (900002, 'people/cart-test-2', 'Cart B', '01033334444', '01033334444', '가자스크린', 'linked', 1, 0)
    `)

    const cart = getOrCreateActiveCart(`test-${randomUUID()}`)
    const first = addContactsToCart(cart.id, [900001, 900002])
    const second = addContactsToCart(cart.id, [900001])
    expect(first.added).toBe(2)
    expect(second.added).toBe(0)
    expect(second.alreadyExists).toBe(1)
    expect(second.total).toBe(2)
  })
})
