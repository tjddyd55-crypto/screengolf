import { NextResponse } from "next/server"
import {
  createStoreSmsContactGroup,
  listGroupMemberIds,
  listStoreSmsContactGroups,
} from "@/lib/db/store-sms-groups"
import { listCartContactIds } from "@/lib/db/store-sms-cart"
import { resolveCartFromRequest } from "@/lib/store-sms/store-sms-cart-request"
import { summarizeStoreSmsTarget } from "@/lib/store-sms/store-sms-targets"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const groups = listStoreSmsContactGroups()
    const data = groups.map((group) => {
      const ids = listGroupMemberIds(group.id)
      const estimate = summarizeStoreSmsTarget({
        type: "selected",
        contactIds: ids,
      })
      return {
        ...group,
        sendableEstimate: estimate.sendable,
      }
    })
    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error("[store-sms/contact-groups] GET failed:", error)
    return NextResponse.json(
      { success: false, error: "그룹 목록 조회에 실패했습니다." },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      name?: string
      description?: string | null
      fromCart?: boolean
      contactIds?: number[]
    }

    let contactIds = Array.isArray(body.contactIds) ? body.contactIds : []
    if (body.fromCart) {
      const { cart } = resolveCartFromRequest(request)
      contactIds = listCartContactIds(cart.id)
    }
    if (contactIds.length === 0) {
      return NextResponse.json(
        { success: false, error: "저장할 연락처가 없습니다." },
        { status: 400 },
      )
    }

    const id = createStoreSmsContactGroup({
      name: body.name ?? "",
      description: body.description,
      contactIds,
    })
    return NextResponse.json({ success: true, groupId: id })
  } catch (error) {
    const code = error instanceof Error ? error.message : "create_failed"
    const messages: Record<string, string> = {
      name_required: "그룹명을 입력해 주세요.",
      name_duplicate: "같은 이름의 그룹이 이미 있습니다.",
    }
    return NextResponse.json(
      { success: false, error: messages[code] ?? "그룹 저장에 실패했습니다." },
      { status: 400 },
    )
  }
}
