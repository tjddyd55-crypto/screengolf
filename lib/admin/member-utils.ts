export type RemainingDaysStatus = "normal" | "warning" | "expired"

export function calcRemainingDays(expiresAt: string | null): number | null {
  if (!expiresAt) return null

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const expiry = new Date(expiresAt)
  expiry.setHours(0, 0, 0, 0)

  const diffMs = expiry.getTime() - today.getTime()
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24))
}

export function formatRemainingDays(expiresAt: string | null): string {
  const days = calcRemainingDays(expiresAt)
  if (days === null) return "-"
  if (days < 0) return "만료"
  if (days === 0) return "D-0"
  return `D-${days}`
}

export function getRemainingDaysStatus(
  expiresAt: string | null,
): RemainingDaysStatus {
  const days = calcRemainingDays(expiresAt)
  if (days === null) return "normal"
  if (days < 0) return "expired"
  if (days <= 7) return "warning"
  return "normal"
}
