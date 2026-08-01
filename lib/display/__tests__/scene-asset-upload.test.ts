import { describe, expect, it } from "vitest"
import {
  getUploadFileExtension,
  layoutTypeForSceneSlot,
  mergeUploadedAsset,
  SCENE_ASSET_ACCEPT,
  shouldShowSceneAssetUpload,
  validateClientUploadFile,
} from "@/lib/display/scene-asset-upload"
import { MAX_DISPLAY_FILE_SIZE } from "@/lib/admin/constants"

function fakeFile(
  name: string,
  size: number,
  type = "image/png",
): File {
  const buffer = new Uint8Array(Math.max(size, 1))
  return new File([buffer], name, { type })
}

describe("scene-asset-upload helpers", () => {
  it("shows upload only for media modes", () => {
    expect(shouldShowSceneAssetUpload("media_full")).toBe(true)
    expect(shouldShowSceneAssetUpload("media_split")).toBe(true)
    expect(shouldShowSceneAssetUpload("ranking")).toBe(false)
    expect(shouldShowSceneAssetUpload("notice")).toBe(false)
  })

  it("maps slot to layout_type for upload API", () => {
    expect(layoutTypeForSceneSlot("full")).toBe("full")
    expect(layoutTypeForSceneSlot("left")).toBe("split_left")
    expect(layoutTypeForSceneSlot("right")).toBe("split_right")
  })

  it("accept includes jpg/jpeg/png/webp/pdf", () => {
    expect(SCENE_ASSET_ACCEPT).toContain(".jpg")
    expect(SCENE_ASSET_ACCEPT).toContain(".jpeg")
    expect(SCENE_ASSET_ACCEPT).toContain(".png")
    expect(SCENE_ASSET_ACCEPT).toContain(".webp")
    expect(SCENE_ASSET_ACCEPT).toContain(".pdf")
  })

  it("rejects oversize files client-side", () => {
    const result = validateClientUploadFile(
      fakeFile("big.png", MAX_DISPLAY_FILE_SIZE + 1),
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain("20MB")
    }
  })

  it("rejects unsupported extension", () => {
    const result = validateClientUploadFile(fakeFile("note.txt", 10, "text/plain"))
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain("지원하지 않는")
    }
  })

  it("rejects empty file", () => {
    const empty = new File([], "empty.png", { type: "image/png" })
    const result = validateClientUploadFile(empty)
    expect(result.ok).toBe(false)
  })

  it("accepts png under limit", () => {
    expect(validateClientUploadFile(fakeFile("a.png", 1024)).ok).toBe(true)
    expect(validateClientUploadFile(fakeFile("a.PDF", 2048)).ok).toBe(true)
    expect(validateClientUploadFile(fakeFile("a.webp", 2048)).ok).toBe(true)
  })

  it("reads extension from file name", () => {
    expect(getUploadFileExtension("photo.JPEG")).toBe("jpeg")
    expect(getUploadFileExtension("noext")).toBe("")
  })

  it("merges uploaded asset to front without duplicate ids", () => {
    const merged = mergeUploadedAsset(
      [
        { id: 2, name: "old" },
        { id: 3, name: "other" },
      ],
      { id: 2, name: "new" },
    )
    expect(merged).toEqual([
      { id: 2, name: "new" },
      { id: 3, name: "other" },
    ])
  })
})
