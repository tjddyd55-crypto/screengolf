export type GoogleContactsEnv = {
  clientId: string
  clientSecret: string
  redirectUri: string
  groupName: string
}

export function getGoogleContactsEnv(): GoogleContactsEnv {
  const clientId = process.env.GOOGLE_CONTACTS_CLIENT_ID?.trim()
  const clientSecret = process.env.GOOGLE_CONTACTS_CLIENT_SECRET?.trim()
  const redirectUri = process.env.GOOGLE_CONTACTS_REDIRECT_URI?.trim()
  const groupName = process.env.GOOGLE_CONTACTS_GROUP_NAME?.trim()

  const missing: string[] = []
  if (!clientId) missing.push("GOOGLE_CONTACTS_CLIENT_ID")
  if (!clientSecret) missing.push("GOOGLE_CONTACTS_CLIENT_SECRET")
  if (!redirectUri) missing.push("GOOGLE_CONTACTS_REDIRECT_URI")
  if (!groupName) missing.push("GOOGLE_CONTACTS_GROUP_NAME")

  if (missing.length > 0) {
    throw new Error(`Google 연락처 설정이 누락되었습니다: ${missing.join(", ")}`)
  }

  return {
    clientId: clientId!,
    clientSecret: clientSecret!,
    redirectUri: redirectUri!,
    groupName: groupName!,
  }
}

export const GOOGLE_CONTACTS_SCOPE =
  "https://www.googleapis.com/auth/contacts.readonly"

export const GOOGLE_OAUTH_AUTH_URL =
  "https://accounts.google.com/o/oauth2/v2/auth"
export const GOOGLE_OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token"
export const GOOGLE_OAUTH_REVOKE_URL = "https://oauth2.googleapis.com/revoke"
export const GOOGLE_USERINFO_URL =
  "https://www.googleapis.com/oauth2/v2/userinfo"
export const GOOGLE_PEOPLE_API_BASE =
  "https://people.googleapis.com/v1"
