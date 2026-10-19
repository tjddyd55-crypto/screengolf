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
  updateGoogleContactsRefreshToken,
  upsertGoogleContactsConnection,
} from "@/lib/db/google-contacts"
import {
  classifyFetchFailure,
  classifyTokenEndpointFailure,
  GoogleContactsAuthError,
} from "@/lib/google-contacts/google-oauth-errors"
import { assertTokenEncryptionConfigured } from "@/lib/google-contacts/google-token-crypto"

export const OAUTH_STATE_COOKIE = "google_contacts_oauth_state"

const TOKEN_REFRESH_SKEW_MS = 60_000

export function createOAuthState(): string {
  return randomBytes(24).toString("hex")
}

export function buildGoogleAuthUrl(
  state: string,
  options: { forceConsent?: boolean } = {},
): string {
  assertTokenEncryptionConfigured()
  const env = getGoogleContactsEnv()
  const existing = getActiveGoogleContactsConnection()
  const needsConsent =
    options.forceConsent === true || !existing?.refresh_token_encrypted

  const params = new URLSearchParams({
    client_id: env.clientId,
    redirect_uri: env.redirectUri,
    response_type: "code",
    scope: GOOGLE_CONTACTS_SCOPE,
    access_type: "offline",
    include_granted_scopes: "true",
    state,
  })

  if (needsConsent) {
    params.set("prompt", "consent")
  }

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

let refreshInFlight: Promise<string> | null = null

export function isGoogleTokenRefreshInFlight(): boolean {
  return refreshInFlight !== null
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
    throw classifyTokenEndpointFailure(res.status, json)
  }

  const existing = getActiveGoogleContactsConnection()
  const refreshToken =
    json.refresh_token ||
    (existing ? getDecryptedRefreshToken(existing) : null)

  if (!refreshToken) {
    throw new GoogleContactsAuthError(
      "refresh_token을 받지 못했습니다. Google 계정 연결을 다시 시도해 주세요.",
      "reauth_required",
      "refresh_token_missing",
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
  refreshToken?: string
}> {
  const env = getGoogleContactsEnv()
  const body = new URLSearchParams({
    client_id: env.clientId,
    client_secret: env.clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  })

  let res: Response
  try {
    res = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    })
  } catch (error) {
    throw classifyFetchFailure(error)
  }

  const json = (await res.json()) as TokenResponse
  if (!res.ok || !json.access_token) {
    console.error(
      "[google-oauth] token refresh failed:",
      json.error ?? `http_${res.status}`,
      json.error_description
        ? String(json.error_description).slice(0, 120)
        : "",
    )
    throw classifyTokenEndpointFailure(res.status, json)
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
    refreshToken: json.refresh_token,
  }
}

async function refreshAndPersistAccessToken(
  connectionId: number,
  refreshToken: string,
): Promise<string> {
  const refreshed = await refreshAccessToken(refreshToken)
  updateGoogleContactsAccessToken(
    connectionId,
    refreshed.accessToken,
    refreshed.expiresAt,
  )
  if (refreshed.refreshToken) {
    updateGoogleContactsRefreshToken(connectionId, refreshed.refreshToken)
  }
  return refreshed.accessToken
}

function accessTokenStillValid(connection: {
  token_expires_at: string | null
  access_token_encrypted: string | null
}): boolean {
  const expiresAt = connection.token_expires_at
    ? new Date(connection.token_expires_at).getTime()
    : 0
  return (
    expiresAt > Date.now() + TOKEN_REFRESH_SKEW_MS &&
    Boolean(connection.access_token_encrypted)
  )
}

/** 유효한 access token을 반환한다. 만료 시 refresh 후 DB 반영. */
export async function getValidAccessToken(): Promise<string> {
  if (refreshInFlight) {
    return refreshInFlight
  }

  refreshInFlight = (async () => {
    const connection = getActiveGoogleContactsConnection()
    if (!connection) {
      throw new GoogleContactsAuthError(
        "Google 연락처가 연결되어 있지 않습니다.",
        "not_connected",
      )
    }

    if (accessTokenStillValid(connection)) {
      const access = getDecryptedAccessToken(connection)
      if (access) return access
    }

    try {
      const refreshToken = getDecryptedRefreshToken(connection)
      return await refreshAndPersistAccessToken(connection.id, refreshToken)
    } catch (error) {
      throw classifyFetchFailure(error)
    }
  })()

  try {
    return await refreshInFlight
  } finally {
    refreshInFlight = null
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
