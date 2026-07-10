import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import {
  ADMIN_COOKIE_NAME,
  getSessionCookieOptions,
  issueAdminSession,
  verifyAdminPassword,
} from "@/lib/admin/auth"

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { password?: string }
    const password = body.password?.trim() ?? ""

    if (!verifyAdminPassword(password)) {
      return NextResponse.json(
        { success: false, error: "비밀번호가 올바르지 않습니다." },
        { status: 401 },
      )
    }

    const token = await issueAdminSession()
    const cookieStore = await cookies()
    cookieStore.set(ADMIN_COOKIE_NAME, token, getSessionCookieOptions())

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[admin/auth/login] failed:", error)
    return NextResponse.json(
      { success: false, error: "로그인 처리 중 오류가 발생했습니다." },
      { status: 500 },
    )
  }
}
