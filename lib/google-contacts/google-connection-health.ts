import {
  getActiveGoogleContactsConnection,
  getDecryptedRefreshToken,
  maskEmail,
  type GoogleContactsConnection,
} from "@/lib/db/google-contacts"
import { getGoogleContactsEnv } from "@/lib/google-contacts/google-contacts-env"
import {
  connectionStateUserMessage,
  GoogleContactsAuthError,
  type GoogleConnectionState,
} from "@/lib/google-contacts/google-oauth-errors"
import {
  getValidAccessToken,
  isGoogleTokenRefreshInFlight,
} from "@/lib/google-contacts/google-oauth"
import { assertTokenEncryptionConfigured } from "@/lib/google-contacts/google-token-crypto"

export type GoogleConnectionHealth = {
  connected: boolean
  connectionState: GoogleConnectionState
  message: string
  accountEmail: string | null
  groupName: string | null
  connectedAt: string | null
  lastSyncedAt: string | null
  lastSyncStatus: string | null
  lastSyncMessage: string | null
  tokenExpiresAt: string | null
  hasRefreshToken: boolean
  probeErrorCode: string | null
}

function deriveStateFromLastSync(
  connection: GoogleContactsConnection,
): GoogleConnectionState | null {
  if (connection.last_sync_status === "failed") {
    return "sync_failed"
  }
  return null
}

export async function getGoogleConnectionHealth(
  options: { probe?: boolean } = {},
): Promise<GoogleConnectionHealth> {
  let groupName: string | null = null
  try {
    groupName = getGoogleContactsEnv().groupName
  } catch {
    return {
      connected: false,
      connectionState: "config_error",
      message: connectionStateUserMessage("config_error"),
      accountEmail: null,
      groupName: null,
      connectedAt: null,
      lastSyncedAt: null,
      lastSyncStatus: null,
      lastSyncMessage: null,
      tokenExpiresAt: null,
      hasRefreshToken: false,
      probeErrorCode: null,
    }
  }

  const connection = getActiveGoogleContactsConnection()
  if (!connection) {
    return {
      connected: false,
      connectionState: "not_connected",
      message: connectionStateUserMessage("not_connected"),
      accountEmail: null,
      groupName,
      connectedAt: null,
      lastSyncedAt: null,
      lastSyncStatus: null,
      lastSyncMessage: null,
      tokenExpiresAt: null,
      hasRefreshToken: false,
      probeErrorCode: null,
    }
  }

  const hasRefreshToken = Boolean(connection.refresh_token_encrypted?.trim())
  const base = {
    connected: true,
    accountEmail: maskEmail(connection.google_account_email),
    groupName,
    connectedAt: connection.connected_at,
    lastSyncedAt: connection.last_synced_at,
    lastSyncStatus: connection.last_sync_status,
    lastSyncMessage: connection.last_sync_message,
    tokenExpiresAt: connection.token_expires_at,
    hasRefreshToken,
  }

  if (isGoogleTokenRefreshInFlight()) {
    return {
      ...base,
      connectionState: "refreshing",
      message: connectionStateUserMessage("refreshing"),
      probeErrorCode: null,
    }
  }

  if (!options.probe) {
    const fromSync = deriveStateFromLastSync(connection)
    return {
      ...base,
      connectionState: fromSync ?? "connected",
      message: connectionStateUserMessage(fromSync ?? "connected"),
      probeErrorCode: null,
    }
  }

  try {
    assertTokenEncryptionConfigured()
    getDecryptedRefreshToken(connection)
    await getValidAccessToken()
    return {
      ...base,
      connectionState: "connected",
      message: connectionStateUserMessage("connected"),
      probeErrorCode: null,
    }
  } catch (error) {
    const authError =
      error instanceof GoogleContactsAuthError
        ? error
        : new GoogleContactsAuthError(
            error instanceof Error ? error.message : "연결 확인 실패",
            "reauth_required",
          )

    const fromSync = deriveStateFromLastSync(connection)
    const state =
      authError.state === "connected"
        ? (fromSync ?? "reauth_required")
        : authError.state

    return {
      ...base,
      connectionState: state,
      message: authError.message,
      probeErrorCode: authError.googleError ?? null,
    }
  }
}
