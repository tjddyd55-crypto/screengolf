import { NextResponse } from "next/server"
import fs from "fs"
import { getDisplayAssetStorageMeta } from "@/lib/db/display-assets"
import {
  getFileStats,
  resolveStoredFilePath,
} from "@/lib/storage/display-storage"

export const dynamic = "force-dynamic"

type RouteContext = {
  params: Promise<{ id: string }>
}

function parseId(rawId: string): number | null {
  const id = Number(rawId)
  if (!Number.isInteger(id) || id <= 0) return null
  return id
}

function encodeContentDispositionFilename(filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7E]/g, "_")
  const encoded = encodeURIComponent(filename)
  return `inline; filename="${ascii}"; filename*=UTF-8''${encoded}`
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id: rawId } = await context.params
    const id = parseId(rawId)

    if (!id) {
      return NextResponse.json(
        { success: false, error: "유효하지 않은 id입니다." },
        { status: 400 },
      )
    }

    const meta = getDisplayAssetStorageMeta(id)
    if (!meta?.storedName) {
      console.warn(`[display-assets] assetId=${id} missing/storedName=null`)
      return new NextResponse("Not Found", { status: 404 })
    }

    const absolutePath = resolveStoredFilePath(meta.storedName)
    const stats = getFileStats(meta.storedName)

    console.log(
      `[display-assets] assetId=${id} exists=${stats.exists} size=${stats.sizeBytes ?? 0} mime=${meta.mimeType}`,
    )

    if (!absolutePath || !stats.exists) {
      return new NextResponse("Not Found", { status: 404 })
    }

    const fileBuffer = fs.readFileSync(absolutePath)

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": meta.mimeType,
        "Content-Length": String(fileBuffer.length),
        "Content-Disposition": encodeContentDispositionFilename(
          meta.originalName || meta.title || meta.storedName,
        ),
        "Cache-Control": "public, max-age=300",
      },
    })
  } catch (error) {
    console.error("[display-assets/file] GET failed:", error)
    return new NextResponse("Internal Server Error", { status: 500 })
  }
}
