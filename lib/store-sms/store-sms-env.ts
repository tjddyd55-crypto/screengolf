function readBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value == null || value.trim() === "") return fallback
  const normalized = value.trim().toLowerCase()
  if (["1", "true", "yes", "y", "on"].includes(normalized)) return true
  if (["0", "false", "no", "n", "off"].includes(normalized)) return false
  return fallback
}

export type StoreSmsEnv = {
  enabled: boolean
  dryRun: boolean
  provider: string
  gatewayUrl: string
  gatewayToken: string
  sender: string
  aligoUserId: string
  aligoApiKey: string
  cronSecret: string
  timezone: string
  gatewayTimeoutMs: number
}

export function getStoreSmsEnv(): StoreSmsEnv {
  const timeoutRaw = Number(process.env.STORE_SMS_GATEWAY_TIMEOUT_MS ?? 10000)
  const gatewayTimeoutMs =
    Number.isFinite(timeoutRaw) && timeoutRaw >= 3000
      ? Math.min(timeoutRaw, 20000)
      : 10000

  return {
    enabled: readBoolean(process.env.STORE_SMS_ENABLED, false),
    dryRun: readBoolean(process.env.STORE_SMS_DRY_RUN, true),
    provider: String(process.env.STORE_SMS_PROVIDER ?? "ec2-aligo").trim(),
    gatewayUrl: String(process.env.STORE_SMS_GATEWAY_URL ?? "")
      .trim()
      .replace(/\/$/, ""),
    gatewayToken: String(process.env.STORE_SMS_GATEWAY_TOKEN ?? "").trim(),
    sender: String(process.env.STORE_SMS_SENDER ?? "").replace(/\D/g, ""),
    aligoUserId: String(process.env.STORE_SMS_ALIGO_USER_ID ?? "").trim(),
    aligoApiKey: String(process.env.STORE_SMS_ALIGO_API_KEY ?? "").trim(),
    cronSecret: String(process.env.STORE_SMS_CRON_SECRET ?? "").trim(),
    timezone: String(process.env.STORE_SMS_TIMEZONE ?? "Asia/Seoul").trim() || "Asia/Seoul",
    gatewayTimeoutMs,
  }
}

/** 실제 Gateway 호출은 enabled=true 이고 dryRun=false 일 때만 허용한다. */
export function isStoreSmsLiveSendAllowed(env = getStoreSmsEnv()): boolean {
  return env.enabled && !env.dryRun
}

export function getStoreSmsModeLabel(env = getStoreSmsEnv()): {
  live: boolean
  label: string
} {
  if (isStoreSmsLiveSendAllowed(env)) {
    return { live: true, label: "실발송 활성화됨" }
  }
  return {
    live: false,
    label: "테스트 모드: 실제 문자가 발송되지 않습니다.",
  }
}
