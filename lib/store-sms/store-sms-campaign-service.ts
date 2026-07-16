import {
  getStoreGoogleContactById,
} from "@/lib/db/store-google-contacts"
import { getDb } from "@/lib/db/sqlite"
import {
  cancelStoreSmsCampaign,
  claimStoreSmsCampaign,
  completeStoreSmsCampaign,
  countStoreSmsDraftRecipients,
  createStoreSmsCampaign,
  createStoreSmsDraft,
  getStoreSmsCampaign,
  getStoreSmsDraft,
  insertStoreSmsDispatchLog,
  insertStoreSmsRecipients,
  listDueStoreSmsCampaignIds,
  listPendingStoreSmsRecipients,
  listStoreSmsCampaigns,
  listStoreSmsDraftRecipientsPage,
  listStoreSmsRecipients,
  replaceStoreSmsDraftRecipients,
  updateStoreSmsRecipientResult,
  type StoreSmsCampaign,
  type StoreSmsSendMode,
} from "@/lib/db/store-sms"
import {
  getStoreGoogleContactsByIds,
} from "@/lib/db/store-google-contacts"
import { getStoreSmsEnv } from "@/lib/store-sms/store-sms-env"
import { sendStoreSms } from "@/lib/store-sms/store-sms-gateway"
import { applyStoreSmsTemplate } from "@/lib/store-sms/store-sms-message"
import {
  summarizeStoreSmsTarget,
  type StoreSmsTargetFilter,
} from "@/lib/store-sms/store-sms-targets"

const MIN_SCHEDULE_BUFFER_MS = 5 * 60 * 1000
const SEND_CONCURRENCY = 3
const BATCH_DELAY_MS = 120

function assertScheduleTime(scheduledAtIso: string): Date {
  const date = new Date(scheduledAtIso)
  if (Number.isNaN(date.getTime())) {
    throw new Error("invalid_scheduled_at")
  }
  if (date.getTime() < Date.now() + MIN_SCHEDULE_BUFFER_MS) {
    throw new Error("scheduled_at_too_soon")
  }
  return date
}

function persistDraftRecipientSnapshot(
  draftId: number,
  summary: ReturnType<typeof summarizeStoreSmsTarget>,
): void {
  const contactIds = summary.recipients
    .map((item) => item.googleContactId)
    .filter((id): id is number => typeof id === "number")
  const contacts = getStoreGoogleContactsByIds(contactIds)
  const nicknameById = new Map(
    contacts.map((contact) => [contact.id, contact.nickname]),
  )

  replaceStoreSmsDraftRecipients(
    draftId,
    summary.recipients.map((recipient) => ({
      googleContactId: recipient.googleContactId,
      name: recipient.name,
      nickname:
        recipient.googleContactId != null
          ? nicknameById.get(recipient.googleContactId) ?? null
          : null,
      phone: recipient.phone,
      normalizedPhone: recipient.normalizedPhone,
      eligibilityStatus:
        recipient.status === "pending" ? "sendable" : "excluded",
      exclusionReason: recipient.exclusionReason,
    })),
  )
}

export function createStoreSmsDraftFromTarget(input: {
  type: "selected" | "filtered_all"
  contactIds?: number[]
  filter?: StoreSmsTargetFilter
}) {
  if (input.type === "selected" && (!input.contactIds || input.contactIds.length === 0)) {
    throw new Error("empty_selection")
  }

  const summary = summarizeStoreSmsTarget(input)
  const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString()
  const id = createStoreSmsDraft({
    targetType: input.type,
    contactIds: input.type === "selected" ? input.contactIds : undefined,
    filter: input.type === "filtered_all" ? input.filter ?? {} : undefined,
    summary: {
      total: summary.total,
      sendable: summary.sendable,
      excluded: summary.excluded,
      exclusionCounts: summary.exclusionCounts,
    },
    expiresAtIso: expires,
  })

  persistDraftRecipientSnapshot(id, summary)

  return {
    draftId: id,
    summary: {
      total: summary.total,
      sendable: summary.sendable,
      excluded: summary.excluded,
      exclusionCounts: summary.exclusionCounts,
      recipients: summary.recipients,
    },
    expiresAt: expires,
  }
}

