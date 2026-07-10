const SESSION_MAX_AGE_SEC = 24 * 60 * 60

function getSecret(): string {
  return (process.env.ADMIN_PASSWORD ?? "").trim()
}

async function hmacSha256(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(message),
  )

  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
}

export async function createSessionToken(): Promise<string> {
  const secret = getSecret()
  if (!secret) {
    throw new Error("ADMIN_PASSWORD 환경변수가 설정되지 않았습니다.")
  }

  const expires = Date.now() + SESSION_MAX_AGE_SEC * 1000
  const hmac = await hmacSha256(secret, String(expires))
  return `${expires}.${hmac}`
}

export async function verifySessionToken(token: string): Promise<boolean> {
  try {
    const secret = getSecret()
    if (!secret) return false

    const [expires, hmac] = token.split(".")
    if (!expires || !hmac) return false
    if (Date.now() > Number(expires)) return false

    const expected = await hmacSha256(secret, expires)
    if (hmac.length !== expected.length) return false

    let mismatch = 0
    for (let i = 0; i < hmac.length; i++) {
      mismatch |= hmac.charCodeAt(i) ^ expected.charCodeAt(i)
    }

    return mismatch === 0
  } catch {
    return false
  }
}

export function verifyAdminPassword(password: string): boolean {
  const expected = getSecret()
  if (!expected) return false
  if (password.length !== expected.length) return false

  let mismatch = 0
  for (let i = 0; i < password.length; i++) {
    mismatch |= password.charCodeAt(i) ^ expected.charCodeAt(i)
  }

  return mismatch === 0
}

export function getSessionMaxAgeSec(): number {
  return SESSION_MAX_AGE_SEC
}
