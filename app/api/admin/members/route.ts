import { NextResponse } from "next/server"
import {
  createMember,
  deactivateMember,
  getMemberById,
  listMembers,
  updateMember,
  type MemberFilter,
} from "@/lib/db/store-members"
import { getPlanTypeById } from "@/lib/db/store-plan-types"

export const dynamic = "force-dynamic"

function parseFilter(value: string | null): MemberFilter {
  if (!value || value === "all") return "all"
  if (value === "active" || value === "expired") return value

  const planId = Number(value)
  if (Number.isInteger(planId) && planId > 0) {
    return { type: "plan", id: planId }
  }

  return "all"
}

function validatePlanTypeId(planTypeId: number): string | null {
  const planType = getPlanTypeById(planTypeId)
  if (!planType) return "요금제를 찾을 수 없습니다."
  if (!planType.is_active) return "비활성 요금제는 선택할 수 없습니다."
  return null
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search") ?? undefined
    const filter = parseFilter(searchParams.get("filter"))

    const data = listMembers({ search, filter })
    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error("[admin/members] GET failed:", error)
    return NextResponse.json(
      { success: false, error: "회원 목록 조회에 실패했습니다." },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      name?: string
      nickname?: string | null
      phone?: string | null
      plan_type_id?: number
      expires_at?: string | null
      memo?: string | null
      is_active?: boolean
    }

    const name = body.name?.trim()
    if (!name) {
      return NextResponse.json(
        { success: false, error: "이름은 필수입니다." },
        { status: 400 },
      )
    }

    if (!body.plan_type_id) {
      return NextResponse.json(
        { success: false, error: "요금제는 필수입니다." },
        { status: 400 },
      )
    }

    const planError = validatePlanTypeId(body.plan_type_id)
    if (planError) {
      return NextResponse.json(
        { success: false, error: planError },
        { status: 400 },
      )
    }

    const data = createMember({
      name,
      nickname: body.nickname?.trim() || null,
      phone: body.phone?.trim() || null,
      plan_type_id: body.plan_type_id,
      expires_at: body.expires_at || null,
      memo: body.memo?.trim() || null,
      is_active: body.is_active ?? true,
    })

    return NextResponse.json({ success: true, data }, { status: 201 })
  } catch (error) {
    console.error("[admin/members] POST failed:", error)
    const message =
      error instanceof Error ? error.message : "회원 등록에 실패했습니다."
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    )
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as {
      id?: number
      name?: string
      nickname?: string | null
      phone?: string | null
      plan_type_id?: number
      expires_at?: string | null
      memo?: string | null
      is_active?: boolean
    }

    if (!body.id) {
      return NextResponse.json(
        { success: false, error: "id는 필수입니다." },
        { status: 400 },
      )
    }

    if (body.plan_type_id) {
      const current = getMemberById(body.id)
      const isPlanChanged =
        !current || current.plan_type_id !== body.plan_type_id

      if (isPlanChanged) {
        const planError = validatePlanTypeId(body.plan_type_id)
        if (planError) {
          return NextResponse.json(
            { success: false, error: planError },
            { status: 400 },
          )
        }
      }
    }

    const data = updateMember(body.id, {
      name: body.name?.trim(),
      nickname:
        body.nickname !== undefined ? body.nickname?.trim() || null : undefined,
      phone: body.phone !== undefined ? body.phone?.trim() || null : undefined,
      plan_type_id: body.plan_type_id,
      expires_at: body.expires_at,
      memo: body.memo !== undefined ? body.memo?.trim() || null : undefined,
      is_active: body.is_active,
    })

    if (!data) {
      return NextResponse.json(
        { success: false, error: "회원을 찾을 수 없습니다." },
        { status: 404 },
      )
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error("[admin/members] PATCH failed:", error)
    const message =
      error instanceof Error ? error.message : "회원 수정에 실패했습니다."
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    )
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = Number(searchParams.get("id"))

    if (!id) {
      return NextResponse.json(
        { success: false, error: "id는 필수입니다." },
        { status: 400 },
      )
    }

    const deleted = deactivateMember(id)
    if (!deleted) {
      return NextResponse.json(
        { success: false, error: "회원을 찾을 수 없습니다." },
        { status: 404 },
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[admin/members] DELETE failed:", error)
    return NextResponse.json(
      { success: false, error: "회원 삭제에 실패했습니다." },
      { status: 500 },
    )
  }
}
