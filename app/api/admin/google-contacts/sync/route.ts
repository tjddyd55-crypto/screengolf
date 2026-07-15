import { NextResponse } from "next/server"
import {
  isGoogleSyncRunning,
  runGoogleContactsSync,
} from "@/lib/google-contacts/google-contact-sync"

export const dynamic = "force-dynamic"

export async function POST() {
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

    const result = await runGoogleContactsSync()
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
    return NextResponse.json(
      { success: false, error: message },
      { status: 400 },
    )
  }
}
