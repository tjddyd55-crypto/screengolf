import { RankedPlayer } from "./ranking-generator"

type Snapshot = {
  year: number
  month: number
  top5: RankedPlayer[]
  fixedAt: Date
}

type MonthlyCache = {
  lastMonth: {
    year: number
    month: number
    top5: RankedPlayer[]
  } | null
  lastMonthSnapshots: Record<string, Snapshot>
  currentMonth: {
    year: number
    month: number
    ranking: RankedPlayer[]
  } | null
  lastRefreshedAt: Date | null
}

const cache: MonthlyCache = {
  lastMonth: null,
  lastMonthSnapshots: {},
  currentMonth: null,
  lastRefreshedAt: null,
}

export function setLastMonthCache(
  year: number,
  month: number,
  top5: RankedPlayer[],
): void {
  cache.lastMonth = { year, month, top5 }
}

function getMonthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`
}

export function getLastMonthSnapshot(
  year: number,
  month: number,
): Snapshot | null {
  const key = getMonthKey(year, month)
  return cache.lastMonthSnapshots[key] ?? null
}

export function setLastMonthSnapshot(
  year: number,
  month: number,
  top5: RankedPlayer[],
): Snapshot {
  const key = getMonthKey(year, month)
  const snapshot: Snapshot = {
    year,
    month,
    top5,
    fixedAt: new Date(),
  }

  cache.lastMonthSnapshots[key] = snapshot
  cache.lastMonth = { year, month, top5 }
  return snapshot
}

export function setCurrentMonthCache(
  year: number,
  month: number,
  ranking: RankedPlayer[],
): void {
  cache.currentMonth = { year, month, ranking }
  cache.lastRefreshedAt = new Date()
}

export function getLastMonthCache(): MonthlyCache["lastMonth"] {
  return cache.lastMonth
}

export function getCurrentMonthCache(): MonthlyCache["currentMonth"] {
  return cache.currentMonth
}

export function getLastRefreshedAt(): Date | null {
  return cache.lastRefreshedAt
}

export function isCacheEmpty(): boolean {
  return cache.lastMonth === null && cache.currentMonth === null
}
