import { NextResponse } from "next/server"
import {
  createNotice,
  deleteNotice,
  getNoticeById,
  listNotices,
  updateNotice,
} from "@/lib/db/display-notices"
import { NOTICE_THEMES, type NoticeTheme } from "@/lib/admin/constants"

export const dynamic = "force-dynamic"

function isValidTheme(value: string): value is NoticeTheme {
  return NOTICE_THEMES.includes(value as NoticeTheme)
}

export async function GET() {
  try {
    const data = listNotices()
    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error("[admin/notices] GET failed:", error)
    return NextResponse.json(
      { success: false, error: "공지사항 목록 조회에 실패했습니다." },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      title?: string
      body?: string
      theme?: string
      is_active?: boolean
    }

    const title = body.title?.trim()
    const noticeBody = body.body?.trim()
    const theme = body.theme ?? "default"

    if (!title || !noticeBody) {
      return NextResponse.json(
        { success: false, error: "제목과 내용은 필수입니다." },
        { status: 400 },
      )
    }

    if (!isValidTheme(theme)) {
      return NextResponse.json(
        { success: false, error: "유효하지 않은 테마입니다." },
        { status: 400 },
      )
    }

    const data = createNotice({
      title,
      body: noticeBody,
      theme,
      is_active: body.is_active ?? true,
    })

    return NextResponse.json({ success: true, data }, { status: 201 })
  } catch (error) {
    console.error("[admin/notices] POST failed:", error)
    return NextResponse.json(
      { success: false, error: "공지사항 등록에 실패했습니다." },
      { status: 500 },
    )
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as {
      id?: number
      title?: string
      body?: string
      theme?: string
      is_active?: boolean
    }

    if (!body.id) {
      return NextResponse.json(
        { success: false, error: "id는 필수입니다." },
        { status: 400 },
      )
    }

    if (body.theme && !isValidTheme(body.theme)) {
      return NextResponse.json(
        { success: false, error: "유효하지 않은 테마입니다." },
        { status: 400 },
      )
    }

    const data = updateNotice(body.id, {
      title: body.title?.trim(),
      body: body.body?.trim(),
      theme: body.theme as NoticeTheme | undefined,
      is_active: body.is_active,
    })

    if (!data) {
      return NextResponse.json(
        { success: false, error: "공지사항을 찾을 수 없습니다." },
        { status: 404 },
      )
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error("[admin/notices] PATCH failed:", error)
    return NextResponse.json(
      { success: false, error: "공지사항 수정에 실패했습니다." },
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

    const deleted = deleteNotice(id)
    if (!deleted) {
      return NextResponse.json(
        { success: false, error: "공지사항을 찾을 수 없습니다." },
        { status: 404 },
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[admin/notices] DELETE failed:", error)
    return NextResponse.json(
      { success: false, error: "공지사항 삭제에 실패했습니다." },
      { status: 500 },
    )
  }
}
