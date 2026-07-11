import { describe, expect, it } from "vitest"
import {
  getCurrentMonthDateRange,
  getKoreaYearMonth,
  getLastMonthDateRange,
  getMonthDateRange,
  getMonthKey,
  getPreviousMonth,
  shouldRunMonthlyFinalJob,
} from "../date-range"
import { generateRanking, takeTop } from "../ranking-generator"
import type { PlayerRecord } from "../admin-scraper"
import {
  getDataDir,
  getStoreDbPath,
  isPersistentVolumeConfigured,
} from "@/lib/storage/data-paths"
import path from "node:path"

describe("date-range", () => {
  it("1월 기준 지난달이 전년도 12월로 계산된다", () => {
    const previous = getPreviousMonth(2026, 1)
    expect(previous).toEqual({ year: 2025, month: 12 })

    const range = getMonthDateRange(previous.year, previous.month)
    expect(range).toEqual({
      monthKey: "2025-12",
      startDate: "2025-12-01",
      endDate: "2025-12-31",
    })
  })

  it("3월 기준 윤년/평년 2월 말일을 올바르게 계산한다", () => {
    expect(getMonthDateRange(2024, 2)).toEqual({
      monthKey: "2024-02",
      startDate: "2024-02-01",
      endDate: "2024-02-29",
    })

    expect(getMonthDateRange(2025, 2)).toEqual({
      monthKey: "2025-02",
      startDate: "2025-02-01",
      endDate: "2025-02-28",
    })
  })

  it("7월 기준 지난달이 6월 1일~30일이다", () => {
    const july = new Date("2026-07-11T12:00:00+09:00")
    const lastMonth = getLastMonthDateRange(july)

    expect(lastMonth.year).toBe(2026)
    expect(lastMonth.month).toBe(6)
    expect(lastMonth.startDate).toBe("2026-06-01")
    expect(lastMonth.endDate).toBe("2026-06-30")
  })

  it("한국 시간대에서 날짜가 하루 밀리지 않는다", () => {
    const kstMidnight = new Date("2026-07-01T00:30:00+09:00")
    const { year, month } = getKoreaYearMonth(kstMidnight)

    expect(year).toBe(2026)
    expect(month).toBe(7)

    const current = getCurrentMonthDateRange(kstMidnight)
    expect(current.startDate).toBe("2026-07-01")
  })

  it("지난달/이번달 monthKey가 분리된다", () => {
    const date = new Date("2026-07-11T12:00:00+09:00")
    const current = getCurrentMonthDateRange(date)
    const last = getLastMonthDateRange(date)

    expect(current.monthKey).toBe("2026-07")
    expect(last.monthKey).toBe("2026-06")
    expect(current.monthKey).not.toBe(last.monthKey)
  })

  it("매월 1일 00:10~01:10 KST에만 FINAL 작업 윈도우가 열린다", () => {
    expect(
      shouldRunMonthlyFinalJob(new Date("2026-08-01T00:05:00+09:00")),
    ).toBe(false)
    expect(
      shouldRunMonthlyFinalJob(new Date("2026-08-01T00:15:00+09:00")),
    ).toBe(true)
    expect(
      shouldRunMonthlyFinalJob(new Date("2026-08-02T00:15:00+09:00")),
    ).toBe(false)
  })
})

describe("ranking-generator", () => {
  it("보정치 0이 누락되지 않는다", () => {
    const players: PlayerRecord[] = [
      { nickname: "zero", handicap: 0, roundDate: "2026-07-01" },
      { nickname: "other", handicap: 5, roundDate: "2026-07-02" },
    ]

    const ranking = generateRanking(players)
    expect(ranking.some((item) => item.nickname === "zero")).toBe(true)
    expect(ranking[0]?.handicap).toBe(0)
  })

  it("음수 보정치를 오름차순으로 정렬한다", () => {
    const players: PlayerRecord[] = [
      { nickname: "a", handicap: 2, roundDate: "2026-07-01" },
      { nickname: "b", handicap: -1, roundDate: "2026-07-02" },
      { nickname: "c", handicap: 0, roundDate: "2026-07-03" },
    ]

    const ranking = generateRanking(players)
    expect(ranking.map((item) => item.handicap)).toEqual([-1, 0, 2])
  })

  it("동점 보정치는 입력 순서를 유지한다", () => {
    const players: PlayerRecord[] = [
      { nickname: "first", handicap: 1, roundDate: "2026-07-01" },
      { nickname: "second", handicap: 1, roundDate: "2026-07-02" },
    ]

    const ranking = generateRanking(players)
    expect(ranking.map((item) => item.nickname)).toEqual(["first", "second"])
  })

  it("이번달 랭킹 생성과 TOP5 추출이 유지된다", () => {
    const players: PlayerRecord[] = Array.from({ length: 8 }, (_, index) => ({
      nickname: `player-${index + 1}`,
      handicap: index,
      roundDate: "2026-07-01",
    }))

    const ranking = generateRanking(players)
    const top5 = takeTop(ranking, 5)

    expect(ranking).toHaveLength(8)
    expect(top5).toHaveLength(5)
    expect(top5[0]?.rank).toBe(1)
    expect(top5[4]?.rank).toBe(5)
  })
})

describe("cache protection", () => {
  it("지난달 수집 실패(빈 TOP5) 시 저장하지 않는다", async () => {
    const { canPersistLastMonthSnapshot } = await import("../ranking-cache")
    expect(canPersistLastMonthSnapshot([])).toBe(false)
  })

  it("지난달 파싱 결과 0건 비정상 시 저장하지 않는다", async () => {
    const { canPersistLastMonthSnapshot } = await import("../ranking-cache")
    expect(canPersistLastMonthSnapshot([])).toBe(false)
    expect(
      canPersistLastMonthSnapshot([
        { rank: 1, nickname: "player", handicap: 0 },
      ]),
    ).toBe(true)
  })
})

describe("month key helpers", () => {
  it("last-month API가 사용하는 monthKey 형식을 반환한다", () => {
    expect(getMonthKey(2026, 6)).toBe("2026-06")
    expect(getMonthKey(2026, 7)).toBe("2026-07")
  })
})

describe("data-paths", () => {
  it("DATA_DIR 환경변수를 우선 사용한다", () => {
    const original = process.env.DATA_DIR
    process.env.DATA_DIR = "D:/tmp/gaja-data-test"

    expect(getDataDir()).toBe(path.resolve("D:/tmp/gaja-data-test"))
    expect(getStoreDbPath()).toBe(
      path.join(path.resolve("D:/tmp/gaja-data-test"), "store.db"),
    )
    expect(isPersistentVolumeConfigured()).toBe(true)

    if (original === undefined) {
      delete process.env.DATA_DIR
    } else {
      process.env.DATA_DIR = original
    }
  })
})
