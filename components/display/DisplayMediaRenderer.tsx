"use client"

import { useEffect, useState } from "react"

type DisplayMediaRendererProps = {
  fileUrl: string
  fileType: "image" | "pdf"
  mimeType: string
  variant: "full" | "split"
  title?: string
  adminMode?: boolean
  onLoadStateChange?: (state: "loading" | "loaded" | "error") => void
}

export default function DisplayMediaRenderer({
  fileUrl,
  fileType,
  mimeType,
  variant,
  title,
  adminMode = false,
  onLoadStateChange,
}: DisplayMediaRendererProps) {
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    setLoadError(false)
    onLoadStateChange?.("loading")
  }, [fileUrl, fileType, mimeType, onLoadStateChange])

  function markError() {
    setLoadError(true)
    onLoadStateChange?.("error")
  }

  function markLoaded() {
    setLoadError(false)
    onLoadStateChange?.("loaded")
  }

  if (loadError) {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          color: "#94a3b8",
          fontSize: variant === "full" ? (adminMode ? 16 : 28) : adminMode ? 14 : 22,
          textAlign: "center",
          padding: adminMode ? 12 : 24,
          gap: 8,
        }}
      >
        <span>
          {adminMode
            ? "이미지를 불러오지 못했습니다. 파일 URL 또는 저장 상태를 확인하세요."
            : "파일을 표시할 수 없습니다"}
        </span>
        {adminMode && fileUrl ? (
          <a
            href={fileUrl}
            target="_blank"
            rel="noreferrer"
            style={{ color: "#38bdf8", fontSize: 12 }}
          >
            파일 URL 확인
          </a>
        ) : null}
      </div>
    )
  }

  if (fileType === "pdf" || mimeType === "application/pdf") {
    return (
      <div style={{ width: "100%", height: "100%", position: "relative" }}>
        <object
          data={`${fileUrl}#toolbar=0&navpanes=0&scrollbar=0`}
          type="application/pdf"
          style={{
            width: "100%",
            height: "100%",
            display: "block",
            border: "none",
            background: "#000",
          }}
          onLoad={markLoaded}
          onError={markError}
        >
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              color: "#94a3b8",
              gap: 8,
              padding: 16,
              textAlign: "center",
            }}
          >
            <div>PDF</div>
            <div style={{ fontSize: 14 }}>{title || "PDF 파일"}</div>
            {adminMode ? (
              <a
                href={fileUrl}
                target="_blank"
                rel="noreferrer"
                style={{ color: "#38bdf8", fontSize: 13 }}
              >
                새 창에서 보기
              </a>
            ) : (
              <span>PDF를 표시할 수 없습니다</span>
            )}
          </div>
        </object>
      </div>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={fileUrl}
      alt={title || "전광판 미디어"}
      loading="eager"
      style={{
        width: "100%",
        height: "100%",
        objectFit: "contain",
        display: "block",
      }}
      onLoad={markLoaded}
      onError={markError}
    />
  )
}