export function getStoreSmsDraftView(draftId: number) {
  const draft = getStoreSmsDraft(draftId)
  if (!draft) return null
  if (new Date(draft.expires_at).getTime() < Date.now()) {
    return null
  }

  const contactIds = draft.contact_ids_json
    ? (JSON.parse(draft.contact_ids_json) as number[])
    : undefined
  const filter = draft.filter_json
    ? (JSON.parse(draft.filter_json) as StoreSmsTargetFilter)
    : undefined

  const snapshot = countStoreSmsDraftRecipients(draftId)
  if (snapshot.total > 0) {
    return {
      draft,
      summary: {
        total: snapshot.total,
        sendable: snapshot.sendable,
        excluded: snapshot.excluded,
        exclusionCounts: snapshot.exclusionCounts,
        recipients: [],
      },
      contactIds,
      filter,
      hasRecipientSnapshot: true,
    }
  }

  const summary = summarizeStoreSmsTarget({
    type: draft.target_type,
    contactIds,
    filter,
  })
  persistDraftRecipientSnapshot(draftId, summary)

  return {
    draft,
    summary,
    contactIds,
    filter,
    hasRecipientSnapshot: true,
  }
}

export function listDraftRecipientsForUi(
  draftId: number,
  options?: {
    status?: "all" | "sendable" | "excluded"
    exclusionReason?: string
    query?: string
    page?: number
    pageSize?: number
  },
) {
  const view = getStoreSmsDraftView(draftId)
  if (!view) return null
  const page = listStoreSmsDraftRecipientsPage(draftId, options)
  const counts = countStoreSmsDraftRecipients(draftId)
  return {
    ...page,
    summary: {
      total: counts.total,
      sendable: counts.sendable,
      excluded: counts.excluded,
      exclusions: counts.exclusionCounts,
    },
  }
}

export function createStoreSmsCampaignFromRequest(input: {
  title: string
  message: string
  sendMode: StoreSmsSendMode
  scheduledAt?: string | null
  draftId?: number
  target?: {
    type: "selected" | "filtered_all"
    contactIds?: number[]
    filter?: StoreSmsTargetFilter
  }
}) {
  const title = input.title.trim()
  const message = input.message.trim()
  if (!title) throw new Error("title_required")
  if (!message) throw new Error("message_required")

  let targetType: "selected" | "filtered_all"
  let contactIds: number[] | undefined
  let filter: StoreSmsTargetFilter | undefined

  if (input.draftId != null) {
    const draftView = getStoreSmsDraftView(input.draftId)
    if (!draftView) throw new Error("draft_not_found")
    targetType = draftView.draft.target_type
    contactIds = draftView.contactIds
    filter = draftView.filter
  } else if (input.target) {
    targetType = input.target.type
    contactIds = input.target.contactIds
    filter = input.target.filter
  } else {
    throw new Error("target_required")
  }

  const env = getStoreSmsEnv()
  let scheduledAt: string | null = null
  let status: "scheduled" | "draft" = "draft"

  if (input.sendMode === "scheduled") {
    if (!input.scheduledAt) throw new Error("scheduled_at_required")
    const date = assertScheduleTime(input.scheduledAt)
    scheduledAt = date.toISOString()
    status = "scheduled"
  }

  const summary = summarizeStoreSmsTarget({
    type: targetType,
    contactIds,
    filter,
  })

  if (summary.total === 0) throw new Error("empty_recipients")

  const campaignId = createStoreSmsCampaign({
    title,
    message,
    sendMode: input.sendMode,
    scheduledAt,
    timezone: env.timezone,
    status,
    targetType,
    targetFilterJson: filter ? JSON.stringify(filter) : contactIds
      ? JSON.stringify({ contactIds })
      : null,
    totalRecipients: summary.total,
    sendableRecipients: summary.sendable,
    excludedRecipients: summary.excluded,
  })

  insertStoreSmsRecipients(
    campaignId,
    summary.recipients.map((recipient) => ({
      googleContactId: recipient.googleContactId,
      name: recipient.name,
      phone: recipient.phone,
      normalizedPhone: recipient.normalizedPhone,
      status: recipient.status,
      exclusionReason: recipient.exclusionReason,
    })),
  )

  return {
    campaignId,
    status,
    summary: {
      total: summary.total,
      sendable: summary.sendable,
      excluded: summary.excluded,
      exclusionCounts: summary.exclusionCounts,
    },
  }
}

async function mapWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let index = 0
  const runners = Array.from(
    { length: Math.min(concurrency, Math.max(items.length, 1)) },
    async () => {
      while (index < items.length) {
        const current = items[index]
        index += 1
        await worker(current)
        if (BATCH_DELAY_MS > 0) {
          await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS))
        }
      }
    },
  )
  await Promise.all(runners)
}

