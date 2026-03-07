import { RankedPlayer } from "./ranking-generator"

type MonthlyCache = {
  lastMonth: {
    year: number
    month: number
    top5: RankedPlayer[]
  } | null
  currentMonth: {
    year: number
    month: number
    ranking: RankedPlayer[]
  } | null
  lastRefreshedAt: Date | null
}

const cache: MonthlyCache = {
  lastMonth: null,
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
