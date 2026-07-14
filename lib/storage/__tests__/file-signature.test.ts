import { describe, expect, it } from "vitest"
import {
  detectFileSignature,
  getNormalizedExtension,
  validateUploadBuffer,
} from "../file-signature"

function pngBuffer(): Buffer {
  return Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 0, 0, 0, 0,
  ])
}

function jpegJfifBuffer(): Buffer {
  return Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0])
}

function jpegExifBuffer(): Buffer {
  return Buffer.from([0xff, 0xd8, 0xff, 0xe1, 0, 0, 0, 0, 0, 0, 0, 0])
}

function webpBuffer(): Buffer {
  const buf = Buffer.alloc(12)
  buf.write("RIFF", 0, "ascii")
  buf.write("WEBP", 8, "ascii")
  return buf
}

function pdfBuffer(): Buffer {
  return Buffer.from("%PDF-1.7 sample")
}

describe("file-signature", () => {
  it("정상 PNG 허용", () => {
    const result = validateUploadBuffer(pngBuffer(), "notice.png", "image/png")
    expect(result.ok).toBe(true)
  })

  it("정상 JPEG JFIF 허용", () => {
    const result = validateUploadBuffer(
      jpegJfifBuffer(),
      "photo.jpg",
      "image/jpeg",
    )
    expect(result.ok).toBe(true)
  })

  it("정상 JPEG Exif 허용", () => {
    const result = validateUploadBuffer(
      jpegExifBuffer(),
      "photo.jpeg",
      "image/jpeg",
    )
    expect(result.ok).toBe(true)
  })

  it("정상 WebP 허용", () => {
    const result = validateUploadBuffer(webpBuffer(), "a.webp", "image/webp")
    expect(result.ok).toBe(true)
  })

  it("정상 PDF 허용", () => {
    const result = validateUploadBuffer(
      pdfBuffer(),
      "guide.pdf",
      "application/pdf",
    )
    expect(result.ok).toBe(true)
  })

  it("대문자 .PNG 허용", () => {
    expect(getNormalizedExtension("BANNER.PNG")).toBe(".png")
    const result = validateUploadBuffer(pngBuffer(), "BANNER.PNG", "image/png")
    expect(result.ok).toBe(true)
  })

  it(".jpeg 허용", () => {
    const result = validateUploadBuffer(
      jpegExifBuffer(),
      "cam.jpeg",
      "image/jpeg",
    )
    expect(result.ok).toBe(true)
  })

  it("PNG 내용을 .jpg로 이름 변경한 파일 거부", () => {
    const result = validateUploadBuffer(pngBuffer(), "fake.jpg", "image/jpeg")
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain("확장자와 실제 파일 형식")
    }
  })

  it("JPG 내용을 .png로 이름 변경한 파일 거부", () => {
    const result = validateUploadBuffer(
      jpegJfifBuffer(),
      "fake.png",
      "image/png",
    )
    expect(result.ok).toBe(false)
  })

  it("빈 파일 거부", () => {
    const result = validateUploadBuffer(Buffer.alloc(0), "a.png", "image/png")
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain("읽을 수 없습니다")
    }
  })

  it("임의 텍스트 파일 거부", () => {
    const result = validateUploadBuffer(
      Buffer.from("hello world!!!!"),
      "a.png",
      "image/png",
    )
    expect(result.ok).toBe(false)
  })

  it("HTML을 .png로 위장한 파일 거부", () => {
    const result = validateUploadBuffer(
      Buffer.from("<!DOCTYPE html><html></html>"),
      "hack.png",
      "image/png",
    )
    expect(result.ok).toBe(false)
  })

  it("브라우저 MIME이 비어있어도 확장자+signature가 일치하면 허용", () => {
    const result = validateUploadBuffer(pngBuffer(), "notice.png", "")
    expect(result.ok).toBe(true)
  })

  it("image/x-png MIME도 PNG로 허용", () => {
    const result = validateUploadBuffer(
      pngBuffer(),
      "notice.png",
      "image/x-png",
    )
    expect(result.ok).toBe(true)
  })

  it("JPEG 네 번째 바이트를 E0으로 제한하지 않는다", () => {
    expect(detectFileSignature(jpegExifBuffer())?.kind).toBe("jpeg")
    expect(detectFileSignature(jpegJfifBuffer())?.kind).toBe("jpeg")
  })
})

describe("display asset url", () => {
  it("API 기반 public URL을 생성한다", async () => {
    const { buildPublicAssetUrl } = await import("../display-storage")
    expect(buildPublicAssetUrl(12, "2026-07-14 11:39:52")).toContain(
      "/api/display-assets/file/12?v=",
    )
  })

  it("stored_name path traversal을 차단한다", async () => {
    const { resolveStoredFilePath } = await import("../display-storage")
    expect(resolveStoredFilePath("../etc/passwd")).toBeNull()
    expect(resolveStoredFilePath("safe-file.png")).not.toBeNull()
  })
})
