import { randomBytes } from "node:crypto"
import {
  GOOGLE_CONTACTS_SCOPE,
  GOOGLE_OAUTH_AUTH_URL,
  GOOGLE_OAUTH_REVOKE_URL,
  GOOGLE_OAUTH_TOKEN_URL,
  GOOGLE_USERINFO_URL,
  getGoogleContactsEnv,
} from "@/lib/google-contacts/google-contacts-env"
import {
  clearGoogleContactsConnection,
  getActiveGoogleContactsConnection,
  getDecryptedAccessToken,
  getDecryptedRefreshToken,
  updateGoogleContactsAccessToken,
  upsertGoogleContactsConnection,
} from "@/lib/db/google-contacts"
import { assertTokenEncryptionConfigured } from "@/lib/google-contacts/google-token-crypto"

export const OAUTH_STATE_COOKIE = "google_contacts_oauth_state"

export function createOAuthState(): string {
  return randomBytes(24).toString("hex")
}

export function buildGoogleAuthUrl(state: string): string {
  assertTokenEncryptionConfigured()
  const env = getGoogleContactsEnv()

  const params = new URLSearchParams({
    client_id: env.clientId,
    redirect_uri: env.redirectUri,
    response_type: "code",
    scope: GOOGLE_CONTACTS_SCOPE,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  })

  return `${GOOGLE_OAUTH_AUTH_URL}?${params.toString()}`
}

type TokenResponse = {
  access_token?: string
  refresh_token?: string
  expires_in?: number
  scope?: string
  token_type?: string
  error?: string
  error_description?: string
}

export async function exchangeAuthorizationCode(code: string): Promise<{
  accessToken: string
  refreshToken: string
  expiresAt: string | null
  scope: string
  tokenType: string | null
}> {
  const env = getGoogleContactsEnv()
  const body = new URLSearchParams({
    code,
    client_id: env.clientId,
    client_secret: env.clientSecret,
    redirect_uri: env.redirectUri,
    grant_type: "authorization_code",
  })

  const res = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  })

  const json = (await res.json()) as TokenResponse
  if (!res.ok || !json.access_token) {
    throw new Error("Google 토큰 교환에 실패했습니다.")
  }

  const existing = getActiveGoogleContactsConnection()
  const refreshToken =
    json.refresh_token ||
    (existing ? getDecryptedRefreshToken(existing) : null)

  if (!refreshToken) {
    throw new Error(
      "refresh_token을 받지 못했습니다. Google 계정 연결을 다시 시도해 주세요.",
    )
  }

  const expiresAt =
    typeof json.expires_in === "number"
      ? new Date(Date.now() + json.expires_in * 1000).toISOString()
      : null

  return {
    accessToken: json.access_token,
    refreshToken,
    expiresAt,
    scope: json.scope || GOOGLE_CONTACTS_SCOPE,
    tokenType: json.token_type ?? "Bearer",
  }
}

export async function fetchGoogleAccountEmail(
  accessToken: string,
): Promise<string | null> {
  const res = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) return null
  const json = (await res.json()) as { email?: string }
  return json.email ?? null
}

export async function saveGoogleConnectionFromTokens(input: {
  accessToken: string
  refreshToken: string
  expiresAt: string | null
  scope: string
  tokenType: string | null
}): Promise<void> {
  const email = await fetchGoogleAccountEmail(input.accessToken)
  upsertGoogleContactsConnection({
    google_account_email: email,
    access_token: input.accessToken,
    refresh_token: input.refreshToken,
    token_expires_at: input.expiresAt,
    scope: input.scope,
    token_type: input.tokenType,
  })
}

async function refreshAccessToken(refreshToken: string): Promise<{
  accessToken: string
  expiresAt: string | null
  scope?: string
  tokenType?: string
}> {
  const env = getGoogleContactsEnv()
  const body = new URLSearchParams({
    client_id: env.clientId,
    client_secret: env.clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  })

  const res = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  })

  const json = (await res.json()) as TokenResponse
  if (!res.ok || !json.access_token) {
    throw new Error("Google 연결이 만료되었습니다. 다시 연결해 주세요.")
  }

  const expiresAt =
    typeof json.expires_in === "number"
      ? new Date(Date.now() + json.expires_in * 1000).toISOString()
      : null

  return {
    accessToken: json.access_token,
    expiresAt,
    scope: json.scope,
    tokenType: json.token_type,
  }
}

/** 유효한 access token을 반환한다. 만료 시 refresh 후 DB 반영. */
export async function getValidAccessToken(): Promise<string> {
  const connection = getActiveGoogleContactsConnection()
  if (!connection) {
    throw new Error("Google 연락처가 연결되어 있지 않습니다.")
  }

  const expiresAt = connection.token_expires_at
    ? new Date(connection.token_expires_at).getTime()
    : 0
  const stillValid =
    expiresAt > Date.now() + 60_000 && connection.access_token_encrypted

  if (stillValid) {
    const access = getDecryptedAccessToken(connection)
    if (access) return access
  }

  try {
    const refreshed = await refreshAccessToken(
      getDecryptedRefreshToken(connection),
    )
    updateGoogleContactsAccessToken(
      connection.id,
      refreshed.accessToken,
      refreshed.expiresAt,
    )
    return refreshed.accessToken
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? error.message
        : "Google 연결이 만료되었습니다. 다시 연결해 주세요.",
    )
  }
}

export async function revokeAndDisconnect(): Promise<void> {
  const connection = getActiveGoogleContactsConnection()
  if (!connection) return

  try {
    const token =
      getDecryptedAccessToken(connection) ||
      getDecryptedRefreshToken(connection)
    await fetch(`${GOOGLE_OAUTH_REVOKE_URL}?token=${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    })
  } catch {
    // revoke 실패해도 로컬 연결은 해제
  }

  clearGoogleContactsConnection(connection.id)
}
