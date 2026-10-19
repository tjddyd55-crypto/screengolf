export type GoogleConnectionState =
  | "connected"
  | "refreshing"
  | "reauth_required"
  | "transient_error"
  | "sync_failed"
  | "not_connected"
  | "config_error"
  | "crypto_error"

export type GoogleTokenEndpointError = {
  error?: string
  error_description?: string
}

export class GoogleContactsAuthError extends Error {
  readonly state: GoogleConnectionState
  readonly googleError?: string

  constructor(
    message: string,
    state: GoogleConnectionState,
    googleError?: string,
  ) {
    super(message)
    this.name = "GoogleContactsAuthError"
    this.state = state
    this.googleError = googleError
  }
}

export function isGoogleContactsAuthError(
  error: unknown,
): error is GoogleContactsAuthError {
  return error instanceof GoogleContactsAuthError
}

export function classifyTokenEndpointFailure(
  httpStatus: number,
  body: GoogleTokenEndpointError,
): GoogleContactsAuthError {
  const googleError = body.error?.trim() || undefined

  if (googleError === "invalid_grant") {
    return new GoogleContactsAuthError(
      "Google 계정 재연결이 필요합니다.",
      "reauth_required",
      googleError,
    )
  }

  if (
    googleError === "invalid_client" ||
    googleError === "unauthorized_client" ||
    googleError === "redirect_uri_mismatch"
  ) {
    return new GoogleContactsAuthError(
      "Google OAuth 클라이언트 설정을 확인해 주세요.",
      "config_error",
      googleError,
    )
  }

  if (httpStatus === 429 || httpStatus >= 500) {
    return new GoogleContactsAuthError(
      "Google 연결 중 일시적인 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.",
      "transient_error",
      googleError,
    )
  }

  return new GoogleContactsAuthError(
    "Google 연결 중 오류가 발생했습니다. 문제가 계속되면 계정을 다시 연결해 주세요.",
    "reauth_required",
    googleError,
  )
}

export function classifyFetchFailure(error: unknown): GoogleContactsAuthError {
  if (error instanceof GoogleContactsAuthError) return error

  const message =
    error instanceof Error ? error.message : "Google 연결 중 오류가 발생했습니다."

  if (
    message.includes("GOOGLE_CONTACTS_TOKEN_ENCRYPTION_KEY") ||
    message.includes("토큰 암호문")
  ) {
    return new GoogleContactsAuthError(
      "저장된 Google 인증 정보를 복호화하지 못했습니다. 환경 설정을 확인한 뒤 계정을 다시 연결해 주세요.",
      "crypto_error",
    )
  }

  if (
    message.includes("Google 연락처 설정이 누락") ||
    message.includes("환경변수")
  ) {
    return new GoogleContactsAuthError(message, "config_error")
  }

  const lower = message.toLowerCase()
  if (
    lower.includes("fetch failed") ||
    lower.includes("network") ||
    lower.includes("econnreset") ||
    lower.includes("etimedout") ||
    lower.includes("socket")
  ) {
    return new GoogleContactsAuthError(
      "Google 연결 중 일시적인 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.",
      "transient_error",
    )
  }

  return new GoogleContactsAuthError(message, "reauth_required")
}

export function connectionStateUserMessage(state: GoogleConnectionState): string {
  switch (state) {
    case "connected":
      return "Google 연락처가 정상적으로 연결되어 있습니다."
    case "refreshing":
      return "Google 연결 토큰을 갱신하는 중입니다."
    case "reauth_required":
      return "Google 계정 재연결이 필요합니다."
    case "transient_error":
      return "Google 연결 중 일시적인 문제가 발생했습니다."
    case "sync_failed":
      return "마지막 동기화에 실패했습니다."
    case "not_connected":
      return "Google 연락처가 연결되어 있지 않습니다."
    case "config_error":
      return "Google 연락처 환경 설정을 확인해 주세요."
    case "crypto_error":
      return "Google 인증 정보 복호화에 실패했습니다. 계정을 다시 연결해 주세요."
    default:
      return "Google 연결 상태를 확인할 수 없습니다."
  }
}
