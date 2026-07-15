import {
  getStoreGoogleContactsByIds,
  listStoreGoogleContacts,
  type GoogleContactFilter,
  type StoreGoogleContact,
  type StoreGoogleContactListQuery,
} from "@/lib/db/store-google-contacts"
import {
  isValidKoreanMobilePhone,
  normalizeStoreSmsPhone,
} from "@/lib/store-sms/store-sms-phone"

export type StoreSmsTargetFilter = {
  query?: string
  status?: GoogleContactFilter | "all"
  smsOptOut?: boolean
  isActive?: boolean
}

export type StoreSmsExclusionReason =
  | "sms_opt_out"
  | "inactive"
  | "no_phone"
  | "invalid_phone"
  | "duplicate_phone"
  | "not_in_group"
  | "already_processed"

export type StoreSmsRecipientPlan = {
  googleContactId: number | null
  name: string
  phone: string
  normalizedPhone: string
  status: "pending" | "excluded"
  exclusionReason: StoreSmsExclusionReason | null
}

export type StoreSmsTargetSummary = {
  total: number
  sendable: number
  excluded: number
  exclusionCounts: Partial<Record<StoreSmsExclusionReason, number>>
  recipients: StoreSmsRecipientPlan[]
}

function classifyContact(contact: StoreGoogleContact): {
  status: "pending" | "excluded"
  exclusionReason: StoreSmsExclusionReason | null
  normalizedPhone: string
  phone: string
} {
  if (!contact.is_active) {
    return {
      status: "excluded",
      exclusionReason: "inactive",
      normalizedPhone: contact.normalized_phone || "",
      phone: contact.phone || "",
    }
  }
  if (contact.sms_opt_out) {
    return {
      status: "excluded",
      exclusionReason: "sms_opt_out",
      normalizedPhone: contact.normalized_phone || "",
      phone: contact.phone || "",
    }
  }
  if (contact.google_sync_status === "not_in_group") {
    return {
      status: "excluded",
      exclusionReason: "not_in_group",
      normalizedPhone: contact.normalized_phone || "",
      phone: contact.phone || "",
    }
  }

  const normalized =
    normalizeStoreSmsPhone(contact.normalized_phone || contact.phone) ?? ""
  if (!normalized) {
    return {
      status: "excluded",
      exclusionReason: "no_phone",
      normalizedPhone: "",
      phone: contact.phone || "",
    }
  }
  if (!isValidKoreanMobilePhone(normalized)) {
    return {
      status: "excluded",
      exclusionReason: "invalid_phone",
      normalizedPhone: normalized,
      phone: contact.phone || normalized,
    }
  }

  return {
    status: "pending",
    exclusionReason: null,
    normalizedPhone: normalized,
    phone: contact.phone || normalized,
  }
}

export function buildStoreSmsRecipientPlans(
  contacts: StoreGoogleContact[],
): StoreSmsTargetSummary {
  const seenPhones = new Set<string>()
  const recipients: StoreSmsRecipientPlan[] = []
  const exclusionCounts: Partial<Record<StoreSmsExclusionReason, number>> = {}

  for (const contact of contacts) {
    const classified = classifyContact(contact)
    let status = classified.status
    let exclusionReason = classified.exclusionReason

    if (status === "pending") {
      if (seenPhones.has(classified.normalizedPhone)) {
        status = "excluded"
        exclusionReason = "duplicate_phone"
      } else {
        seenPhones.add(classified.normalizedPhone)
      }
    }

    if (exclusionReason) {
      exclusionCounts[exclusionReason] =
        (exclusionCounts[exclusionReason] ?? 0) + 1
    }

    recipients.push({
      googleContactId: contact.id,
      name: contact.name,
      phone: classified.phone,
      normalizedPhone: classified.normalizedPhone,
      status,
      exclusionReason,
    })
  }

  const sendable = recipients.filter((r) => r.status === "pending").length
  return {
    total: recipients.length,
    sendable,
    excluded: recipients.length - sendable,
    exclusionCounts,
    recipients,
  }
}

export function resolveContactsForTarget(input: {
  type: "selected" | "filtered_all"
  contactIds?: number[]
  filter?: StoreSmsTargetFilter
}): StoreGoogleContact[] {
  if (input.type === "selected") {
    return getStoreGoogleContactsByIds(input.contactIds ?? [])
  }

  const filter = input.filter ?? {}
  const query: StoreGoogleContactListQuery = {
    query: filter.query,
    status: filter.status ?? "all",
    smsOptOut: filter.smsOptOut,
    isActive: filter.isActive,
  }
  return listStoreGoogleContacts(query)
}

export function summarizeStoreSmsTarget(input: {
  type: "selected" | "filtered_all"
  contactIds?: number[]
  filter?: StoreSmsTargetFilter
}): StoreSmsTargetSummary {
  return buildStoreSmsRecipientPlans(resolveContactsForTarget(input))
}
