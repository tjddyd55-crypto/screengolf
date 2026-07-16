import { NextResponse } from "next/server"
import {
  getStoreSmsContactGroup,
  listGroupMembersPage,
  softDeleteStoreSmsContactGroup,
  updateStoreSmsContactGroup,
} from "@/lib/db/store-sms-groups"

export const dynamic = "force-dynamic"

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id: raw } = await context.params
    const id = Number(raw)
    const group = getStoreSmsContactGroup(id)
    if (!group) {
      return NextResponse.json(
        { success: false, error: "그룹을 찾을 수 없습니다." },
        { status: 404 },
      )
    }

    const { searchParams } = new URL(request.url)
    const members = listGroupMembersPage(id, {
      query: searchParams.get("query") ?? undefined,
      page: Number(searchParams.get("page") ?? 1),
      pageSize: Number(searchParams.get("pageSize") ?? 50),
    })

    return NextResponse.json({
      success: true,
      group,
      ...members,
    })
  } catch (error) {
    console.error("[store-sms/contact-groups/id] GET failed:", error)
    return NextResponse.json(
      { success: false, error: "그룹 조회에 실패했습니다." },
      { status: 500 },
    )
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id: raw } = await context.params
    const id = Number(raw)
    const body = (await request.json()) as {
      name?: string
      description?: string | null
      is_active?: boolean
    }
    const group = updateStoreSmsContactGroup(id, body)
    if (!group) {
      return NextResponse.json(
        { success: false, error: "그룹을 찾을 수 없습니다." },
        { status: 404 },
      )
    }
    return NextResponse.json({ success: true, group })
  } catch (error) {
    const code = error instanceof Error ? error.message : "update_failed"
    const messages: Record<string, string> = {
      name_required: "그룹명을 입력해 주세요.",
      name_duplicate: "같은 이름의 그룹이 이미 있습니다.",
    }
    return NextResponse.json(
      { success: false, error: messages[code] ?? "그룹 수정에 실패했습니다." },
      { status: 400 },
    )
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id: raw } = await context.params
    const id = Number(raw)
    const ok = softDeleteStoreSmsContactGroup(id)
    if (!ok) {
      return NextResponse.json(
        { success: false, error: "그룹을 찾을 수 없습니다." },
        { status: 404 },
      )
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[store-sms/contact-groups/id] DELETE failed:", error)
    return NextResponse.json(
      { success: false, error: "그룹 비활성에 실패했습니다." },
      { status: 500 },
    )
  }
}
