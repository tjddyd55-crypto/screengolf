import type { StoreSmsExclusionReason } from "@/lib/store-sms/store-sms-targets"

const LABELS: Record<StoreSmsExclusionReason, string> = {
  invalid_phone: "잘못된 전화번호",
  no_phone: "연락처 없음",
  sms_opt_out: "문자 수신거부",
  inactive: "비활성 고객",
  not_in_group: "Google 그룹 제외",
  duplicate_phone: "중복 전화번호",
  already_processed: "이미 처리됨",
}

export function storeSmsExclusionLabel(
  reason: string | null | undefined,
): string {
  if (!reason) return "제외"
  if (reason in LABELS) {
    return LABELS[reason as StoreSmsExclusionReason]
  }
  if (reason === "missing_name") return "이름 없음"
  if (reason === "variable_error") return "문자 변수 치환 실패"
  return reason
}

export function formatStoreSmsExclusionCounts(
  counts: Partial<Record<string, number>> | null | undefined,
): Array<{ reason: string; label: string; count: number }> {
  if (!counts) return []
  return Object.entries(counts)
    .filter(([, count]) => typeof count === "number" && count > 0)
    .map(([reason, count]) => ({
      reason,
      label: storeSmsExclusionLabel(reason),
      count: count as number,
    }))
    .sort((a, b) => b.count - a.count)
}
