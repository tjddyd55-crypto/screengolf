"use client"

import type { NoticeTheme } from "@/lib/admin/constants"

type NoticeDisplayProps = {
  title: string
  body: string
  theme: NoticeTheme
  now: Date | null
}

const THEME_STYLES: Record<
  NoticeTheme,
  { accent: string; titleColor: string; bodyColor: string }
> = {
  default: {
    accent: "#38bdf8",
    titleColor: "#ffffff",
    bodyColor: "#e2e8f0",
  },
  event: {
    accent: "#a855f7",
    titleColor: "#f3e8ff",
    bodyColor: "#ede9fe",
  },
  warning: {
    accent: "#f97316",
    titleColor: "#fff7ed",
    bodyColor: "#fed7aa",
  },
  promotion: {
    accent: "#facc15",
    titleColor: "#fef9c3",
    bodyColor: "#fef08a",
  },
}

function formatDateTime(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0")
  const year = date.getFullYear()
  const month = pad(date.getMonth() + 1)
  const day = pad(date.getDate())
  const hours = pad(date.getHours())
  const minutes = pad(date.getMinutes())
  const seconds = pad(date.getSeconds())
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"]
  const weekday = weekdays[date.getDay()]
  return `${year}.${month}.${day} (${weekday}) ${hours}:${minutes}:${seconds}`
}

export default function NoticeDisplay({
  title,
  body,
  theme,
  now,
}: NoticeDisplayProps) {
  const themeStyle = THEME_STYLES[theme]

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        background: "linear-gradient(135deg, #0f172a, #1e293b)",
        color: "white",
        padding: "48px 64px",
        boxSizing: "border-box",
        fontFamily: "Pretendard, sans-serif",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 32,
          right: 48,
          fontSize: "24px",
          color: "#94a3b8",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {now ? formatDateTime(now) : ""}
      </div>

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          textAlign: "center",
          padding: "0 80px",
        }}
      >
        <div
          style={{
            width: 120,
            height: 6,
            borderRadius: 999,
            background: themeStyle.accent,
            marginBottom: 40,
          }}
        />
        <h1
          style={{
            fontSize: "88px",
            fontWeight: 800,
            lineHeight: 1.15,
            margin: "0 0 48px",
            color: themeStyle.titleColor,
            letterSpacing: "2px",
            wordBreak: "keep-all",
          }}
        >
          {title}
        </h1>
        <p
          style={{
            fontSize: "52px",
            lineHeight: 1.5,
            margin: 0,
            color: themeStyle.bodyColor,
            whiteSpace: "pre-wrap",
            wordBreak: "keep-all",
            maxWidth: "1400px",
          }}
        >
          {body}
        </p>
      </div>

      <div
        style={{
          textAlign: "center",
          fontSize: "32px",
          color: "#94a3b8",
          flexShrink: 0,
        }}
      >
        오늘도 즐거운 라운딩 되세요
      </div>
    </div>
  )
}
