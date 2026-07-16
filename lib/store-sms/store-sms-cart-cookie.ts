import { randomUUID } from "node:crypto"

export const STORE_SMS_CART_COOKIE = "store_sms_cart_key"

export function createStoreSmsCartKey(): string {
  return randomUUID()
}

export function parseStoreSmsCartKey(
  cookieHeader: string | null,
): string | null {
  if (!cookieHeader) return null
  const parts = cookieHeader.split(";")
  for (const part of parts) {
    const [rawKey, ...rest] = part.trim().split("=")
    if (rawKey === STORE_SMS_CART_COOKIE) {
      const value = decodeURIComponent(rest.join("=").trim())
      return value || null
    }
  }
  return null
}

export function buildStoreSmsCartCookie(cartKey: string): string {
  const maxAge = 60 * 60 * 24 * 30
  return `${STORE_SMS_CART_COOKIE}=${encodeURIComponent(cartKey)}; Path=/; Max-Age=${maxAge}; SameSite=Lax; HttpOnly`
}
