import fs from "fs/promises"
import path from "path"
import crypto from "crypto"

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "display")
const PUBLIC_PREFIX = "/uploads/display"

export type SavedDisplayFile = {
  fileUrl: string
  absolutePath: string
  storedName: string
}

async function ensureUploadDir(): Promise<void> {
  await fs.mkdir(UPLOAD_DIR, { recursive: true })
}

function sanitizeBaseName(filename: string): string {
  const base = path.basename(filename)
  return base.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "file"
}

function buildStoredName(originalName: string): string {
  const suffix = crypto.randomBytes(6).toString("hex")
  return `${Date.now()}-${suffix}-${sanitizeBaseName(originalName)}`
}

export async function saveDisplayFile(
  buffer: Buffer,
  originalName: string,
): Promise<SavedDisplayFile> {
  await ensureUploadDir()

  const storedName = buildStoredName(originalName)
  const absolutePath = path.join(UPLOAD_DIR, storedName)
  await fs.writeFile(absolutePath, buffer)

  return {
    fileUrl: `${PUBLIC_PREFIX}/${storedName}`,
    absolutePath,
    storedName,
  }
}

export async function deleteDisplayFile(fileUrl: string): Promise<boolean> {
  if (!fileUrl.startsWith(`${PUBLIC_PREFIX}/`)) {
    return false
  }

  const storedName = path.basename(fileUrl)
  const absolutePath = path.join(UPLOAD_DIR, storedName)

  try {
    await fs.unlink(absolutePath)
    return true
  } catch {
    return false
  }
}

export function resolveDisplayFilePath(fileUrl: string): string | null {
  if (!fileUrl.startsWith(`${PUBLIC_PREFIX}/`)) {
    return null
  }

  const storedName = path.basename(fileUrl)
  return path.join(UPLOAD_DIR, storedName)
}
