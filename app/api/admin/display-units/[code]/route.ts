import { NextResponse } from "next/server"
import {
  activateDisplayUnit,
  deleteDisplayUnitByCode,
  getDisplayUnitByCode,
  updateDisplayUnit,
} from "@/lib/db/display-units"
import { getDisplaySettingsView } from "@/lib/db/display-settings"
import {
  getUnitBroadcastState,
  toAdminBroadcastFields,
} from "@/lib/display/resolve-broadcast-state"
import {
  isProtectedDisplayUnitCode,
  normalizeDisplayUnitCode,
  protectedUnitDeactivateErrorMessage,
  protectedUnitDeleteErrorMessage,
} from "@/lib/display/protected-units"

export const dynamic = "force-dynamic"

type RouteContext = {
  params: Promise<{ code: string }>
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { code } = await context.params
    const unit = getDisplayUnitByCode(code)
    if (!unit) {
      return NextResponse.json(
        { success: false, error: "전광판을 찾을 수 없습니다." },
        { status: 404 },
      )
    }

    const settings = getDisplaySettingsView(unit.id)
    return NextResponse.json({
      success: true,
      data: {
        ...unit,
        current_mode: settings.mode,
        current_scene: settings.current_scene,
        settings_updated_at: settings.updated_at,
        ...toAdminBroadcastFields(getUnitBroadcastState(unit.id)),
      },
    })
  } catch (error) {
    console.error("[admin/display-units/code] GET failed:", error)
    return NextResponse.json(
      { success: false, error: "전광판 조회에 실패했습니다." },
      { status: 500 },
    )
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { code } = await context.params
    const unit = getDisplayUnitByCode(code)
    if (!unit) {
      return NextResponse.json(
        { success: false, error: "전광판을 찾을 수 없습니다." },
        { status: 404 },
      )
    }

    const body = (await request.json()) as {
      name?: string
      sort_order?: number
      is_active?: boolean
      action?: string
    }

    // 명시적 활성화 액션 — 보호 Unit도 허용
    if (body.action === "activate" || body.is_active === true) {
      const activated = activateDisplayUnit(unit.id)
      const patched =
        body.name !== undefined || body.sort_order !== undefined
          ? updateDisplayUnit(activated.id, {
              name: body.name,
              sort_order: body.sort_order,
            })
          : activated

      return NextResponse.json({
        success: true,
        data: {
          ...patched,
          ...toAdminBroadcastFields(getUnitBroadcastState(activated.id)),
        },
      })
    }

    const updated = updateDisplayUnit(unit.id, body)
    return NextResponse.json({
      success: true,
      data: {
        ...updated,
        ...toAdminBroadcastFields(getUnitBroadcastState(unit.id)),
      },
    })
  } catch (error) {
    console.error("[admin/display-units/code] PATCH failed:", error)
    const message =
      error instanceof Error ? error.message : "전광판 수정에 실패했습니다."
    const status =
      message === protectedUnitDeleteErrorMessage() ||
      message === protectedUnitDeactivateErrorMessage()
        ? 403
        : 400
    return NextResponse.json({ success: false, error: message }, { status })
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { code } = await context.params
    const trimmed = code?.trim() ?? ""

    if (!trimmed || !/^display-\d+$/i.test(trimmed)) {
      return NextResponse.json(
        { success: false, error: "올바르지 않은 전광판 코드입니다." },
        { status: 400 },
      )
    }

    const normalized = normalizeDisplayUnitCode(trimmed)

    if (isProtectedDisplayUnitCode(normalized)) {
      return NextResponse.json(
        {
          success: false,
          error: protectedUnitDeleteErrorMessage(),
        },
        { status: 403 },
      )
    }

    const existing = getDisplayUnitByCode(normalized)
    if (!existing) {
      return NextResponse.json(
        { success: false, error: "전광판을 찾을 수 없습니다." },
        { status: 404 },
      )
    }

    const deleted = deleteDisplayUnitByCode(normalized)
    return NextResponse.json({
      success: true,
      data: { code: deleted.code, name: deleted.name },
    })
  } catch (error) {
    console.error("[admin/display-units/code] DELETE failed:", error)
    const message =
      error instanceof Error ? error.message : "전광판 삭제에 실패했습니다."

    if (message === protectedUnitDeleteErrorMessage()) {
      return NextResponse.json({ success: false, error: message }, { status: 403 })
    }
    if (message.includes("올바르지 않은")) {
      return NextResponse.json({ success: false, error: message }, { status: 400 })
    }
    if (message.includes("찾을 수 없습니다")) {
      return NextResponse.json({ success: false, error: message }, { status: 404 })
    }
    return NextResponse.json({ success: false, error: message }, { status: 400 })
  }
}
