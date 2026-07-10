"use client"

import DisplayMediaRenderer from "./DisplayMediaRenderer"
import type { DisplayMediaPayload } from "@/lib/display/types"

type MediaSplitDisplayProps = {
  left: DisplayMediaPayload
  right: DisplayMediaPayload
}

export default function MediaSplitDisplay({ left, right }: MediaSplitDisplayProps) {
  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        background: "#0f172a",
        display: "grid",
        gridTemplateColumns: "1fr 1px 1fr",
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#000000",
          overflow: "hidden",
        }}
      >
        <DisplayMediaRenderer
          fileUrl={left.fileUrl}
          fileType={left.fileType}
          mimeType={left.mimeType}
          variant="split"
        />
      </div>

      <div style={{ background: "rgba(255,255,255,0.18)" }} />

      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#000000",
          overflow: "hidden",
        }}
      >
        <DisplayMediaRenderer
          fileUrl={right.fileUrl}
          fileType={right.fileType}
          mimeType={right.mimeType}
          variant="split"
        />
      </div>
    </div>
  )
}
