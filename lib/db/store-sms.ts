import { getDb } from "@/lib/db/sqlite"
import type { StoreSmsExclusionReason } from "@/lib/store-sms/store-sms-targets"

export type StoreSmsCampaignStatus =
  | "draft"
  | "scheduled"
  | "processing"
  | "completed"
  | "partial"
  | "failed"
  | "cancelled"

export type StoreSmsSendMode = "immediate" | "scheduled"
export type StoreSmsTargetType = "selected" | "filtered_all"

export type StoreSmsCampaign = {
  id: number
  title: string
  message: string
  send_mode: StoreSmsSendMode
  scheduled_at: string | null
  timezone: string
  status: StoreSmsCampaignStatus
  target_type: StoreSmsTargetType
  target_filter_json: string | null
  total_recipients: number
  sendable_recipients: number
  excluded_recipients: number
  sent_count: number
  success_count: number
  failed_count: number
  cancelled_count: number
  created_at: string
  updated_at: string
  started_at: string | null
  completed_at: string | null
  cancelled_at: string | null
}

export type StoreSmsRecipientStatus =
  | "pending"
  | "excluded"
  | "processing"
  | "success"
  | "failed"
  | "cancelled"

export type StoreSmsRecipient = {
  id: number
  campaign_id: number
  google_contact_id: number | null
  name: string
  phone: string
  normalized_phone: string
  status: StoreSmsRecipientStatus
  exclusion_reason: StoreSmsExclusionReason | null
  provider_message_id: string | null
  error_message: string | null
  sent_at: string | null
  created_at: string
  updated_at: string
}

export type StoreSmsDraft = {
  id: number
  target_type: StoreSmsTargetType
  contact_ids_json: string | null
  filter_json: string | null
  summary_json: string | null
  expires_at: string
  created_at: string
}

const CAMPAIGN_SELECT = `
  SELECT id, title, message, send_mode, scheduled_at, timezone, status,
         target_type, target_filter_json, total_recipients, sendable_recipients,
         excluded_recipients, sent_count, success_count, failed_count,
         cancelled_count, created_at, updated_at, started_at, completed_at,
         cancelled_at
  FROM store_sms_campaigns
`

const RECIPIENT_SELECT = `
  SELECT id, campaign_id, google_contact_id, name, phone, normalized_phone,
         status, exclusion_reason, provider_message_id, error_message, sent_at,
         created_at, updated_at
  FROM store_sms_campaign_recipients
`

export function createStoreSmsDraft(input: {
  targetType: StoreSmsTargetType
  contactIds?: number[]
  filter?: unknown
  summary?: unknown
  expiresAtIso: string
}): number {
  const result = getDb()
    .prepare(
      `INSERT INTO store_sms_drafts
        (target_type, contact_ids_json, filter_json, summary_json, expires_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(
      input.targetType,
      input.contactIds ? JSON.stringify(input.contactIds) : null,
      input.filter ? JSON.stringify(input.filter) : null,
      input.summary ? JSON.stringify(input.summary) : null,
      input.expiresAtIso,
    )
  return Number(result.lastInsertRowid)
}

export function getStoreSmsDraft(id: number): StoreSmsDraft | null {
  const row = getDb()
    .prepare(
      `SELECT id, target_type, contact_ids_json, filter_json, summary_json,
              expires_at, created_at
       FROM store_sms_drafts WHERE id = ?`,
    )
    .get(id) as StoreSmsDraft | undefined
  return row ?? null
}

export function createStoreSmsCampaign(input: {
  title: string
  message: string
  sendMode: StoreSmsSendMode
  scheduledAt: string | null
  timezone: string
  status: StoreSmsCampaignStatus
  targetType: StoreSmsTargetType
  targetFilterJson: string | null
  totalRecipients: number
  sendableRecipients: number
  excludedRecipients: number
}): number {
  const result = getDb()
    .prepare(
      `INSERT INTO store_sms_campaigns
        (title, message, send_mode, scheduled_at, timezone, status, target_type,
         target_filter_json, total_recipients, sendable_recipients,
         excluded_recipients)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.title,
      input.message,
      input.sendMode,
      input.scheduledAt,
      input.timezone,
      input.status,
      input.targetType,
      input.targetFilterJson,
      input.totalRecipients,
      input.sendableRecipients,
      input.excludedRecipients,
    )
  return Number(result.lastInsertRowid)
}

