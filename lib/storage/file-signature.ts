export type DetectedFileKind = {
  mimeType: "image/jpeg" | "image/png" | "image/webp" | "application/pdf"
  extension: "jpg" | "png" | "webp" | "pdf"
  fileType: "image" | "pdf"
}

const ALLOWED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "pdf"])

export function getFileExtension(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? ""
  return ext
}

export function isAllowedExtension(filename: string): boolean {
  return ALLOWED_EXTENSIONS.has(getFileExtension(filename))
}

export function detectFileSignature(buffer: Buffer): DetectedFileKind | null {
  if (buffer.length < 12) {
    return null
  }

  // JPEG
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { mimeType: "image/jpeg", extension: "jpg", fileType: "image" }
  }

  // PNG
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return { mimeType: "image/png", extension: "png", fileType: "image" }
  }

  // PDF
  if (
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46
  ) {
    return { mimeType: "application/pdf", extension: "pdf", fileType: "pdf" }
  }

  // WebP: RIFF....WEBP
  const riff = buffer.subarray(0, 4).toString("ascii")
  const webp = buffer.subarray(8, 12).toString("ascii")
  if (riff === "RIFF" && webp === "WEBP") {
    return { mimeType: "image/webp", extension: "webp", fileType: "image" }
  }

  return null
}

export function validateUploadBuffer(
  buffer: Buffer,
  originalName: string,
  reportedMime: string,
): { ok: true; detected: DetectedFileKind } | { ok: false; error: string } {
  if (!isAllowedExtension(originalName)) {
    return { ok: false, error: "지원하지 않는 파일 형식입니다." }
  }

  const detected = detectFileSignature(buffer)
  if (!detected) {
    return {
      ok: false,
      error: "파일 내용과 확장자가 일치하지 않습니다.",
    }
  }

  const ext = getFileExtension(originalName)
  const extensionMatches =
    (detected.extension === "jpg" && (ext === "jpg" || ext === "jpeg")) ||
    detected.extension === ext

  if (!extensionMatches) {
    return {
      ok: false,
      error: "파일 내용과 확장자가 일치하지 않습니다.",
    }
  }

  const normalizedReported = reportedMime.trim().toLowerCase()
  if (
    normalizedReported &&
    normalizedReported !== detected.mimeType &&
    !(normalizedReported === "image/jpg" && detected.mimeType === "image/jpeg")
  ) {
    return {
      ok: false,
      error: "파일 내용과 확장자가 일치하지 않습니다.",
    }
  }

  return { ok: true, detected }
}
