import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  classifyTokenEndpointFailure,
  GoogleContactsAuthError,
} from "@/lib/google-contacts/google-oauth-errors"

describe("google oauth refresh concurrency", () => {
  const originalFetch = global.fetch
  const encryptionKey =
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"

  beforeEach(() => {
    process.env.GOOGLE_CONTACTS_CLIENT_ID = "client-id"
    process.env.GOOGLE_CONTACTS_CLIENT_SECRET = "client-secret"
    process.env.GOOGLE_CONTACTS_REDIRECT_URI =
      "https://example.com/api/admin/google-contacts/callback"
    process.env.GOOGLE_CONTACTS_GROUP_NAME = "가자스크린"
    process.env.GOOGLE_CONTACTS_TOKEN_ENCRYPTION_KEY = encryptionKey
  })

  afterEach(() => {
    vi.restoreAllMocks()
    global.fetch = originalFetch
    vi.resetModules()
  })

  it("classifies invalid_grant without exposing token values in message", () => {
    const err = classifyTokenEndpointFailure(400, {
      error: "invalid_grant",
      error_description: "Bad Request",
    })
    expect(err).toBeInstanceOf(GoogleContactsAuthError)
    expect(err.message).not.toMatch(/refresh/i)
  })
})
