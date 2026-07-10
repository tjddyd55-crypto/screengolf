import { cookies } from "next/headers"
import { ADMIN_COOKIE_NAME } from "@/lib/admin/constants-auth"
import {
  createSessionToken,
  getSessionMaxAgeSec,
  verifySessionToken,
} from "@/lib/admin/session-token"

export { ADMIN_COOKIE_NAME } from "@/lib/admin/constants-auth"
export { verifyAdminPassword } from "@/lib/admin/session-token"

export async function issueAdminSession(): Promise<string> {
  return createSessionToken()
}

export async function isAdminAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies()
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value
  if (!token) return false
  return verifySessionToken(token)
}

export function getSessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: getSessionMaxAgeSec(),
  }
}
