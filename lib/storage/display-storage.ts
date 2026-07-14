import fs from "fs/promises"
import fsSync from "fs"
import path from "path"
import crypto from "crypto"
import {
  ensureDisplayAssetDir as ensureDisplayAssetDirPath,
  getDisplayAssetDir,
  isPersistentVolumeConfigured,
} from "@/lib/storage/data-paths"

export function ensureDisplayAssetDir(): string {
  return ensureDisplayAssetDirPath()
}

const LEGACY_PUBLIC_DIR = path.join(
  process.cwd(),
  "public",
  "uploads",
  "display",
)
const LEGACY_PUBLIC_PREFIX = "/uploads/display"

export type SavedDisplayFile = {
  absolutePath: string
  storedName: string
  sizeBytes: number
}

export type DisplayStorageDiagnostics = {
  assetDir: string
  persistentVolume: boolean
  writable: boolean
  exists: boolean
}

function isSafeStoredName(storedName: string): boolean {
  if (!storedName || storedName.includes("..") || storedName.includes("/") || storedName.includes("\\")) {
    return false
  }

  return /^[a-zA-Z0-9._-]+$/.test(storedName)
}

export function buildPublicAssetUrl(
  assetId: number,
  updatedAt?: string | null,
): string {
  const version = updatedAt
    ? Date.parse(updatedAt.replace(" ", "T") + "Z") || Date.now()
    : Date.now()
  return `/api/display-assets/file/${assetId}?v=${version}`
}

export function getDisplayStorageDiagnostics(): DisplayStorageDiagnostics {
  const assetDir = getDisplayAssetDir()
  const exists = fsSync.existsSync(assetDir)
  let writable = false

  if (exists) {
    const probePath = path.join(assetDir, ".write-probe")
    try {
      fsSync.writeFileSync(probePath, "ok", "utf8")
      fsSync.unlinkSync(probePath)
      writable = true
    } catch {
      writable = false
    }
  }

  return {
    assetDir,
    persistentVolume: isPersistentVolumeConfigured(),
    writable,
    exists,
  }
}

export async function saveDisplayFile(
  buffer: Buffer,
  extension: string,
): Promise<SavedDisplayFile> {
  const assetDir = ensureDisplayAssetDir()
  const safeExt = extension.replace(/^\./, "").toLowerCase()
  const storedName = `${crypto.randomUUID()}.${safeExt}`

  if (!isSafeStoredName(storedName)) {
    throw new Error("안전한 저장 파일명을 생성하지 못했습니다.")
  }

  const absolutePath = path.join(assetDir, storedName)
  await fs.writeFile(absolutePath, buffer)

  return {
    absolutePath,
    storedName,
    sizeBytes: buffer.length,
  }
}

export function resolveStoredFilePath(storedName: string): string | null {
  if (!isSafeStoredName(storedName)) {
    return null
  }

  const assetDir = getDisplayAssetDir()
  const absolutePath = path.join(assetDir, storedName)
  const resolved = path.resolve(absolutePath)

  if (!resolved.startsWith(path.resolve(assetDir) + path.sep)) {
    return null
  }

  return resolved
}

export async function deleteStoredFile(storedName: string): Promise<boolean> {
  const absolutePath = resolveStoredFilePath(storedName)
  if (!absolutePath) {
    return false
  }

  try {
    await fs.unlink(absolutePath)
    return true
  } catch {
    return false
  }
}

/** @deprecated file_url 기반 삭제 호환 */
export async function deleteDisplayFile(
  fileUrlOrStoredName: string,
): Promise<boolean> {
  if (fileUrlOrStoredName.startsWith(LEGACY_PUBLIC_PREFIX + "/")) {
    const legacyName = path.basename(fileUrlOrStoredName)
    const legacyPath = path.join(LEGACY_PUBLIC_DIR, legacyName)
    try {
      await fs.unlink(legacyPath)
    } catch {
      // ignore
    }
  }

  const storedName = path.basename(fileUrlOrStoredName.split("?")[0] ?? "")
  return deleteStoredFile(storedName)
}

export function migrateLegacyFileIfPresent(
  legacyFileUrl: string,
  preferredStoredName?: string | null,
): { storedName: string; migrated: boolean } | null {
  if (!legacyFileUrl.startsWith(LEGACY_PUBLIC_PREFIX + "/")) {
    return null
  }

  const legacyName = path.basename(legacyFileUrl)
  const legacyPath = path.join(LEGACY_PUBLIC_DIR, legacyName)
  if (!fsSync.existsSync(legacyPath)) {
    return null
  }

  const assetDir = ensureDisplayAssetDir()
  const extension = path.extname(legacyName) || ".bin"
  const storedName =
    preferredStoredName && isSafeStoredName(preferredStoredName)
      ? preferredStoredName
      : `${crypto.randomUUID()}${extension}`
  const destination = path.join(assetDir, storedName)

  fsSync.copyFileSync(legacyPath, destination)
  return { storedName, migrated: true }
}

export function fileExists(storedName: string): boolean {
  const absolutePath = resolveStoredFilePath(storedName)
  return Boolean(absolutePath && fsSync.existsSync(absolutePath))
}

export function getFileStats(storedName: string): {
  exists: boolean
  sizeBytes: number | null
  absolutePath: string | null
} {
  const absolutePath = resolveStoredFilePath(storedName)
  if (!absolutePath || !fsSync.existsSync(absolutePath)) {
    return { exists: false, sizeBytes: null, absolutePath }
  }

  return {
    exists: true,
    sizeBytes: fsSync.statSync(absolutePath).size,
    absolutePath,
  }
}
