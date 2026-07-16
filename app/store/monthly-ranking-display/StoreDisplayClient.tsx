"use client"

import { useCallback, useEffect, useState } from "react"
import { formatHandicap } from "@/lib/format-handicap"
import type { NoticeTheme } from "@/lib/admin/constants"
import type { DisplayStatePayload } from "@/lib/display/types"
import NoticeDisplay from "./NoticeDisplay"
import MediaFullDisplay from "@/components/display/MediaFullDisplay"
import MediaSplitDisplay from "@/components/display/MediaSplitDisplay"

type RankedPlayer = {
  rank: number
  nickname: string
  handicap: number
}

type LastMonthResponse = {
  success: boolean
  year?: number
  month?: number
  data: RankedPlayer[]
  message?: string
}

type CurrentMonthResponse = {
  success: boolean
  year?: number
  month?: number
  data: RankedPlayer[]
  message?: string
}

type DisplayStateResponse = DisplayStatePayload & {
  success: boolean
}

const TOP_CARD_COLORS = ["#FFD700", "#C0C0C0", "#CD7F32", "#3b82f6", "#22c55e"]
const FIXED_COLUMN_COUNT = 7

function useCurrentTime() {
  const [now, setNow] = useState<Date | null>(null)

  useEffect(() => {
    setNow(new Date())
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])

  return now
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

function buildColumns(players: RankedPlayer[]): RankedPlayer[][] {
  if (players.length === 0) return []

  const columns: RankedPlayer[][] = []
  const baseSize = Math.floor(players.length / FIXED_COLUMN_COUNT)
  const remainder = players.length % FIXED_COLUMN_COUNT
  let start = 0

  for (let i = 0; i < FIXED_COLUMN_COUNT; i++) {
    const size = baseSize + (i < remainder ? 1 : 0)
    columns.push(players.slice(start, start + size))
    start += size
  }

  return columns
}

type StoreDisplayClientProps = {
  /** 기본값: Unit1 호환 `/api/display-state` */
  stateApiPath?: string
}

export default function StoreDisplayClient({
  stateApiPath = "/api/display-state",
}: StoreDisplayClientProps) {
  const [displayState, setDisplayState] = useState<DisplayStateResponse>({
    success: true,
    mode: "ranking",
  })
  const [lastMonth, setLastMonth] = useState<LastMonthResponse | null>(null)
  const [currentMonth, setCurrentMonth] =
    useState<CurrentMonthResponse | null>(null)
  const now = useCurrentTime()

  const fetchDisplayState = useCallback(async () => {
    try {
      const res = await fetch(stateApiPath, { cache: "no-store" })
      const json = (await res.json()) as DisplayStateResponse
      setDisplayState(json)
    } catch (error) {
      console.error("[store-display] display-state 로딩 실패:", error)
    }
  }, [stateApiPath])

  const fetchRankingData = useCallback(async () => {
    try {
      const [lastRes, currentRes] = await Promise.all([
        fetch("/api/monthly-ranking/last-month", { cache: "no-store" }),
        fetch("/api/monthly-ranking/current-month", { cache: "no-store" }),
      ])

      const [lastJson, currentJson] = await Promise.all([
        lastRes.json() as Promise<LastMonthResponse>,
        currentRes.json() as Promise<CurrentMonthResponse>,
      ])

      setLastMonth(lastJson)
      setCurrentMonth(currentJson)
    } catch (error) {
      console.error("[store-display] 데이터 로딩 실패:", error)
    }
  }, [])

  useEffect(() => {
    fetchDisplayState()
    const id = window.setInterval(fetchDisplayState, 30000)
    return () => window.clearInterval(id)
  }, [fetchDisplayState])

  useEffect(() => {
    if (displayState.mode !== "ranking") return

    fetchRankingData()
    const id = window.setInterval(fetchRankingData, 30000)
    return () => window.clearInterval(id)
  }, [displayState.mode, fetchRankingData])

  if (displayState.mode === "notice" && "notice" in displayState) {
    return (
      <NoticeDisplay
        title={displayState.notice.title}
        body={displayState.notice.body}
        theme={displayState.notice.theme as NoticeTheme}
        now={now}
      />
    )
  }

  if (displayState.mode === "media_full" && "media" in displayState) {
    return <MediaFullDisplay media={displayState.media} />
  }

  if (
    displayState.mode === "media_split" &&
    "left" in displayState &&
    "right" in displayState
  ) {
    return (
      <MediaSplitDisplay left={displayState.left} right={displayState.right} />
    )
  }

  const lastMonthTop5 = lastMonth?.data ?? []
  const currentPlayers = currentMonth?.data ?? []
  const currentTop5 = currentPlayers.slice(0, 5)
  const currentRest = currentPlayers.slice(5, 100)
  const columns = buildColumns(currentRest)

  const lastMonthLabel = lastMonth?.month
    ? `🏆 ${lastMonth.month}월 최종 TOP5`
    : "🏆 지난달 최종 TOP5"

  const currentTop5Label = currentMonth?.month
    ? `🔥 ${currentMonth.month}월 LIVE TOP5`
    : "🔥 이번달 LIVE TOP5"

  const currentMonthLabel = currentMonth?.month
    ? `${currentMonth.month}월 전체 순위`
    : "이번달 전체 순위"

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
        padding: "20px 24px",
        boxSizing: "border-box",
        fontFamily: "Pretendard, sans-serif",
      }}
    >
      <div style={{ position: "relative", marginBottom: "8px", flexShrink: 0 }}>
        <h1
          style={{
            textAlign: "center",
            fontSize: "48px",
            margin: 0,
            letterSpacing: "3px",
            lineHeight: 1.1,
          }}
        >
          우리 매장 순위
        </h1>
        <div
          style={{
            position: "absolute",
            top: "50%",
            right: 0,
            transform: "translateY(-50%)",
            fontSize: "20px",
            color: "#94a3b8",
            fontVariantNumeric: "tabular-nums",
            letterSpacing: "1px",
          }}
        >
          {now ? formatDateTime(now) : ""}
        </div>
      </div>

      <div style={{ flexShrink: 0, marginBottom: "10px" }}>
        <div
          style={{
            fontSize: "36px",
            fontWeight: 800,
            color: "#FFD54A",
            marginBottom: "8px",
            letterSpacing: "1px",
            textAlign: "left",
          }}
        >
          {lastMonthLabel}
        </div>

        {lastMonthTop5.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              color: "#64748b",
              fontSize: "18px",
              padding: "16px 0",
            }}
          >
            지난달 데이터가 없습니다.
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(5, 1fr)",
              gap: "8px",
            }}
          >
            {lastMonthTop5.map((item, index) => (
              <div
                key={`last-${item.rank}-${item.nickname}`}
                style={{
                  background: TOP_CARD_COLORS[index],
                  borderRadius: "10px",
                  padding: "10px 12px",
                  height: "72px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  textAlign: "center",
                  color: index < 3 ? "black" : "white",
                  fontWeight: 700,
                  boxShadow: "0 3px 10px rgba(0,0,0,0.16)",
                }}
              >
                <div style={{ fontSize: "18px", lineHeight: 1.05 }}>{item.rank}위</div>
                <div style={{ fontSize: "16px", fontWeight: 400, lineHeight: 1.1 }}>
                  {item.nickname}
                </div>
                <div style={{ fontSize: "14px" }}>
                  핸디캡 {formatHandicap(item.handicap)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div
        style={{
          fontSize: "30px",
          fontWeight: 700,
          color: "#00E5FF",
          marginTop: "8px",
          marginBottom: "8px",
          letterSpacing: "1px",
          flexShrink: 0,
        }}
      >
        {currentTop5Label}
      </div>

      {currentTop5.length === 0 ? (
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#64748b",
            fontSize: "22px",
          }}
        >
          이번달 이용 고객 없음
        </div>
      ) : (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(5, 1fr)",
              gap: "10px",
              marginBottom: "10px",
              flexShrink: 0,
            }}
          >
            {currentTop5.map((item, index) => (
              <div
                key={`current-top-${item.rank}-${item.nickname}`}
                style={{
                  background: TOP_CARD_COLORS[index],
                  borderRadius: "12px",
                  padding: "12px 16px",
                  height: "95px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  textAlign: "center",
                  color: index < 3 ? "black" : "white",
                  fontWeight: 700,
                  boxShadow: "0 5px 14px rgba(0,0,0,0.2)",
                }}
              >
                <div style={{ fontSize: "24px", lineHeight: 1.05 }}>{item.rank}위</div>
                <div style={{ fontSize: "23px", fontWeight: 400, lineHeight: 1.1 }}>
                  {item.nickname}
                </div>
                <div style={{ fontSize: "18px" }}>
                  핸디캡 {formatHandicap(item.handicap)}
                </div>
              </div>
            ))}
          </div>

          <div
            style={{
              fontSize: "20px",
              color: "#38bdf8",
              fontWeight: 700,
              marginBottom: "8px",
              letterSpacing: "1px",
              flexShrink: 0,
            }}
          >
            {currentMonthLabel}
          </div>

          {currentRest.length === 0 ? (
            <div
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#64748b",
                fontSize: "20px",
              }}
            >
              6위 이하 데이터 없음
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(${FIXED_COLUMN_COUNT}, minmax(0, 1fr))`,
                gap: "8px",
                flex: 1,
                minHeight: 0,
              }}
            >
              {columns.map((column, colIdx) => (
                <div
                  key={`col-${colIdx}`}
                  style={{
                    display: "grid",
                    gap: "6px",
                    minHeight: 0,
                    gridTemplateRows: `repeat(${Math.max(column.length, 1)}, minmax(0, 1fr))`,
                  }}
                >
                  {column.map((item) => (
                    <div
                      key={`${item.rank}-${item.nickname}`}
                      style={{
                        background: "#1e293b",
                        padding: "7px 10px",
                        borderRadius: "10px",
                        display: "grid",
                        gridTemplateColumns: "54px minmax(0, 1fr) 58px",
                        alignItems: "center",
                        border: "1px solid rgba(255,255,255,0.16)",
                        columnGap: "8px",
                        fontSize: "16px",
                        boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.03)",
                      }}
                    >
                      <span
                        style={{
                          opacity: 0.82,
                          minWidth: "54px",
                          fontWeight: 600,
                          textAlign: "left",
                        }}
                      >
                        {item.rank}위
                      </span>
                      <span
                        style={{
                          textAlign: "left",
                          fontSize: "18px",
                          fontWeight: 400,
                          lineHeight: 1.1,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {item.nickname}
                      </span>
                      <span
                        style={{
                          color: "#22c55e",
                          fontWeight: 700,
                          minWidth: "58px",
                          textAlign: "right",
                          fontSize: "16px",
                        }}
                      >
                        {formatHandicap(item.handicap)}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <div
        style={{
          textAlign: "center",
          fontSize: "22px",
          color: "#facc15",
          marginTop: "10px",
          flexShrink: 0,
        }}
      >
        🔥 지금 플레이하면 순위가 올라갑니다
      </div>
    </div>
  )
}
