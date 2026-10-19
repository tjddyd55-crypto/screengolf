import { describe, expect, it } from "vitest"
import {
  classifyFetchFailure,
  classifyTokenEndpointFailure,
  GoogleContactsAuthError,
} from "@/lib/google-contacts/google-oauth-errors"

describe("google oauth error classification", () => {
  it("maps invalid_grant to reauth_required", () => {
    const error = classifyTokenEndpointFailure(400, {
      error: "invalid_grant",
      error_description: "Token has been expired or revoked.",
    })
    expect(error.state).toBe("reauth_required")
    expect(error.message).toContain("재연결")
  })

  it("maps 503 from token endpoint to transient_error", () => {
    const error = classifyTokenEndpointFailure(503, { error: "server_error" })
    expect(error.state).toBe("transient_error")
  })

  it("maps network failures to transient_error", () => {
    const error = classifyFetchFailure(new TypeError("fetch failed"))
    expect(error.state).toBe("transient_error")
  })

  it("maps crypto errors distinctly", () => {
    const error = classifyFetchFailure(
      new Error("토큰 암호문 형식이 올바르지 않습니다."),
    )
    expect(error.state).toBe("crypto_error")
  })

  it("preserves GoogleContactsAuthError instances", () => {
    const original = new GoogleContactsAuthError("test", "reauth_required")
    expect(classifyFetchFailure(original)).toBe(original)
  })
})
