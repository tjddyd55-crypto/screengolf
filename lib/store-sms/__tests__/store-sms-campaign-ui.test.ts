import { describe, expect, it } from "vitest"
import {
  buildStoreSmsCampaignUi,
  computeStoreSmsCampaignProgress,
  isStoreSmsBalanceInsufficientSignal,
  isStoreSmsPollingStatus,
  mapStoreSmsCampaignStatusLabel,
} from "@/lib/store-sms/store-sms-campaign-ui"

describe("store-sms campaign ui status", () => {
  it("maps internal statuses to Korean labels", () => {
    expect(mapStoreSmsCampaignStatusLabel("draft", "immediate").label).toBe(
      "초안",
    )
    expect(mapStoreSmsCampaignStatusLabel("scheduled", "scheduled").label).toBe(
      "예약 대기",
    )
    expect(mapStoreSmsCampaignStatusLabel("processing", "immediate").label).toBe(
      "발송 중",
    )
    expect(
      mapStoreSmsCampaignStatusLabel("processing", "immediate", {
        balancePaused: true,
      }).label,
    ).toBe("잔액 부족으로 일시 중단")
    expect(
      mapStoreSmsCampaignStatusLabel("processing", "scheduled").label,
    ).toBe("예약 발송 중")
    expect(mapStoreSmsCampaignStatusLabel("completed", "immediate").label).toBe(
      "완료",
    )
    expect(mapStoreSmsCampaignStatusLabel("completed", "scheduled").label).toBe(
      "예약 완료",
    )
    expect(mapStoreSmsCampaignStatusLabel("failed", "immediate").label).toBe(
      "실패",
    )
  })

  it("uses semantic tones", () => {
    expect(mapStoreSmsCampaignStatusLabel("completed", "immediate").tone).toBe(
      "green",
    )
    expect(mapStoreSmsCampaignStatusLabel("processing", "immediate").tone).toBe(
      "blue",
    )
    expect(mapStoreSmsCampaignStatusLabel("scheduled", "scheduled").tone).toBe(
      "orange",
    )
    expect(
      mapStoreSmsCampaignStatusLabel("processing", "immediate", {
        balancePaused: true,
      }).tone,
    ).toBe("yellow")
    expect(mapStoreSmsCampaignStatusLabel("failed", "immediate").tone).toBe(
      "red",
    )
  })
})

describe("store-sms campaign progress", () => {
  it("computes remaining and progress from aggregates", () => {
    const progress = computeStoreSmsCampaignProgress({
      total: 3021,
      sendable: 3002,
      success: 1850,
      failed: 0,
      excluded: 19,
      pending: 1152,
    })

    expect(progress.remaining).toBe(1152)
    expect(progress.processed).toBe(1869)
    expect(progress.progressPercent).toBe(61.9)
    expect(progress.successRatePercent).toBe(61.6)
  })

  it("detects balance insufficient signals", () => {
    expect(
      isStoreSmsBalanceInsufficientSignal({
        errorCode: "insufficient_balance",
        errorMessage: null,
      }),
    ).toBe(true)
    expect(
      isStoreSmsBalanceInsufficientSignal({
        errorCode: "provider_error",
        errorMessage: "문자 잔액이 부족합니다.",
      }),
    ).toBe(true)
    expect(
      isStoreSmsBalanceInsufficientSignal({
        errorCode: "timeout",
        errorMessage: "Gateway timeout",
      }),
    ).toBe(false)
  })

  it("hides retry placeholder during balance pause", () => {
    const progress = computeStoreSmsCampaignProgress({
      total: 100,
      sendable: 100,
      success: 40,
      failed: 5,
      excluded: 0,
      pending: 55,
    })
    const ui = buildStoreSmsCampaignUi({
      campaign: {
        status: "processing",
        send_mode: "immediate",
        failed_count: 5,
      },
      progress,
      balancePaused: true,
    })
    expect(ui.isBalancePaused).toBe(true)
    expect(ui.canShowRetryPlaceholder).toBe(false)
  })

  it("stops polling on terminal statuses", () => {
    expect(isStoreSmsPollingStatus("processing")).toBe(true)
    expect(isStoreSmsPollingStatus("completed")).toBe(false)
    expect(isStoreSmsPollingStatus("failed")).toBe(false)
    expect(isStoreSmsPollingStatus("partial")).toBe(false)
  })
})
