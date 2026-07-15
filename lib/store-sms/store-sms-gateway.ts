import {
  getStoreSmsEnv,
  isStoreSmsLiveSendAllowed,
} from "@/lib/store-sms/store-sms-env"
import { resolveMessageType } from "@/lib/store-sms/store-sms-message"

export type StoreSmsSendInput = {
  to: string
  message: string
  campaignId?: number
  recipientId?: number
}

export type StoreSmsSendResult = {
  success: boolean
  provider: string
  dryRun: boolean
  messageId: string | null
  errorCode: string | null
  errorMessage: string | null
  requestSummary: Record<string, unknown>
  responseSummary: Record<string, unknown> | null
}

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "")
  if (digits.length < 7) return "***"
  return `${digits.slice(0, 3)}****${digits.slice(-4)}`
}

function buildPayload(input: StoreSmsSendInput, env = getStoreSmsEnv()) {
  return {
    provider: "aligo",
    user_id: env.aligoUserId,
    api_key: env.aligoApiKey,
    sender: env.sender,
    receiver: input.to.replace(/\D/g, ""),
    message: input.message,
    message_type: resolveMessageType(input.message),
    scheduled_at: null as string | null,
    testmode_yn: "N" as "Y" | "N",
    request_id:
      input.campaignId != null && input.recipientId != null
        ? `store-sms-${input.campaignId}-${input.recipientId}`
        : undefined,
  }
}

function summarizeRequest(payload: ReturnType<typeof buildPayload>) {
  return {
    provider: payload.provider,
    sender: payload.sender,
    receiverMasked: maskPhone(payload.receiver),
    messageType: payload.message_type,
    messageBytesApprox: payload.message.length,
    request_id: payload.request_id ?? null,
    testmode_yn: payload.testmode_yn,
    // api_key / token 절대 미포함
  }
}

async function postGateway(
  url: string,
  token: string,
  payload: ReturnType<typeof buildPayload>,
  timeoutMs: number,
): Promise<{ httpStatus: number; body: Record<string, unknown> | null; networkError: boolean }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
    let body: Record<string, unknown> | null = null
    try {
      body = (await res.json()) as Record<string, unknown>
    } catch {
      body = null
    }
    return { httpStatus: res.status, body, networkError: false }
  } catch {
    return { httpStatus: 0, body: null, networkError: true }
  } finally {
    clearTimeout(timer)
  }
}

function parseGatewayBody(
  body: Record<string, unknown> | null,
  meta: { httpStatus: number; networkError: boolean },
): {
  success: boolean
  messageId: string | null
  errorCode: string | null
  errorMessage: string | null
  responseSummary: Record<string, unknown>
} {
  if (meta.networkError) {
    return {
      success: false,
      messageId: null,
      errorCode: "network_error",
      errorMessage: "Gateway 네트워크 오류가 발생했습니다.",
      responseSummary: { network_error: true },
    }
  }
  if (meta.httpStatus === 401) {
    return {
      success: false,
      messageId: null,
      errorCode: "gateway_auth_error",
      errorMessage: "Gateway 인증에 실패했습니다.",
      responseSummary: { httpStatus: 401 },
    }
  }
  if (!body) {
    return {
      success: false,
      messageId: null,
      errorCode: "provider_error",
      errorMessage: "Gateway 응답을 해석하지 못했습니다.",
      responseSummary: { httpStatus: meta.httpStatus },
    }
  }

  const success = Boolean(body.success)
  const messageId =
    (body.providerMessageId as string | undefined) ??
    (body.provider_message_id as string | undefined) ??
    null
  if (!success) {
    return {
      success: false,
      messageId: null,
      errorCode: String(body.errorCode ?? body.error_code ?? "provider_error"),
      errorMessage: String(
        body.errorMessage ?? body.error_message ?? "문자 발송에 실패했습니다.",
      ),
      responseSummary: {
        httpStatus: meta.httpStatus,
        errorCode: body.errorCode ?? body.error_code ?? null,
      },
    }
  }

  return {
    success: true,
    messageId: messageId ? String(messageId) : null,
    errorCode: null,
    errorMessage: null,
    responseSummary: {
      httpStatus: meta.httpStatus,
      providerMessageId: messageId,
      testMode: body.testMode === true || body.test_mode === true,
    },
  }
}

const NON_RETRYABLE = new Set([
  "gateway_auth_error",
  "invalid_api_key",
  "invalid_receiver",
  "sender_not_registered",
])

export async function sendStoreSms(
  input: StoreSmsSendInput,
): Promise<StoreSmsSendResult> {
  const env = getStoreSmsEnv()
  const provider = env.provider || "ec2-aligo"
  const payload = buildPayload(input, env)
  const requestSummary = summarizeRequest(payload)

  if (!isStoreSmsLiveSendAllowed(env)) {
    return {
      success: true,
      provider,
      dryRun: true,
      messageId: `dry-run-${Date.now()}`,
      errorCode: null,
      errorMessage: null,
      requestSummary,
      responseSummary: {
        dryRun: true,
        enabled: env.enabled,
        reason: env.enabled ? "STORE_SMS_DRY_RUN" : "STORE_SMS_ENABLED=false",
      },
    }
  }

  if (
    !env.gatewayUrl ||
    !env.gatewayToken ||
    !env.sender ||
    !env.aligoUserId ||
    !env.aligoApiKey
  ) {
    return {
      success: false,
      provider,
      dryRun: false,
      messageId: null,
      errorCode: "gateway_not_configured",
      errorMessage: "문자 Gateway 환경변수가 설정되지 않았습니다.",
      requestSummary,
      responseSummary: { gateway_not_configured: true },
    }
  }

  const url = `${env.gatewayUrl}/send`
  let attempt = await postGateway(
    url,
    env.gatewayToken,
    payload,
    env.gatewayTimeoutMs,
  )
  let parsed = parseGatewayBody(attempt.body, attempt)

  if (
    !parsed.success &&
    parsed.errorCode &&
    !NON_RETRYABLE.has(parsed.errorCode) &&
    (attempt.networkError || parsed.errorCode === "network_error")
  ) {
    await new Promise((resolve) => setTimeout(resolve, 400))
    attempt = await postGateway(
      url,
      env.gatewayToken,
      payload,
      env.gatewayTimeoutMs,
    )
    parsed = parseGatewayBody(attempt.body, attempt)
  }

  return {
    success: parsed.success,
    provider,
    dryRun: false,
    messageId: parsed.messageId,
    errorCode: parsed.errorCode,
    errorMessage: parsed.errorMessage,
    requestSummary,
    responseSummary: parsed.responseSummary,
  }
}
