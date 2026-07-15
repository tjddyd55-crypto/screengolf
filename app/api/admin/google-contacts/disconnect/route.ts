import { NextResponse } from "next/server"
import { revokeAndDisconnect } from "@/lib/google-contacts/google-oauth"

export const dynamic = "force-dynamic"

export async function POST() {
  try {
    await revokeAndDisconnect()
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[google-contacts/disconnect] failed:", error)
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "연결 해제에 실패했습니다.",
      },
      { status: 500 },
    )
  }
}
