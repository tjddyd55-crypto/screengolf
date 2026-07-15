import { NextResponse } from "next/server"
import {
  deactivateStoreGoogleContact,
  getStoreGoogleContactById,
  updateStoreGoogleContactAdmin,
} from "@/lib/db/store-google-contacts"

export const dynamic = "force-dynamic"

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id: idRaw } = await context.params
    const id = Number(idRaw)
    if (!id) {
      return NextResponse.json(
        { success: false, error: "id가 올바르지 않습니다." },
        { status: 400 },
      )
    }

    const body = (await request.json()) as {
      nickname?: string | null
      memo?: string | null
      sms_opt_out?: boolean
      is_active?: boolean
    }

    const data = updateStoreGoogleContactAdmin(id, {
      nickname:
        body.nickname !== undefined
          ? body.nickname?.trim() || null
          : undefined,
      memo: body.memo !== undefined ? body.memo?.trim() || null : undefined,
      sms_opt_out: body.sms_opt_out,
      is_active: body.is_active,
    })

    if (!data) {
      return NextResponse.json(
        { success: false, error: "연락처를 찾을 수 없습니다." },
        { status: 404 },
      )
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error("[google-contacts/id] PATCH failed:", error)
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "수정에 실패했습니다.",
      },
      { status: 500 },
    )
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id: idRaw } = await context.params
    const id = Number(idRaw)
    if (!id) {
      return NextResponse.json(
        { success: false, error: "id가 올바르지 않습니다." },
        { status: 400 },
      )
    }

    if (!getStoreGoogleContactById(id)) {
      return NextResponse.json(
        { success: false, error: "연락처를 찾을 수 없습니다." },
        { status: 404 },
      )
    }

    deactivateStoreGoogleContact(id)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[google-contacts/id] DELETE failed:", error)
    return NextResponse.json(
      { success: false, error: "비활성 처리에 실패했습니다." },
      { status: 500 },
    )
  }
}