function shouldExcludeBeforeSend(recipient: {
  google_contact_id: number | null
}): { exclude: boolean; reason: "sms_opt_out" | "inactive" | null } {
  if (recipient.google_contact_id == null) {
    return { exclude: false, reason: null }
  }

  // 발송 worker마다 최신 수신거부/활성 상태를 DB에서 직접 재조회한다.
  const row = getDb()
    .prepare(
      `SELECT is_active, sms_opt_out
       FROM store_google_contacts
       WHERE id = ?`,
    )
    .get(recipient.google_contact_id) as
    | { is_active: number; sms_opt_out: number }
    | undefined

  if (!row) return { exclude: false, reason: null }
  if (row.is_active !== 1) return { exclude: true, reason: "inactive" }
  if (row.sms_opt_out === 1) return { exclude: true, reason: "sms_opt_out" }
  return { exclude: false, reason: null }
}

export async function dispatchStoreSmsCampaign(
  campaignId: number,
): Promise<StoreSmsCampaign | null> {
  const claimed = claimStoreSmsCampaign(campaignId)
  if (!claimed) return getStoreSmsCampaign(campaignId)

  const campaign = getStoreSmsCampaign(campaignId)
  if (!campaign) return null

  const pending = listPendingStoreSmsRecipients(campaignId)

  await mapWithConcurrency(pending, SEND_CONCURRENCY, async (recipient) => {
    const guard = shouldExcludeBeforeSend(recipient)
    if (guard.exclude && guard.reason) {
      updateStoreSmsRecipientResult({
        id: recipient.id,
        status: "excluded",
        exclusionReason: guard.reason,
        errorMessage: null,
      })
      return
    }

    const contact =
      recipient.google_contact_id != null
        ? getStoreGoogleContactById(recipient.google_contact_id)
        : null
    const body = applyStoreSmsTemplate(campaign.message, {
      name: recipient.name,
      nickname: contact?.nickname ?? null,
    })

    const result = await sendStoreSms({
      to: recipient.normalized_phone,
      message: body,
      campaignId,
      recipientId: recipient.id,
    })

    insertStoreSmsDispatchLog({
      campaignId,
      recipientId: recipient.id,
      provider: result.provider,
      dryRun: result.dryRun,
      requestSummary: result.requestSummary,
      responseSummary: result.responseSummary,
      status: result.dryRun ? "dry_run" : result.success ? "success" : "failed",
      errorCode: result.errorCode,
      errorMessage: result.errorMessage,
    })

    updateStoreSmsRecipientResult({
      id: recipient.id,
      status: result.success ? "success" : "failed",
      providerMessageId: result.messageId,
      errorMessage: result.errorMessage,
    })
  })

  const recipients = listStoreSmsRecipients(campaignId)
  const successCount = recipients.filter((r) => r.status === "success").length
  const failedCount = recipients.filter((r) => r.status === "failed").length
  const pendingLeft = recipients.filter((r) => r.status === "pending").length

  let finalStatus: "completed" | "partial" | "failed" = "completed"
  if (failedCount > 0 && successCount > 0) finalStatus = "partial"
  else if (failedCount > 0 && successCount === 0) finalStatus = "failed"
  else if (pendingLeft > 0 && successCount === 0 && failedCount === 0) {
    finalStatus = "failed"
  }

  completeStoreSmsCampaign(campaignId, finalStatus)
  return getStoreSmsCampaign(campaignId)
}

export async function dispatchDueStoreSmsCampaigns(): Promise<{
  processedIds: number[]
}> {
  const nowIso = new Date().toISOString()
  const dueIds = listDueStoreSmsCampaignIds(nowIso)
  const processedIds: number[] = []
  for (const id of dueIds) {
    await dispatchStoreSmsCampaign(id)
    processedIds.push(id)
  }
  return { processedIds }
}

export function listScheduledStoreSmsCampaigns(): StoreSmsCampaign[] {
  return listStoreSmsCampaigns({ statuses: ["scheduled"] })
}

export function listHistoryStoreSmsCampaigns(): StoreSmsCampaign[] {
  return listStoreSmsCampaigns({
    statuses: [
      "processing",
      "completed",
      "partial",
      "failed",
      "cancelled",
      "draft",
    ],
  }).filter((campaign) => campaign.status !== "scheduled")
}

export function cancelScheduledStoreSmsCampaign(id: number): boolean {
  return cancelStoreSmsCampaign(id)
}

export async function queueImmediateStoreSmsCampaign(
  campaignId: number,
): Promise<StoreSmsCampaign | null> {
  // immediate: claim from draft
  const campaign = getStoreSmsCampaign(campaignId)
  if (!campaign) return null
  if (campaign.send_mode !== "immediate") {
    throw new Error("not_immediate")
  }
  if (campaign.status !== "draft") {
    return campaign
  }
  return dispatchStoreSmsCampaign(campaignId)
}
