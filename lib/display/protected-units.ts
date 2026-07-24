/** 시스템 기본 전광판 — 삭제·비활성 금지 (SSOT) */
export const PROTECTED_DISPLAY_UNIT_CODES = new Set([
  "display-1",
  "display-2",
])

export const PROTECTED_DISPLAY_UNIT_DELETE_ERROR =
  "기본 전광판은 삭제할 수 없습니다."

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
