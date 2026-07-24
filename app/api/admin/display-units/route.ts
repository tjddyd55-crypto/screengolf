import { NextResponse } from "next/server"
import {
  createDisplayUnit,
  listDisplayUnits,
} from "@/lib/db/display-units"
import { getDisplaySettingsView } from "@/lib/db/display-settings"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const units = listDisplayUnits()
    const data = units.map((unit) => {
      let settings = null
      try {
        settings = getDisplaySettingsView(unit.id)
      } catch {
        settings = null
      }
      return {
        ...unit,
        current_mode: settings?.mode ?? "ranking",
        current_scene: settings?.current_scene ?? null,
        settings_updated_at: settings?.updated_at ?? null,
      }
    })

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error("[admin/display-units] GET failed:", error)
    return NextResponse.json(
      { success: false, error: "전광판 목록 조회에 실패했습니다." },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      name?: string
      code?: string
      sort_order?: number
    }

    const unit = createDisplayUnit({
      name: body.name,
      code: body.code,
      sort_order: body.sort_order,
    })

    return NextResponse.json({ success: true, data: unit }, { status: 201 })
  } catch (error) {
    console.error("[admin/display-units] POST failed:", error)
    const message =
      error instanceof Error ? error.message : "전광판 생성에 실패했습니다."
    return NextResponse.json(
      { success: false, error: message },
      { status: 400 },
    )
  }
}
