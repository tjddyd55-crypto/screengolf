import { normalizePhone } from "@/lib/google-contacts/phone"

export function normalizeStoreSmsPhone(
  value: string | null | undefined,
): string | null {
  return normalizePhone(value)
}

export function isValidKoreanMobilePhone(
  value: string | null | undefined,
): boolean {
  const digits = normalizeStoreSmsPhone(value)
  if (!digits || digits.length < 10 || digits.length > 11) return false
  return (
    digits.startsWith("010") ||
    digits.startsWith("011") ||
    digits.startsWith("016") ||
    digits.startsWith("017") ||
    digits.startsWith("018") ||
    digits.startsWith("019")
  )
}
