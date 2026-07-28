import { NextResponse } from "next/server"
import { resolveDisplayState } from "@/lib/display/resolve-display-state"
import type { DisplayStatePayload } from "@/lib/display/types"

export const dynamic = "force-dynamic"

function withBroadcastMeta(state: DisplayStatePayload) {
  if (state.mode === "off") {
    return {
      broadcastStatus: state.broadcastStatus,
      hasRenderableContent: state.hasRenderableContent,
    }
  }
  return {
    broadcastStatus: state.broadcastStatus ?? ("BROADCASTING" as const),
    hasRenderableContent: state.hasRenderableContent ?? true,
  }
}

export async function GET() {
  try {
    const state = resolveDisplayState()
    return NextResponse.json({
      success: true,
      ...state,
      ...withBroadcastMeta(state),
    })
  } catch (error) {
    console.error("[display-state] GET failed:", error)
    return NextResponse.json({ success: true, mode: "ranking" })
  }
}
