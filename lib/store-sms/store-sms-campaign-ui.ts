import type {
  StoreSmsCampaign,
  StoreSmsCampaignStatus,
  StoreSmsSendMode,
} from "@/lib/db/store-sms"

export type StoreSmsUiStatusKey =
  | "draft"
  | "queued"
  | "sending"
  | "balance_paused"
  | "completed"
  | "failed"
  | "scheduled"
  | "scheduled_sending"
  | "scheduled_completed"
  | "cancelled"

export type StoreSmsUiTone =
  | "green"
  | "blue"
  | "orange"
  | "yellow"
  | "red"
  | "gray"

export type StoreSmsCampaignLiveCounts = {
  total: number
  sendable: number
  success: number
  failed: number
  excluded: number
  pending: number
  remaining: number
  processed: number
  progressPercent: number
  successRatePercent: number
}

export type StoreSmsCampaignUiView = {
  key: StoreSmsUiStatusKey
  label: string
  tone: StoreSmsUiTone
  isTerminal: boolean
  isBalancePaused: boolean
  canShowRetryPlaceholder: boolean
}

const BALANCE_CODE_PATTERN =
  /insufficient|no_?balance|balance_?short|out_of_credit|not_enough|lack_of|머니부족|잔액/i
const BALANCE_MESSAGE_PATTERN = /잔액|충전\s*후|insufficient\s*balance|no\s*balance|credit/i

export function isStoreSmsBalanceInsufficientSignal(input: {
  errorCode?: string | null
  errorMessage?: string | null
}): boolean {
  const code = input.errorCode?.trim() ?? ""
  const message = input.errorMessage?.trim() ?? ""
  if (code && BALANCE_CODE_PATTERN.test(code)) return true
  if (message && BALANCE_MESSAGE_PATTERN.test(message)) return true
  return false
}

export function computeStoreSmsCampaignProgress(input: {
  total: number
  sendable: number
  success: number
  failed: number
  excluded: number
  pending: number
}): StoreSmsCampaignLiveCounts {
  const total = Math.max(0, input.total)
  const sendable = Math.max(0, input.sendable)
  const success = Math.max(0, input.success)
  const failed = Math.max(0, input.failed)
  const excluded = Math.max(0, input.excluded)
  const pending = Math.max(0, input.pending)
  const remaining = pending
  const processed = success + failed + excluded
  const progressPercent =
    total <= 0 ? 0 : Math.min(100, Math.round((processed / total) * 1000) / 10)
  const successRatePercent =
    sendable <= 0
      ? 0
      : Math.min(100, Math.round((success / sendable) * 1000) / 10)

  return {
    total,
    sendable,
    success,
    failed,
    excluded,
    pending,
    remaining,
    processed,
    progressPercent,
    successRatePercent,
  }
}

export function mapStoreSmsCampaignStatusLabel(
  status: StoreSmsCampaignStatus | string,
  sendMode: StoreSmsSendMode | string,
  options?: { balancePaused?: boolean },
): StoreSmsCampaignUiView {
  const scheduled = sendMode === "scheduled"
  const balancePaused = options?.balancePaused === true

  if (status === "draft") {
    return {
      key: "draft",
      label: "초안",
      tone: "gray",
      isTerminal: false,
      isBalancePaused: false,
      canShowRetryPlaceholder: false,
    }
  }

  if (status === "scheduled") {
    return {
      key: "scheduled",
      label: "예약 대기",
      tone: "orange",
      isTerminal: false,
      isBalancePaused: false,
      canShowRetryPlaceholder: false,
    }
  }

  if (status === "processing") {
    if (balancePaused) {
      return {
        key: "balance_paused",
        label: "잔액 부족으로 일시 중단",
        tone: "yellow",
        isTerminal: false,
        isBalancePaused: true,
        canShowRetryPlaceholder: false,
      }
    }
    if (scheduled) {
      return {
        key: "scheduled_sending",
        label: "예약 발송 중",
        tone: "blue",
        isTerminal: false,
        isBalancePaused: false,
        canShowRetryPlaceholder: false,
      }
    }
    return {
      key: "sending",
      label: "발송 중",
      tone: "blue",
      isTerminal: false,
      isBalancePaused: false,
      canShowRetryPlaceholder: false,
    }
  }

  if (status === "completed" || status === "partial") {
    if (scheduled) {
      return {
        key: "scheduled_completed",
        label: "예약 완료",
        tone: "green",
        isTerminal: true,
        isBalancePaused: false,
        canShowRetryPlaceholder: status === "partial",
      }
    }
    return {
      key: "completed",
      label: "완료",
      tone: "green",
      isTerminal: true,
      isBalancePaused: false,
      canShowRetryPlaceholder: status === "partial",
    }
  }

  if (status === "failed") {
    return {
      key: "failed",
      label: "실패",
      tone: "red",
      isTerminal: true,
      isBalancePaused: false,
      canShowRetryPlaceholder: true,
    }
  }

  if (status === "cancelled") {
    return {
      key: "cancelled",
      label: "취소됨",
      tone: "gray",
      isTerminal: true,
      isBalancePaused: false,
      canShowRetryPlaceholder: false,
    }
  }

  return {
    key: "queued",
    label: "발송 대기",
    tone: "gray",
    isTerminal: false,
    isBalancePaused: false,
    canShowRetryPlaceholder: false,
  }
}

export function buildStoreSmsCampaignUi(input: {
  campaign: Pick<StoreSmsCampaign, "status" | "send_mode" | "failed_count">
  progress: StoreSmsCampaignLiveCounts
  balancePaused: boolean
}): StoreSmsCampaignUiView {
  const view = mapStoreSmsCampaignStatusLabel(
    input.campaign.status,
    input.campaign.send_mode,
    { balancePaused: input.balancePaused },
  )

  const hasFailed = input.progress.failed > 0 || input.campaign.failed_count > 0
  return {
    ...view,
    canShowRetryPlaceholder:
      view.canShowRetryPlaceholder && hasFailed && !view.isBalancePaused,
  }
}

export function isStoreSmsPollingStatus(status: string): boolean {
  return status === "processing" || status === "draft" || status === "scheduled"
}
