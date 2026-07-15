import type { GooglePersonPayload } from "@/lib/google-contacts/google-people-client"
import {
  formatPhoneForDisplay,
  pickBestPhone,
} from "@/lib/google-contacts/phone"

export type MappedGoogleContact = {
  resourceName: string
  etag: string | null
  name: string
  nickname: string
  phone: string
  normalizedPhone: string
}

export type MapSkipReason = "missing_name" | "missing_phone"

export type MapContactResult =
  | { ok: true; contact: MappedGoogleContact }
  | { ok: false; reason: MapSkipReason; resourceName: string }

export function mapGooglePerson(
  person: GooglePersonPayload,
): MapContactResult {
  const resourceName = person.resourceName
  const primaryName = person.names?.[0]
  const name =
    primaryName?.displayName?.trim() ||
    [primaryName?.familyName, primaryName?.givenName]
      .filter(Boolean)
      .join(" ")
      .trim()

  if (!name) {
    return { ok: false, reason: "missing_name", resourceName }
  }

  const normalizedPhone = pickBestPhone(person.phoneNumbers)
  if (!normalizedPhone) {
    return { ok: false, reason: "missing_phone", resourceName }
  }

  const displayPhone = formatPhoneForDisplay(normalizedPhone) || normalizedPhone
  const nickname =
    person.nicknames?.[0]?.value?.trim() || name

  return {
    ok: true,
    contact: {
      resourceName,
      etag: person.etag ?? null,
      name,
      nickname,
      phone: displayPhone,
      normalizedPhone,
    },
  }
}
