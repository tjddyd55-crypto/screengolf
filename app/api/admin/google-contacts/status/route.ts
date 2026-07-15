import { NextResponse } from "next/server"
import {
  getActiveGoogleContactsConnection,
  maskEmail,
} from "@/lib/db/google-contacts"
import { getGoogleContactsEnv } from "@/lib/google-contacts/google-contacts-env"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    let groupName: string | null = null
    try {
      groupName = getGoogleContactsEnv().groupName
    } catch {
      groupName = null
    }

    const connection = getActiveGoogleContactsConnection()
    if (!connection) {
      return NextResponse.json({
        success: true,
        connected: false,
        accountEmail: null,
        groupName,
        connectedAt: null,
        lastSyncedAt: null,
        lastSyncStatus: null,
        lastSyncMessage: null,
      })
    }

    return NextResponse.json({
      success: true,
      connected: true,
      accountEmail: maskEmail(connection.google_account_email),
      groupName,
      connectedAt: connection.connected_at,
      lastSyncedAt: connection.last_synced_at,
      lastSyncStatus: connection.last_sync_status,
      lastSyncMessage: connection.last_sync_message,
    })
  } catch (error) {
    console.error("[google-contacts/status] failed:", error)
    return NextResponse.json(
      { success: false, error: "연결 상태 조회에 실패했습니다." },
      { status: 500 },
    )
  }
}
