import { NextResponse } from "next/server"
import { getStoreSmsModeLabel, getStoreSmsEnv } from "@/lib/store-sms/store-sms-env"
import {
  estimateSmsByteLength,
  resolveMessageType,
} from "@/lib/store-sms/store-sms-message"

export const dynamic = "force-dynamic"

export async function GET() {
  const env = getStoreSmsEnv()
  const mode = getStoreSmsModeLabel(env)
  return NextResponse.json({
    success: true,
    mode,
    enabled: env.enabled,
    dryRun: env.dryRun,
    provider: env.provider,
    timezone: env.timezone,
    sampleByteRules: {
      smsMaxBytes: 90,
      note: "EUC-KR approximate (ASCII 1 byte, other 2 bytes)",
    },
  })
}

export async function POST(request: Request) {
  const body = (await request.json()) as { message?: string }
  const message = body.message ?? ""
  return NextResponse.json({
    success: true,
    bytes: estimateSmsByteLength(message),
    messageType: resolveMessageType(message),
  })
}
