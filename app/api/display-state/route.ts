import { NextResponse } from "next/server"
import { resolveDisplayState } from "@/lib/display/resolve-display-state"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const state = resolveDisplayState()
    return NextResponse.json({ success: true, ...state })
  } catch (error) {
    console.error("[display-state] GET failed:", error)
    return NextResponse.json({ success: true, mode: "ranking" })
  }
}
