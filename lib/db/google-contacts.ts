import { getDb } from "@/lib/db/sqlite"
import {
  decryptToken,
  encryptToken,
} from "@/lib/google-contacts/google-token-crypto"

export type GoogleContactsConnection = {
  id: number
  google_account_email: string | null
  access_token_encrypted: string | null
  refresh_token_encrypted: string
  token_expires_at: string | null
  scope: string
  token_type: string | null
  connected_at: string
  last_synced_at: string | null
  last_sync_status: string | null
  last_sync_message: string | null
  created_at: string
  updated_at: string
}

type ConnectionRow = GoogleContactsConnection

export function getActiveGoogleContactsConnection(): GoogleContactsConnection | null {
  const row = getDb()
    .prepare(
      `SELECT id, google_account_email, access_token_encrypted, refresh_token_encrypted,
              token_expires_at, scope, token_type, connected_at, last_synced_at,
              last_sync_status, last_sync_message, created_at, updated_at
       FROM google_contacts_connections
       ORDER BY id DESC
       LIMIT 1`,
    )
    .get() as ConnectionRow | undefined

  return row ?? null
}

export function upsertGoogleContactsConnection(input: {
  google_account_email: string | null
  access_token: string
  refresh_token: string
  token_expires_at: string | null
  scope: string
  token_type: string | null
}): GoogleContactsConnection {
  const existing = getActiveGoogleContactsConnection()
  const accessEnc = encryptToken(input.access_token)
  const refreshEnc = encryptToken(input.refresh_token)

  if (existing) {
    getDb()
      .prepare(
        `UPDATE google_contacts_connections
         SET google_account_email = ?,
             access_token_encrypted = ?,
             refresh_token_encrypted = ?,
             token_expires_at = ?,
             scope = ?,
             token_type = ?,
             connected_at = datetime('now'),
             updated_at = datetime('now')
         WHERE id = ?`,
      )
      .run(
        input.google_account_email,
        accessEnc,
        refreshEnc,
        input.token_expires_at,
        input.scope,
        input.token_type,
        existing.id,
      )
  } else {
    getDb()
      .prepare(
        `INSERT INTO google_contacts_connections (
          google_account_email, access_token_encrypted, refresh_token_encrypted,
          token_expires_at, scope, token_type, connected_at
        ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
      )
      .run(
        input.google_account_email,
        accessEnc,
        refreshEnc,
        input.token_expires_at,
        input.scope,
        input.token_type,
      )
  }

  const saved = getActiveGoogleContactsConnection()
  if (!saved) throw new Error("Google 연결 저장 후 조회에 실패했습니다.")
  return saved
}

export function updateGoogleContactsAccessToken(
  connectionId: number,
  accessToken: string,
  expiresAt: string | null,
): void {
  getDb()
    .prepare(
      `UPDATE google_contacts_connections
       SET access_token_encrypted = ?, token_expires_at = ?, updated_at = datetime('now')
       WHERE id = ?`,
    )
    .run(encryptToken(accessToken), expiresAt, connectionId)
}

export function updateGoogleContactsLastSync(
  connectionId: number,
  status: string,
  message: string,
): void {
  getDb()
    .prepare(
      `UPDATE google_contacts_connections
       SET last_synced_at = datetime('now'),
           last_sync_status = ?,
           last_sync_message = ?,
           updated_at = datetime('now')
       WHERE id = ?`,
    )
    .run(status, message, connectionId)
}

export function clearGoogleContactsConnection(connectionId: number): void {
  getDb()
    .prepare("DELETE FROM google_contacts_connections WHERE id = ?")
    .run(connectionId)
}

export function getDecryptedRefreshToken(
  connection: GoogleContactsConnection,
): string {
  return decryptToken(connection.refresh_token_encrypted)
}

export function getDecryptedAccessToken(
  connection: GoogleContactsConnection,
): string | null {
  if (!connection.access_token_encrypted) return null
  return decryptToken(connection.access_token_encrypted)
}

export type GoogleSyncLogInput = {
  started_at: string
  completed_at: string | null
  group_name: string
  group_resource_name: string | null
  google_contact_count: number
  created_count: number
  updated_count: number
  unchanged_count: number
  skipped_count: number
  failed_count: number
  status: "success" | "partial" | "failed"
  message: string | null
  details_json: string | null
}

export function insertGoogleContactsSyncLog(input: GoogleSyncLogInput): number {
  const result = getDb()
    .prepare(
      `INSERT INTO google_contacts_sync_logs (
        started_at, completed_at, group_name, group_resource_name,
        google_contact_count, created_count, updated_count, unchanged_count,
        skipped_count, failed_count, status, message, details_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.started_at,
      input.completed_at,
      input.group_name,
      input.group_resource_name,
      input.google_contact_count,
      input.created_count,
      input.updated_count,
      input.unchanged_count,
      input.skipped_count,
      input.failed_count,
      input.status,
      input.message,
      input.details_json,
    )

  return Number(result.lastInsertRowid)
}

export function maskEmail(email: string | null): string | null {
  if (!email) return null
  const [local, domain] = email.split("@")
  if (!domain) return "***"
  if (local.length <= 2) return `*@${domain}`
  return `${local.slice(0, 2)}***@${domain}`
}
