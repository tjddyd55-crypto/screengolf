/** 시스템 기본 전광판 — 삭제·비활성 금지, 활성화는 허용 (SSOT) */
export const PROTECTED_DISPLAY_UNIT_CODES = new Set([
  "display-1",
  "display-2",
])

export const PROTECTED_DISPLAY_UNIT_DELETE_ERROR =
  "기본 전광판은 삭제할 수 없습니다."

export const PROTECTED_DISPLAY_UNIT_DEACTIVATE_ERROR =
  "기본 전광판은 비활성화할 수 없습니다."

export function normalizeDisplayUnitCode(
  code: string | null | undefined,
): string {
  return (code ?? "").trim().toLowerCase()
}

export function isProtectedDisplayUnitCode(
  code: string | null | undefined,
): boolean {
  const normalized = normalizeDisplayUnitCode(code)
  if (!normalized) return false
  return PROTECTED_DISPLAY_UNIT_CODES.has(normalized)
}

export function protectedUnitDeleteErrorMessage(): string {
  return PROTECTED_DISPLAY_UNIT_DELETE_ERROR
}

export function protectedUnitDeactivateErrorMessage(): string {
  return PROTECTED_DISPLAY_UNIT_DEACTIVATE_ERROR
}

/** 보호 Unit도 비활성 → 활성 전환은 허용한다. */
export function canActivateDisplayUnit(
  code: string | null | undefined,
): boolean {
  return Boolean(normalizeDisplayUnitCode(code))
}

/** 보호 Unit은 활성 → 비활성 전환을 금지한다. */
export function canDeactivateDisplayUnit(
  code: string | null | undefined,
): boolean {
  return !isProtectedDisplayUnitCode(code)
}
