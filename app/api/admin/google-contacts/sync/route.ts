import { NextResponse } from "next/server"
import {
  isGoogleSyncRunning,
  runGoogleContactsSync,
} from "@/lib/google-contacts/google-contact-sync"
import {
  isGoogleContactsAuthError,
  type GoogleConnectionState,
} from "@/lib/google-contacts/google-oauth-errors"

export const dynamic = "force-dynamic"

function httpStatusForAuthState(state: GoogleConnectionState): number {
  if (state === "transient_error") return 503
  if (state === "not_connected" || state === "config_error") return 400
  return 400
}

export async function POST(request: Request) {
  try {
    if (isGoogleSyncRunning()) {
      return NextResponse.json(
        {
          success: false,
          error: "이미 동기화가 진행 중입니다. 잠시 후 다시 시도해 주세요.",
        },
        { status: 409 },
      )
    }

    let dryRun = false
    try {
      const body = (await request.json()) as { dryRun?: boolean }
      dryRun = body.dryRun === true
    } catch {
      dryRun = false
    }

    const result = await runGoogleContactsSync({ dryRun })
    return NextResponse.json({
      success: true,
      groupName: result.groupName,
      googleContactCount: result.googleContactCount,
      created: result.created,
      updated: result.updated,
      unchanged: result.unchanged,
      skipped: result.skipped,
      conflicts: result.conflicts,
      removedFromGroup: result.removedFromGroup,
      completedAt: result.completedAt,
      status: result.status,
      message: result.message,
    })
  } catch (error) {
    console.error("[google-contacts/sync] failed:", error)
    const message =
      error instanceof Error ? error.message : "동기화에 실패했습니다."
    const connectionState = isGoogleContactsAuthError(error)
      ? error.state
      : undefined
    const status = connectionState
      ? httpStatusForAuthState(connectionState)
      : 400
    return NextResponse.json(
      { success: false, error: message, connectionState },
      { status },
    )
  }
}
