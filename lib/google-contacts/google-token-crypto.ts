import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto"

const ALGORITHM = "aes-256-gcm"

function getEncryptionKey(): Buffer {
  const raw = process.env.GOOGLE_CONTACTS_TOKEN_ENCRYPTION_KEY?.trim()
  if (!raw) {
    throw new Error(
      "GOOGLE_CONTACTS_TOKEN_ENCRYPTION_KEY 환경변수가 설정되지 않았습니다.",
    )
  }

  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, "hex")
  }

  const asBase64 = Buffer.from(raw, "base64")
  if (asBase64.length === 32) {
    return asBase64
  }

  return createHash("sha256").update(raw, "utf8").digest()
}

/** 형식: base64(iv).base64(authTag).base64(ciphertext) */
export function encryptToken(plainText: string): string {
  const key = getEncryptionKey()
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([
    cipher.update(plainText, "utf8"),
    cipher.final(),
  ])
  const authTag = cipher.getAuthTag()
  return [
    iv.toString("base64"),
    authTag.toString("base64"),
    encrypted.toString("base64"),
  ].join(".")
}

export function decryptToken(payload: string): string {
  const key = getEncryptionKey()
  const parts = payload.split(".")
  if (parts.length !== 3) {
    throw new Error("토큰 암호문 형식이 올바르지 않습니다.")
  }

  const [ivB64, tagB64, dataB64] = parts
  const iv = Buffer.from(ivB64, "base64")
  const authTag = Buffer.from(tagB64, "base64")
  const data = Buffer.from(dataB64, "base64")

  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()])
  return decrypted.toString("utf8")
}

export function assertTokenEncryptionConfigured(): void {
  getEncryptionKey()
}
