"use client"

import { useCallback, useEffect, useState } from "react"

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

function formatHandicap(value: number): string {
  return Number(value).toFixed(1)
}

export default function MonthlyRankingDisplay() {
  const [lastMonth, setLastMonth] = useState<LastMonthResponse | null>(null)
  const [currentMonth, setCurrentMonth] =
    useState<CurrentMonthResponse | null>(null)
  const now = useCurrentTime()

  const fetchData = useCallback(async () => {
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
      console.error("[monthly-ranking-display] 데이터 로딩 실패:", error)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const id = window.setInterval(fetchData, 30000)
    return () => window.clearInterval(id)
  }, [fetchData])

  const lastMonthTop5 = lastMonth?.data ?? []
  const currentPlayers = currentMonth?.data ?? []
  const currentTop5 = currentPlayers.slice(0, 5)
  const currentRest = currentPlayers.slice(5, 100)
  const columns = buildColumns(currentRest)

  const lastMonthLabel = lastMonth?.month
    ? `🏆 ${lastMonth.month}월 최종 랭킹 TOP5`
    : "🏆 지난달 최종 랭킹 TOP5"

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
      {/* 헤더 */}
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

      {/* 지난달 TOP5 */}
      <div style={{ flexShrink: 0, marginBottom: "10px" }}>
        <div
          style={{
            fontSize: "28px",
            fontWeight: 800,
            color: "#FFD54A",
            marginBottom: "10px",
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
              padding: "20px 0",
            }}
          >
            지난달 데이터가 없습니다.
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(5, 1fr)",
              gap: "10px",
            }}
          >
            {lastMonthTop5.map((item, index) => (
              <div
                key={`last-${item.rank}-${item.nickname}`}
                style={{
                  background: TOP_CARD_COLORS[index],
                  borderRadius: "12px",
                  padding: "12px 16px",
                  height: "90px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  textAlign: "center",
                  color: index < 3 ? "black" : "white",
                  fontWeight: 700,
                  boxShadow: "0 4px 12px rgba(0,0,0,0.18)",
                }}
              >
                <div style={{ fontSize: "22px", lineHeight: 1.05 }}>{item.rank}위</div>
                <div style={{ fontSize: "20px", fontWeight: 400, lineHeight: 1.1 }}>
                  {item.nickname}
                </div>
                <div style={{ fontSize: "17px" }}>
                  핸디캡 {formatHandicap(item.handicap)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 이번달 LIVE TOP5 */}
      <div
        style={{
          fontSize: "26px",
          fontWeight: 700,
          color: "#00E5FF",
          marginTop: "10px",
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
                gap: "10px",
                flex: 1,
                minHeight: 0,
              }}
            >
              {columns.map((column, colIdx) => (
                <div
                  key={`col-${colIdx}`}
                  style={{
                    display: "grid",
                    gap: "8px",
                    minHeight: 0,
                    gridTemplateRows: `repeat(${Math.max(column.length, 1)}, minmax(0, 1fr))`,
                  }}
                >
                  {column.map((item) => (
                    <div
                      key={`${item.rank}-${item.nickname}`}
                      style={{
                        background: "#1e293b",
                        padding: "8px 10px",
                        borderRadius: "10px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        border: "1px solid rgba(255,255,255,0.16)",
                        gap: "8px",
                        fontSize: "16px",
                        boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.03)",
                      }}
                    >
                      <span
                        style={{
                          opacity: 0.82,
                          minWidth: "48px",
                          fontWeight: 600,
                        }}
                      >
                        {item.rank}위
                      </span>
                      <span
                        style={{
                          flex: 1,
                          textAlign: "center",
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
                          minWidth: "64px",
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

      {/* 하단 메시지 */}
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
