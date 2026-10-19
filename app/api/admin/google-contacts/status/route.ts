import { NextResponse } from "next/server"
import { getGoogleConnectionHealth } from "@/lib/google-contacts/google-connection-health"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const probe = searchParams.get("probe") === "1"

    const health = await getGoogleConnectionHealth({ probe })

    return NextResponse.json({
      success: true,
      connected: health.connected,
      connectionState: health.connectionState,
      connectionMessage: health.message,
      accountEmail: health.accountEmail,
      groupName: health.groupName,
      connectedAt: health.connectedAt,
      lastSyncedAt: health.lastSyncedAt,
      lastSyncStatus: health.lastSyncStatus,
      lastSyncMessage: health.lastSyncMessage,
      tokenExpiresAt: health.tokenExpiresAt,
      hasRefreshToken: health.hasRefreshToken,
      probeErrorCode: health.probeErrorCode,
    })
  } catch (error) {
    console.error("[google-contacts/status] failed:", error)
    return NextResponse.json(
      { success: false, error: "연결 상태 조회에 실패했습니다." },
      { status: 500 },
    )
  }
}
