import { NextResponse } from "next/server"
import {
  deactivatePlanType,
  getPlanTypeById,
  updatePlanType,
} from "@/lib/db/store-plan-types"

export const dynamic = "force-dynamic"

type RouteContext = {
  params: Promise<{ id: string }>
}

function parseId(rawId: string): number | null {
  const id = Number(rawId)
  if (!Number.isInteger(id) || id <= 0) return null
  return id
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id: rawId } = await context.params
    const id = parseId(rawId)

    if (!id) {
      return NextResponse.json(
        { success: false, error: "유효하지 않은 id입니다." },
        { status: 400 },
      )
    }

    const body = (await request.json()) as {
      name?: string
      sort_order?: number
      is_active?: boolean
    }

    const data = updatePlanType(id, {
      name: body.name?.trim(),
      sort_order: body.sort_order,
      is_active: body.is_active,
    })

    if (!data) {
      return NextResponse.json(
        { success: false, error: "요금제를 찾을 수 없습니다." },
        { status: 404 },
      )
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error("[admin/plan-types/:id] PATCH failed:", error)
    return NextResponse.json(
      { success: false, error: "요금제 수정에 실패했습니다." },
      { status: 500 },
    )
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id: rawId } = await context.params
    const id = parseId(rawId)

    if (!id) {
      return NextResponse.json(
        { success: false, error: "유효하지 않은 id입니다." },
        { status: 400 },
      )
    }

    const existing = getPlanTypeById(id)
    if (!existing) {
      return NextResponse.json(
        { success: false, error: "요금제를 찾을 수 없습니다." },
        { status: 404 },
      )
    }

    const deleted = deactivatePlanType(id)
    if (!deleted) {
      return NextResponse.json(
        { success: false, error: "요금제 비활성 처리에 실패했습니다." },
        { status: 500 },
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[admin/plan-types/:id] DELETE failed:", error)
    return NextResponse.json(
      { success: false, error: "요금제 비활성 처리에 실패했습니다." },
      { status: 500 },
    )
  }
}