export function insertStoreSmsRecipients(
  campaignId: number,
  recipients: Array<{
    googleContactId: number | null
    name: string
    phone: string
    normalizedPhone: string
    status: StoreSmsRecipientStatus
    exclusionReason: StoreSmsExclusionReason | null
  }>,
): void {
  const db = getDb()
  const insert = db.prepare(
    `INSERT INTO store_sms_campaign_recipients
      (campaign_id, google_contact_id, name, phone, normalized_phone, status,
       exclusion_reason)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )

  const tx = db.transaction(() => {
    for (const recipient of recipients) {
      insert.run(
        campaignId,
        recipient.googleContactId,
        recipient.name,
        recipient.phone,
        recipient.normalizedPhone,
        recipient.status,
        recipient.exclusionReason,
      )
    }
  })
  tx()
}

export function getStoreSmsCampaign(id: number): StoreSmsCampaign | null {
  const row = getDb()
    .prepare(`${CAMPAIGN_SELECT} WHERE id = ?`)
    .get(id) as StoreSmsCampaign | undefined
  return row ?? null
}

export function listStoreSmsCampaigns(options?: {
  statuses?: StoreSmsCampaignStatus[]
}): StoreSmsCampaign[] {
  const statuses = options?.statuses
  if (!statuses || statuses.length === 0) {
    return getDb()
      .prepare(`${CAMPAIGN_SELECT} ORDER BY id DESC`)
      .all() as StoreSmsCampaign[]
  }
  const placeholders = statuses.map(() => "?").join(", ")
  return getDb()
    .prepare(
      `${CAMPAIGN_SELECT}
       WHERE status IN (${placeholders})
       ORDER BY CASE WHEN scheduled_at IS NULL THEN 1 ELSE 0 END,
                scheduled_at ASC, id DESC`,
    )
    .all(...statuses) as StoreSmsCampaign[]
}

export function listStoreSmsRecipients(
  campaignId: number,
): StoreSmsRecipient[] {
  return getDb()
    .prepare(
      `${RECIPIENT_SELECT}
       WHERE campaign_id = ?
       ORDER BY id ASC`,
    )
    .all(campaignId) as StoreSmsRecipient[]
}

export function listPendingStoreSmsRecipients(
  campaignId: number,
): StoreSmsRecipient[] {
  return getDb()
    .prepare(
      `${RECIPIENT_SELECT}
       WHERE campaign_id = ? AND status = 'pending'
       ORDER BY id ASC`,
    )
    .all(campaignId) as StoreSmsRecipient[]
}

export function claimStoreSmsCampaign(id: number): boolean {
  const result = getDb()
    .prepare(
      `UPDATE store_sms_campaigns
       SET status = 'processing',
           started_at = COALESCE(started_at, datetime('now')),
           updated_at = datetime('now')
       WHERE id = ? AND status IN ('scheduled', 'draft')`,
    )
    .run(id)
  return result.changes === 1
}

export function cancelStoreSmsCampaign(id: number): boolean {
  const db = getDb()
  const tx = db.transaction(() => {
    const result = db
      .prepare(
        `UPDATE store_sms_campaigns
         SET status = 'cancelled',
             cancelled_at = datetime('now'),
             updated_at = datetime('now')
         WHERE id = ? AND status = 'scheduled'`,
      )
      .run(id)
    if (result.changes !== 1) return false

    db.prepare(
      `UPDATE store_sms_campaign_recipients
       SET status = 'cancelled',
           updated_at = datetime('now')
       WHERE campaign_id = ? AND status = 'pending'`,
    ).run(id)

    const cancelled = db
      .prepare(
        `SELECT COUNT(*) AS c FROM store_sms_campaign_recipients
         WHERE campaign_id = ? AND status = 'cancelled'`,
      )
      .get(id) as { c: number }

    db.prepare(
      `UPDATE store_sms_campaigns
       SET cancelled_count = ?,
           updated_at = datetime('now')
       WHERE id = ?`,
    ).run(cancelled.c, id)

    return true
  })
  return tx()
}

export function updateStoreSmsRecipientResult(input: {
  id: number
  status: Extract<StoreSmsRecipientStatus, "success" | "failed" | "excluded">
  providerMessageId?: string | null
  errorMessage?: string | null
  exclusionReason?: StoreSmsExclusionReason | null
}): void {
  getDb()
    .prepare(
      `UPDATE store_sms_campaign_recipients
       SET status = ?,
           provider_message_id = COALESCE(?, provider_message_id),
           error_message = ?,
           exclusion_reason = COALESCE(?, exclusion_reason),
           sent_at = CASE WHEN ? IN ('success', 'failed') THEN datetime('now') ELSE sent_at END,
           updated_at = datetime('now')
       WHERE id = ?`,
    )
    .run(
      input.status,
      input.providerMessageId ?? null,
      input.errorMessage ?? null,
      input.exclusionReason ?? null,
      input.status,
      input.id,
    )
}

export function refreshStoreSmsCampaignCounts(campaignId: number): void {
  const db = getDb()
  const counts = db
    .prepare(
      `SELECT
         SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) AS success_count,
         SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed_count,
         SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled_count,
         SUM(CASE WHEN status = 'excluded' THEN 1 ELSE 0 END) AS excluded_count,
         SUM(CASE WHEN status IN ('success', 'failed') THEN 1 ELSE 0 END) AS sent_count
       FROM store_sms_campaign_recipients
       WHERE campaign_id = ?`,
    )
    .get(campaignId) as {
    success_count: number
    failed_count: number
    cancelled_count: number
    excluded_count: number
    sent_count: number
  }

  db.prepare(
    `UPDATE store_sms_campaigns
     SET success_count = ?,
         failed_count = ?,
         cancelled_count = ?,
         excluded_recipients = ?,
         sent_count = ?,
         updated_at = datetime('now')
     WHERE id = ?`,
  ).run(
    counts.success_count ?? 0,
    counts.failed_count ?? 0,
    counts.cancelled_count ?? 0,
    counts.excluded_count ?? 0,
    counts.sent_count ?? 0,
    campaignId,
  )
}

export function completeStoreSmsCampaign(
  campaignId: number,
  status: Extract<
    StoreSmsCampaignStatus,
    "completed" | "partial" | "failed"
  >,
): void {
  refreshStoreSmsCampaignCounts(campaignId)
  getDb()
    .prepare(
      `UPDATE store_sms_campaigns
       SET status = ?,
           completed_at = datetime('now'),
           updated_at = datetime('now')
       WHERE id = ?`,
    )
    .run(status, campaignId)
}

export function listDueStoreSmsCampaignIds(nowIso: string): number[] {
  const rows = getDb()
    .prepare(
      `SELECT id FROM store_sms_campaigns
       WHERE status = 'scheduled'
         AND scheduled_at IS NOT NULL
         AND scheduled_at <= ?
       ORDER BY scheduled_at ASC, id ASC
       LIMIT 20`,
    )
    .all(nowIso) as Array<{ id: number }>
  return rows.map((row) => row.id)
}

export function insertStoreSmsDispatchLog(input: {
  campaignId: number
  recipientId: number | null
  provider: string
  dryRun: boolean
  requestSummary: unknown
  responseSummary: unknown
  status: "success" | "failed" | "dry_run"
  errorCode?: string | null
  errorMessage?: string | null
}): void {
  getDb()
    .prepare(
      `INSERT INTO store_sms_dispatch_logs
        (campaign_id, recipient_id, provider, dry_run, request_summary_json,
         response_summary_json, status, error_code, error_message)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.campaignId,
      input.recipientId,
      input.provider,
      input.dryRun ? 1 : 0,
      JSON.stringify(input.requestSummary ?? {}),
      input.responseSummary ? JSON.stringify(input.responseSummary) : null,
      input.status,
      input.errorCode ?? null,
      input.errorMessage ?? null,
    )
}

export function listStoreSmsDispatchLogs(campaignId: number) {
  return getDb()
    .prepare(
      `SELECT id, campaign_id, recipient_id, provider, dry_run,
              request_summary_json, response_summary_json, status,
              error_code, error_message, created_at
       FROM store_sms_dispatch_logs
       WHERE campaign_id = ?
       ORDER BY id DESC
       LIMIT 500`,
    )
    .all(campaignId)
}
