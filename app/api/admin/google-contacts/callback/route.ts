import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import {
  exchangeAuthorizationCode,
  OAUTH_STATE_COOKIE,
  saveGoogleConnectionFromTokens,
} from "@/lib/google-contacts/google-oauth"

export const dynamic = "force-dynamic"

function googleContactsRedirect(query: string): NextResponse {
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.GOOGLE_CONTACTS_REDIRECT_URI?.replace(
      /\/api\/admin\/google-contacts\/callback$/,
      "",
    ) ||
    "http://localhost:3000"

  const response = NextResponse.redirect(
    new URL(`/admin/google-contacts?${query}`, base),
  )
  response.cookies.set(OAUTH_STATE_COOKIE, "", {
    httpOnly: true,
    path: "/",
    maxAge: 0,
  })
  return response
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const error = searchParams.get("error")
    if (error) {
      return googleContactsRedirect("googleError=oauth_denied")
    }

    const code = searchParams.get("code")
    const state = searchParams.get("state")
    if (!code || !state) {
      return googleContactsRedirect("googleError=oauth_invalid")
    }

    const cookieStore = await cookies()
    const savedState = cookieStore.get(OAUTH_STATE_COOKIE)?.value
    if (!savedState || savedState !== state) {
      return googleContactsRedirect("googleError=state_mismatch")
    }

    const tokens = await exchangeAuthorizationCode(code)
    await saveGoogleConnectionFromTokens(tokens)

    return googleContactsRedirect("googleConnected=1")
  } catch (error) {
    console.error("[google-contacts/callback] failed:", error)
    const message =
      error instanceof Error ? error.message : ""
    const code = message.includes("refresh_token")
      ? "refresh_token_missing"
      : "callback_failed"
    return googleContactsRedirect(`googleError=${code}`)
  }
}
