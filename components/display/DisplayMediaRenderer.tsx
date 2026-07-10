"use client"

import { useState } from "react"

type DisplayMediaRendererProps = {
  fileUrl: string
  fileType: "image" | "pdf"
  mimeType: string
  variant: "full" | "split"
}

export default function DisplayMediaRenderer({
  fileUrl,
  fileType,
  mimeType,
  variant,
}: DisplayMediaRendererProps) {
  const [loadError, setLoadError] = useState(false)

  if (loadError) {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#94a3b8",
          fontSize: variant === "full" ? 28 : 22,
          textAlign: "center",
          padding: 24,
        }}
      >
        파일을 표시할 수 없습니다
      </div>
    )
  }

  if (fileType === "pdf") {
    return (
      <object
        data={`${fileUrl}#toolbar=0&navpanes=0&scrollbar=0`}
        type={mimeType}
        style={{
          width: "100%",
          height: "100%",
          display: "block",
          border: "none",
          background: "#000",
        }}
        onError={() => setLoadError(true)}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#94a3b8",
          }}
        >
          PDF를 표시할 수 없습니다
        </div>
      </object>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={fileUrl}
      alt="전광판 미디어"
      style={{
        width: "100%",
        height: "100%",
        objectFit: "contain",
        display: "block",
      }}
      onError={() => setLoadError(true)}
    />
  )
}
