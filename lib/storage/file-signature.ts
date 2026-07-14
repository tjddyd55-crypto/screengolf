import path from "node:path"

export type DetectedKind = "jpeg" | "png" | "webp" | "pdf"

export type DetectedFileKind = {
  kind: DetectedKind
  mimeType: "image/jpeg" | "image/png" | "image/webp" | "application/pdf"
  extension: "jpg" | "png" | "webp" | "pdf"
  fileType: "image" | "pdf"
}

const KIND_BY_EXTENSION: Record<string, DetectedKind> = {
  ".jpg": "jpeg",
  ".jpeg": "jpeg",
  ".png": "png",
  ".webp": "webp",
  ".pdf": "pdf",
}

const MIME_BY_KIND: Record<DetectedKind, DetectedFileKind["mimeType"]> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  pdf: "application/pdf",
}

const EXTENSION_BY_KIND: Record<DetectedKind, DetectedFileKind["extension"]> = {
  jpeg: "jpg",
  png: "png",
  webp: "webp",
  pdf: "pdf",
}

const FILE_TYPE_BY_KIND: Record<DetectedKind, DetectedFileKind["fileType"]> = {
  jpeg: "image",
  png: "image",
  webp: "image",
  pdf: "pdf",
}

export function getNormalizedExtension(filename: string): string {
  return path.extname(filename).toLowerCase()
}

export function getExtensionKind(filename: string): DetectedKind | null {
  return KIND_BY_EXTENSION[getNormalizedExtension(filename)] ?? null
}

export function isAllowedExtension(filename: string): boolean {
  return getExtensionKind(filename) !== null
}

export function toHeadHex(buffer: Buffer, length = 16): string {
  return buffer.subarray(0, Math.min(length, buffer.length)).toString("hex")
}

function toDetected(kind: DetectedKind): DetectedFileKind {
  return {
    kind,
    mimeType: MIME_BY_KIND[kind],
    extension: EXTENSION_BY_KIND[kind],
    fileType: FILE_TYPE_BY_KIND[kind],
  }
}

export function detectFileSignature(buffer: Buffer): DetectedFileKind | null {
  if (buffer.length >= 3) {
    // JPEG: FF D8 FF — 네 번째 바이트는 JFIF/Exif 등 marker에 따라 달라짐
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return toDetected("jpeg")
    }
  }

  if (buffer.length >= 8) {
    const pngSignature = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ])
    if (buffer.subarray(0, 8).equals(pngSignature)) {
      return toDetected("png")
    }
  }

  if (buffer.length >= 4) {
    if (buffer.toString("ascii", 0, 4) === "%PDF") {
      return toDetected("pdf")
    }
  }

  if (buffer.length >= 12) {
    if (
      buffer.toString("ascii", 0, 4) === "RIFF" &&
      buffer.toString("ascii", 8, 12) === "WEBP"
    ) {
      return toDetected("webp")
    }
  }

  return null
}

function browserMimeMatchesKind(
  reportedMime: string,
  kind: DetectedKind,
): boolean {
  const normalized = reportedMime.trim().toLowerCase()

  // 브라우저가 MIME을 비우거나 generic으로내면 확장자+signature만으로 판정
  if (!normalized || normalized === "application/octet-stream") {
    return true
  }

  switch (kind) {
    case "jpeg":
      return (
        normalized === "image/jpeg" ||
        normalized === "image/jpg" ||
        normalized === "image/pjpeg"
      )
    case "png":
      return normalized === "image/png" || normalized === "image/x-png"
    case "webp":
      return normalized === "image/webp"
    case "pdf":
      return (
        normalized === "application/pdf" || normalized === "application/x-pdf"
      )
    default:
      return false
  }
}

export type ValidateUploadResult =
  | { ok: true; detected: DetectedFileKind }
  | { ok: false; error: string; reason: string }

export function validateUploadBuffer(
  buffer: Buffer,
  originalName: string,
  reportedMime: string,
): ValidateUploadResult {
  if (!buffer || buffer.length === 0) {
    return {
      ok: false,
      error: "파일 내용을 읽을 수 없습니다.",
      reason: "empty-buffer",
    }
  }

  const extension = getNormalizedExtension(originalName)
  const extensionKind = getExtensionKind(originalName)

  if (!extensionKind) {
    return {
      ok: false,
      error: "JPG, PNG, WebP, PDF 파일만 업로드할 수 있습니다.",
      reason: `unsupported-extension:${extension || "(none)"}`,
    }
  }

  const detected = detectFileSignature(buffer)
  if (!detected) {
    return {
      ok: false,
      error: "지원하지 않거나 손상된 파일입니다.",
      reason: `unknown-signature:head=${toHeadHex(buffer)}`,
    }
  }

  if (detected.kind !== extensionKind) {
    return {
      ok: false,
      error: "파일 확장자와 실제 파일 형식이 일치하지 않습니다.",
      reason: `extension-mismatch:ext=${extensionKind},detected=${detected.kind}`,
    }
  }

  if (!browserMimeMatchesKind(reportedMime, detected.kind)) {
    return {
      ok: false,
      error: "파일 확장자와 실제 파일 형식이 일치하지 않습니다.",
      reason: `mime-mismatch:mime=${reportedMime || "(empty)"},detected=${detected.kind}`,
    }
  }

  return { ok: true, detected }
}

export function buildUploadDiagnostic(input: {
  originalName: string
  browserMimeType: string
  buffer: Buffer
  detected: DetectedFileKind | null
  allowed: boolean
  reason?: string
}) {
  return {
    originalName: input.originalName,
    extension: getNormalizedExtension(input.originalName),
    mimeType: input.browserMimeType,
    size: input.buffer.length,
    headHex: toHeadHex(input.buffer),
    detectedType: input.detected?.kind ?? null,
    allowed: input.allowed,
    reason: input.reason ?? null,
  }
}
