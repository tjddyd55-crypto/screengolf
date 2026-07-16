import { NextResponse } from "next/server"
import { getDisplaySettings } from "@/lib/db/display-settings"
import { getDisplayUnitByCode } from "@/lib/db/display-units"
import { resolveDisplayState } from "@/lib/display/resolve-display-state"

export const dynamic = "force-dynamic"

type RouteContext = {
  params: Promise<{ unitCode: string }>
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { unitCode } = await context.params
    const code = unitCode?.trim()
    if (!code) {
      return NextResponse.json(
        { success: false, error: "전광판 코드가 필요합니다." },
        { status: 400 },
      )
    }

    const unit = getDisplayUnitByCode(code)
    if (!unit) {
      return NextResponse.json(
        { success: false, error: "전광판을 찾을 수 없습니다." },
        { status: 404 },
      )
    }

    const state = resolveDisplayState(code)
    let updatedAt: string | null = null
    try {
      updatedAt = getDisplaySettings(unit.id).updated_at
    } catch {
      updatedAt = null
    }

    return NextResponse.json({
      success: true,
      unit: {
        id: unit.id,
        code: unit.code,
        name: unit.name,
      },
      updatedAt,
      ...state,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : ""
    if (message === "UNIT_NOT_FOUND") {
      return NextResponse.json(
        { success: false, error: "전광판을 찾을 수 없습니다." },
        { status: 404 },
      )
    }
    console.error("[display-state/unit] GET failed:", error)
    return NextResponse.json({ success: true, mode: "ranking" })
  }
}
