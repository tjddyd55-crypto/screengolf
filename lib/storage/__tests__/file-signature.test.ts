import { describe, expect, it } from "vitest"
import {
  detectFileSignature,
  validateUploadBuffer,
} from "../file-signature"

describe("file-signature", () => {
  it("PNG magic bytes를 인식한다", () => {
    const png = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0,
    ])
    expect(detectFileSignature(png)?.mimeType).toBe("image/png")
  })

  it("JPEG magic bytes를 인식한다", () => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0])
    expect(detectFileSignature(jpeg)?.mimeType).toBe("image/jpeg")
  })

  it("PDF magic bytes를 인식한다", () => {
    const pdf = Buffer.from("%PDF-1.4xxxx")
    expect(detectFileSignature(pdf)?.mimeType).toBe("application/pdf")
  })

  it("확장자 위장 파일을 거부한다", () => {
    const html = Buffer.from("<!DOCTYPE html><html></html>")
    const result = validateUploadBuffer(html, "hack.png", "image/png")
    expect(result.ok).toBe(false)
  })

  it("정상 PNG 업로드를 허용한다", () => {
    const png = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0,
    ])
    const result = validateUploadBuffer(png, "더위사냥.png", "image/png")
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.detected.extension).toBe("png")
    }
  })

  it("zip/html 확장자를 거부한다", () => {
    const zip = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0, 0, 0, 0, 0])
    expect(validateUploadBuffer(zip, "a.zip", "application/zip").ok).toBe(false)
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
