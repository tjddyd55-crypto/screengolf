/** 보험 CRM과 동일한 EUC-KR 근사 바이트 계산 (ASCII 1, 그 외 2). */
export function estimateSmsByteLength(text: string): number {
  let bytes = 0
  for (const ch of String(text ?? "")) {
    const code = ch.charCodeAt(0)
    bytes += code <= 0x7f ? 1 : 2
  }
  return bytes
}

export function resolveMessageType(message: string): "SMS" | "LMS" {
  return estimateSmsByteLength(message) <= 90 ? "SMS" : "LMS"
}

export function resolveTemplateName(contact: {
  name?: string | null
  nickname?: string | null
}): string {
  const name = contact.name?.trim()
  if (name) return name
  const nickname = contact.nickname?.trim()
  if (nickname) return nickname
  return "고객"
}

export function applyStoreSmsTemplate(
  template: string,
  contact: { name?: string | null; nickname?: string | null },
): string {
  const displayName = resolveTemplateName(contact)
  const nickname = contact.nickname?.trim() || displayName
  return String(template ?? "")
    .replaceAll("{이름}", displayName)
    .replaceAll("{닉네임}", nickname)
}
