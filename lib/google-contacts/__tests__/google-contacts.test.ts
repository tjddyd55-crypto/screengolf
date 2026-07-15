import { describe, expect, it, beforeEach, afterEach } from "vitest"
import {
  formatPhoneForDisplay,
  normalizePhone,
  pickBestPhone,
} from "@/lib/google-contacts/phone"
import { mapGooglePerson } from "@/lib/google-contacts/google-contact-mapper"
import {
  decryptToken,
  encryptToken,
} from "@/lib/google-contacts/google-token-crypto"

describe("google contacts phone", () => {
  it("normalizes korean mobile formats", () => {
    expect(normalizePhone("010-1234-5678")).toBe("01012345678")
    expect(normalizePhone("+82 10-1234-5678")).toBe("01012345678")
    expect(normalizePhone("821012345678")).toBe("01012345678")
    expect(normalizePhone("+82-10-1234-5678")).toBe("01012345678")
  })

  it("formats display phone", () => {
    expect(formatPhoneForDisplay("01012345678")).toBe("010-1234-5678")
  })

  it("prefers mobile type then 010", () => {
    expect(
      pickBestPhone([
        { value: "02-123-4567", type: "home" },
        { value: "010-9999-8888", type: "mobile" },
      ]),
    ).toBe("01099998888")

    expect(
      pickBestPhone([
        { value: "02-123-4567", type: "home" },
        { value: "010-1111-2222", type: "other" },
      ]),
    ).toBe("01011112222")
  })
})

describe("google contact mapper", () => {
  it("maps name and phone", () => {
    const result = mapGooglePerson({
      resourceName: "people/abc",
      etag: "etag1",
      names: [{ displayName: "홍길동" }],
      phoneNumbers: [{ value: "010-1234-5678", type: "mobile" }],
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.contact.name).toBe("홍길동")
      expect(result.contact.normalizedPhone).toBe("01012345678")
      expect(result.contact.nickname).toBe("홍길동")
    }
  })

  it("skips missing phone", () => {
    const result = mapGooglePerson({
      resourceName: "people/abc",
      names: [{ displayName: "홍길동" }],
      phoneNumbers: [],
    })
    expect(result).toEqual({
      ok: false,
      reason: "missing_phone",
      resourceName: "people/abc",
    })
  })

  it("skips missing name", () => {
    const result = mapGooglePerson({
      resourceName: "people/abc",
      phoneNumbers: [{ value: "01012345678" }],
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe("missing_name")
  })
})

describe("google token crypto", () => {
  const prev = process.env.GOOGLE_CONTACTS_TOKEN_ENCRYPTION_KEY

  beforeEach(() => {
    process.env.GOOGLE_CONTACTS_TOKEN_ENCRYPTION_KEY =
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
  })

  afterEach(() => {
    if (prev === undefined) {
      delete process.env.GOOGLE_CONTACTS_TOKEN_ENCRYPTION_KEY
    } else {
      process.env.GOOGLE_CONTACTS_TOKEN_ENCRYPTION_KEY = prev
    }
  })

  it("encrypts and decrypts round-trip", () => {
    const plain = "refresh-token-value"
    const enc = encryptToken(plain)
    expect(enc).not.toContain(plain)
    expect(decryptToken(enc)).toBe(plain)
  })
})
