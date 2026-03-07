"use client"

import { useCallback, useEffect, useState } from "react"

type RankingItem = {
  rank: number
  name: string
  handicap: string
  userNo?: string
}

const TOP_CARD_COLORS = ["#FFD700", "#C0C0C0", "#CD7F32", "#3b82f6", "#22c55e"]
const FIXED_COLUMN_COUNT = 7

export default function RankingDisplay() {
  const [ranking, setRanking] = useState<RankingItem[]>([])

  const fetchRanking = useCallback(async () => {
    try {
      const res = await fetch("/api/store-ranking", { cache: "no-store" })
      const json = (await res.json()) as { data?: RankingItem[] }
      setRanking(json.data ?? [])
    } catch (error) {
      console.error("[ranking-display] failed to fetch ranking", error)
      setRanking([])
    }
  }, [])

  useEffect(() => {
    fetchRanking()

    const intervalId = window.setInterval(fetchRanking, 30000)
    return () => window.clearInterval(intervalId)
  }, [fetchRanking])

  const top5 = ranking.slice(0, 5)
  const others = ranking.slice(5, 100)
  const columns: RankingItem[][] = []

  const baseColumnSize = Math.floor(others.length / FIXED_COLUMN_COUNT)
  const remainder = others.length % FIXED_COLUMN_COUNT
  let startIndex = 0

  for (let i = 0; i < FIXED_COLUMN_COUNT; i += 1) {
    const columnSize = baseColumnSize + (i < remainder ? 1 : 0)
    const endIndex = startIndex + columnSize
    columns.push(others.slice(startIndex, endIndex))
    startIndex = endIndex
  }

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        background: "linear-gradient(135deg, #0f172a, #1e293b)",
        color: "white",
        padding: "20px 24px",
        boxSizing: "border-box",
        fontFamily: "Pretendard, sans-serif",
      }}
    >
      <h1
        style={{
          textAlign: "center",
          fontSize: "60px",
          margin: "0 0 18px",
          letterSpacing: "3px",
          lineHeight: 1.1,
        }}
      >
        우리 매장 순위
      </h1>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
          gap: "14px",
          marginBottom: "14px",
          flexShrink: 0,
        }}
      >
        {top5.map((item, index) => (
          <div
            key={`${item.rank}-${item.userNo ?? item.name}`}
            style={{
              background: TOP_CARD_COLORS[index],
              borderRadius: "15px",
              padding: "18px 12px",
              textAlign: "center",
              color: index < 3 ? "black" : "white",
              fontWeight: 700,
              boxShadow: "0 6px 16px rgba(0,0,0,0.22)",
            }}
          >
            <div style={{ fontSize: "40px" }}>{item.rank}위</div>
            <div style={{ fontSize: "31px", lineHeight: 1.15, fontWeight: 400 }}>{item.name}</div>
            <div style={{ fontSize: "22px" }}>핸디캡 {item.handicap}</div>
          </div>
        ))}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${FIXED_COLUMN_COUNT}, minmax(0, 1fr))`,
          gap: "10px",
          flex: 1,
          minHeight: 0,
        }}
      >
        {columns.map((column, columnIndex) => (
          <div
            key={`column-${columnIndex}`}
            style={{
              display: "grid",
              gap: "8px",
              minHeight: 0,
              gridTemplateRows: `repeat(${Math.max(column.length, 1)}, minmax(0, 1fr))`,
            }}
          >
            {column.map((item) => (
              <div
                key={`${item.rank}-${item.userNo ?? item.name}`}
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
                <span style={{ opacity: 0.82, minWidth: "48px", fontWeight: 600 }}>{item.rank}위</span>
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
                  {item.name}
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
                  {item.handicap}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
