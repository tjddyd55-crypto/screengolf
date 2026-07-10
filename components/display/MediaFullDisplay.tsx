"use client"

import DisplayMediaRenderer from "./DisplayMediaRenderer"
import type { DisplayMediaPayload } from "@/lib/display/types"

type MediaFullDisplayProps = {
  media: DisplayMediaPayload
}

export default function MediaFullDisplay({ media }: MediaFullDisplayProps) {
  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        background: "#000000",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
        }}
      >
        <DisplayMediaRenderer
          fileUrl={media.fileUrl}
          fileType={media.fileType}
          mimeType={media.mimeType}
          variant="full"
        />
      </div>
    </div>
  )
}
