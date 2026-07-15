import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import {
  estimateSmsByteLength,
  resolveMessageType,
  applyStoreSmsTemplate,
} from "@/lib/store-sms/store-sms-message"
import { isValidKoreanMobilePhone } from "@/lib/store-sms/store-sms-phone"
import { buildStoreSmsRecipientPlans } from "@/lib/store-sms/store-sms-targets"
import type { StoreGoogleContact } from "@/lib/db/store-google-contacts"

function contact(
  overrides: Partial<StoreGoogleContact> & Pick<StoreGoogleContact, "id" | "name">,
): StoreGoogleContact {
  return {
    google_resource_name: `people/${overrides.id}`,
    google_contact_etag: null,
    nickname: null,
    phone: "01012345678",
    normalized_phone: "01012345678",
    google_group_name: "가자 스크린",
    google_sync_status: "linked",
    is_active: true,
    memo: null,
    sms_opt_out: false,
    last_synced_at: null,
    created_at: "",
    updated_at: "",
    ...overrides,
  }
}

describe("store-sms message utils", () => {
  it("uses EUC-KR approximate byte rules", () => {
    expect(estimateSmsByteLength("A")).toBe(1)
    expect(estimateSmsByteLength("가")).toBe(2)
    expect(resolveMessageType("a".repeat(90))).toBe("SMS")
    expect(resolveMessageType("a".repeat(91))).toBe("LMS")
  })

  it("applies template fallbacks", () => {
    expect(applyStoreSmsTemplate("{이름}/{닉네임}", { name: "홍길동", nickname: "길동" })).toBe(
      "홍길동/길동",
    )
    expect(applyStoreSmsTemplate("{이름}", { name: "", nickname: "닉" })).toBe("닉")
    expect(applyStoreSmsTemplate("{이름}", { name: "", nickname: "" })).toBe("고객")
  })
})

describe("store-sms phone validation", () => {
  it("accepts korean mobile numbers only", () => {
    expect(isValidKoreanMobilePhone("010-1234-5678")).toBe(true)
    expect(isValidKoreanMobilePhone("+82 10 1234 5678")).toBe(true)
    expect(isValidKoreanMobilePhone("021234567")).toBe(false)
  })
})

describe("store-sms target exclusions", () => {
  it("excludes opt-out, inactive, invalid, duplicate, not_in_group", () => {
    const summary = buildStoreSmsRecipientPlans([
      contact({ id: 1, name: "정상" }),
      contact({ id: 2, name: "거부", sms_opt_out: true }),
      contact({ id: 3, name: "비활성", is_active: false }),
      contact({
        id: 4,
        name: "번호없음",
        phone: "",
        normalized_phone: "",
      }),
      contact({
        id: 5,
        name: "라벨제외",
        google_sync_status: "not_in_group",
      }),
      contact({
        id: 6,
        name: "중복",
        phone: "01012345678",
        normalized_phone: "01012345678",
      }),
    ])

    expect(summary.sendable).toBe(1)
    expect(summary.exclusionCounts.sms_opt_out).toBe(1)
    expect(summary.exclusionCounts.inactive).toBe(1)
    expect(summary.exclusionCounts.no_phone).toBe(1)
    expect(summary.exclusionCounts.not_in_group).toBe(1)
    expect(summary.exclusionCounts.duplicate_phone).toBe(1)
  })
})

describe("store-sms gateway dry-run", () => {
  const original = { ...process.env }

  beforeEach(() => {
    process.env.STORE_SMS_ENABLED = "false"
    process.env.STORE_SMS_DRY_RUN = "true"
  })

  afterEach(() => {
    process.env = { ...original }
    vi.resetModules()
  })

  it("does not call fetch when dry-run/disabled", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch")
    const { sendStoreSms } = await import("@/lib/store-sms/store-sms-gateway")
    const result = await sendStoreSms({
      to: "01012345678",
      message: "hello",
      campaignId: 1,
      recipientId: 1,
    })
    expect(result.success).toBe(true)
    expect(result.dryRun).toBe(true)
    expect(fetchSpy).not.toHaveBeenCalled()
    fetchSpy.mockRestore()
  })
})
