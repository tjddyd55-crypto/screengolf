/** 숫자만 남기고 한국 휴대폰 형식으로 정규화한다. */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null

  let digits = raw.replace(/\D/g, "")
  if (!digits) return null

  if (digits.startsWith("82") && digits.length >= 11) {
    digits = `0${digits.slice(2)}`
  }

  if (digits.startsWith("820") && digits.length >= 12) {
    digits = digits.slice(2)
  }

  // 최소 길이: 일반 유선/휴대폰
  if (digits.length < 9 || digits.length > 12) {
    return digits.length >= 8 ? digits : null
  }

  return digits
}

export function formatPhoneForDisplay(normalized: string | null): string | null {
  if (!normalized) return null
  if (normalized.length === 11 && normalized.startsWith("010")) {
    return `${normalized.slice(0, 3)}-${normalized.slice(3, 7)}-${normalized.slice(7)}`
  }
  if (normalized.length === 10 && normalized.startsWith("01")) {
    return `${normalized.slice(0, 3)}-${normalized.slice(3, 6)}-${normalized.slice(6)}`
  }
  return normalized
}

export type GooglePhoneCandidate = {
  value?: string
  type?: string
}

export function pickBestPhone(
  phones: GooglePhoneCandidate[] | undefined,
): string | null {
  if (!phones || phones.length === 0) return null

  const normalized = phones
    .map((phone) => ({
      raw: phone.value ?? "",
      type: (phone.type ?? "").toLowerCase(),
      normalized: normalizePhone(phone.value),
    }))
    .filter((phone) => phone.normalized)

  if (normalized.length === 0) return null

  const mobileType = normalized.find((phone) =>
    ["mobile", "cell", "휴대폰", "휴대전화"].includes(phone.type),
  )
  if (mobileType?.normalized) return mobileType.normalized

  const krMobile = normalized.find((phone) =>
    phone.normalized!.startsWith("010"),
  )
  if (krMobile?.normalized) return krMobile.normalized

  return normalized[0].normalized
}
