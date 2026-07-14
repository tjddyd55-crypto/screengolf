"use client"

import DisplayMediaRenderer from "@/components/display/DisplayMediaRenderer"

export type PreviewAsset = {
  id: number
  title: string
  file_url?: string
  fileUrl?: string
  file_type?: "image" | "pdf"
  fileType?: "image" | "pdf"
  mime_type?: string
  mimeType?: string
  original_name?: string
  originalName?: string
  file_missing?: boolean
  fileMissing?: boolean
}

type ScenePreviewFrameProps = {
  mode: "ranking" | "notice" | "media_full" | "media_split"
  fullAsset?: PreviewAsset | null
  leftAsset?: PreviewAsset | null
  rightAsset?: PreviewAsset | null
  noticeTitle?: string | null
  adminMode?: boolean
}

function resolveUrl(asset: PreviewAsset): string {
  return asset.file_url || asset.fileUrl || ""
}

function resolveType(asset: PreviewAsset): "image" | "pdf" {
  return asset.file_type || asset.fileType || "image"
}

function resolveMime(asset: PreviewAsset): string {
  return asset.mime_type || asset.mimeType || "image/png"
}

function isMissing(asset: PreviewAsset | null | undefined): boolean {
  if (!asset) return true
  return Boolean(asset.file_missing || asset.fileMissing)
}

export default function ScenePreviewFrame({
  mode,
  fullAsset,
  leftAsset,
  rightAsset,
  noticeTitle,
  adminMode = true,
}: ScenePreviewFrameProps) {
  return (
    <div
      style={{
        width: "100%",
        aspectRatio: "16 / 9",
        background: "#020617",
        borderRadius: 8,
        overflow: "hidden",
        border: "1px solid rgba(255,255,255,0.12)",
        position: "relative",
      }}
    >
      {mode === "ranking" ? (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#e2e8f0",
            fontSize: 20,
          }}
        >
          랭킹 화면
        </div>
      ) : null}

      {mode === "notice" ? (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#e2e8f0",
            fontSize: 18,
            padding: 24,
            textAlign: "center",
          }}
        >
          공지사항 화면
          {noticeTitle ? (
            <div style={{ marginTop: 8, color: "#94a3b8" }}>{noticeTitle}</div>
          ) : null}
        </div>
      ) : null}

      {mode === "media_full" ? (
        isMissing(fullAsset) || !fullAsset ? (
          <MissingBox label="원본 파일이 없어 다시 업로드가 필요합니다." />
        ) : (
          <DisplayMediaRenderer
            fileUrl={resolveUrl(fullAsset)}
            fileType={resolveType(fullAsset)}
            mimeType={resolveMime(fullAsset)}
            title={fullAsset.title}
            variant="full"
            adminMode={adminMode}
          />
        )
      ) : null}

      {mode === "media_split" ? (
        <div style={{ width: "100%", height: "100%", display: "flex" }}>
          <div style={{ width: "50%", height: "100%", borderRight: "1px solid rgba(255,255,255,0.15)" }}>
            {isMissing(leftAsset) || !leftAsset ? (
              <MissingBox label="왼쪽 파일 누락" />
            ) : (
              <DisplayMediaRenderer
                fileUrl={resolveUrl(leftAsset)}
                fileType={resolveType(leftAsset)}
                mimeType={resolveMime(leftAsset)}
                title={leftAsset.title}
                variant="split"
                adminMode={adminMode}
              />
            )}
          </div>
          <div style={{ width: "50%", height: "100%" }}>
            {isMissing(rightAsset) || !rightAsset ? (
              <MissingBox label="오른쪽 파일 누락" />
            ) : (
              <DisplayMediaRenderer
                fileUrl={resolveUrl(rightAsset)}
                fileType={resolveType(rightAsset)}
                mimeType={resolveMime(rightAsset)}
                title={rightAsset.title}
                variant="split"
                adminMode={adminMode}
              />
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function MissingBox({ label }: { label: string }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#f87171",
        fontSize: 14,
        textAlign: "center",
        padding: 12,
      }}
    >
      {label}
    </div>
  )
}
