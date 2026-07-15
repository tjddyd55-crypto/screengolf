import { NextResponse } from "next/server"
import {
  buildGoogleAuthUrl,
  createOAuthState,
  OAUTH_STATE_COOKIE,
} from "@/lib/google-contacts/google-oauth"
import { assertTokenEncryptionConfigured } from "@/lib/google-contacts/google-token-crypto"
import { getGoogleContactsEnv } from "@/lib/google-contacts/google-contacts-env"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    getGoogleContactsEnv()
    assertTokenEncryptionConfigured()

    const state = createOAuthState()
    const url = buildGoogleAuthUrl(state)

    const response = NextResponse.redirect(url)
    response.cookies.set(OAUTH_STATE_COOKIE, state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 10,
    })
    return response
  } catch (error) {
    console.error("[google-contacts/connect] failed:", error)
    const code =
      error instanceof Error && error.message.includes("환경변수")
        ? "config_missing"
        : "connect_failed"
    return NextResponse.redirect(
      new URL(
        `/admin/google-contacts?googleError=${code}`,
        process.env.NEXT_PUBLIC_APP_URL ||
          process.env.GOOGLE_CONTACTS_REDIRECT_URI?.replace(
            /\/api\/admin\/google-contacts\/callback$/,
            "",
          ) ||
          "http://localhost:3000",
      ),
    )
  }
}
