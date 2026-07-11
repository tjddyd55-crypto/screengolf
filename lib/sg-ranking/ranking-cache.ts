import { RankedPlayer } from "./ranking-generator"
import {
  getKoreaYearMonth,
  getMonthDateRange,
  getMonthKey,
  getPreviousMonth,
} from "./date-range"
import {
  getRankingSnapshotFromDb,
  loadAllRankingSnapshotsFromDb,
  saveRankingSnapshotToDb,
  type PersistedRankingSnapshot,
  type SnapshotStatus,
} from "@/lib/db/ranking-snapshots"
import { getRankingSnapshotJsonPath } from "@/lib/storage/data-paths"
import fs from "node:fs"
import path from "node:path"

export type SnapshotRecord = {
  year: number
  month: number
  top5: RankedPlayer[]
  ranking: RankedPlayer[]
  fixedAt: Date
  startDate: string
  endDate: string
  sourceCount: number
  validCount: number
  status: SnapshotStatus
}

type SnapshotJsonRecord = {
  year: number
  month: number
  top5: RankedPlayer[]
  fixedAt: string
  status?: SnapshotStatus
  sourceCount?: number
  validCount?: number
}

type MonthlyCache = {
  lastMonth: {
    year: number
    month: number
    top5: RankedPlayer[]
  } | null
  lastMonthSnapshots: Record<string, SnapshotRecord>
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

function toSnapshotRecord(record: PersistedRankingSnapshot): SnapshotRecord {
  return {
    year: record.year,
    month: record.month,
    top5: record.top5,
    ranking: record.ranking,
    fixedAt: new Date(record.generatedAt),
    startDate: record.startDate,
    endDate: record.endDate,
    sourceCount: record.sourceCount,
    validCount: record.validCount,
    status: record.status,
  }
}

function toPersistedSnapshot(
  record: SnapshotRecord,
  monthKey: string,
): PersistedRankingSnapshot {
  return {
    monthKey,
    year: record.year,
    month: record.month,
    startDate: record.startDate,
    endDate: record.endDate,
    top5: record.top5,
    ranking: record.ranking,
    sourceCount: record.sourceCount,
    validCount: record.validCount,
    generatedAt: record.fixedAt.toISOString(),
    finalizedAt:
      record.status === "FINAL" ? record.fixedAt.toISOString() : null,
    status: record.status,
  }
}

function loadSnapshotsFromJson(): Record<string, SnapshotRecord> {
  const jsonPath = getRankingSnapshotJsonPath()

  try {
    if (!fs.existsSync(jsonPath)) {
      return {}
    }

    const raw = fs.readFileSync(jsonPath, "utf8")
    const parsed = JSON.parse(raw) as Record<string, SnapshotJsonRecord>
    const snapshots: Record<string, SnapshotRecord> = {}

    for (const [key, value] of Object.entries(parsed)) {
      if (!value.top5?.length) {
        continue
      }

      const range = getMonthDateRange(value.year, value.month)
      snapshots[key] = {
        year: value.year,
        month: value.month,
        top5: value.top5,
        ranking: value.top5,
        fixedAt: new Date(value.fixedAt),
        startDate: range.startDate,
        endDate: range.endDate,
        sourceCount: value.sourceCount ?? value.top5.length,
        validCount: value.validCount ?? value.top5.length,
        status: value.status ?? "RECOVERED",
      }
    }

    return snapshots
  } catch (error) {
    console.warn(
      "[ranking-cache] JSON 보조 캐시 로딩 실패, DB를 source of truth로 진행합니다.",
      error,
    )
    return {}
  }
}

function saveSnapshotsToJson(snapshots: Record<string, SnapshotRecord>): void {
  const jsonPath = getRankingSnapshotJsonPath()

  try {
    const dir = path.dirname(jsonPath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    const serializable: Record<string, SnapshotJsonRecord> = {}
    for (const [key, snapshot] of Object.entries(snapshots)) {
      serializable[key] = {
        year: snapshot.year,
        month: snapshot.month,
        top5: snapshot.top5,
        fixedAt: snapshot.fixedAt.toISOString(),
        status: snapshot.status,
        sourceCount: snapshot.sourceCount,
        validCount: snapshot.validCount,
      }
    }

    fs.writeFileSync(jsonPath, JSON.stringify(serializable, null, 2), "utf8")
  } catch (error) {
    console.warn(
      "[ranking-cache] JSON 보조 캐시 저장 실패, DB/메모리만 유지합니다.",
      error,
    )
  }
}

function loadSnapshotsFromDb(): Record<string, SnapshotRecord> {
  try {
    const records = loadAllRankingSnapshotsFromDb()
    const snapshots: Record<string, SnapshotRecord> = {}

    for (const record of records) {
      if (!record.top5.length) {
        continue
      }
      snapshots[record.monthKey] = toSnapshotRecord(record)
    }

    return snapshots
  } catch (error) {
    console.warn(
      "[ranking-cache] 스냅샷 DB 로딩 실패, JSON 보조 캐시로 진행합니다.",
      error,
    )
    return {}
  }
}

function migrateJsonSnapshotsToDb(
  dbSnapshots: Record<string, SnapshotRecord>,
  jsonSnapshots: Record<string, SnapshotRecord>,
): void {
  for (const [monthKey, snapshot] of Object.entries(jsonSnapshots)) {
    if (dbSnapshots[monthKey]) {
      continue
    }

    const result = saveRankingSnapshotToDb(toPersistedSnapshot(snapshot, monthKey))
    if (result.saved) {
      dbSnapshots[monthKey] = snapshot
      console.log(
        `[ranking-cache] JSON → DB 1회 복구 (${monthKey}, status=${snapshot.status})`,
      )
    }
  }
}

function hydrateLastMonthFromSnapshots(): void {
  const { year, month } = getKoreaYearMonth()
  const { year: lastYear, month: lastMonth } = getPreviousMonth(year, month)
  const snapshot = getLastMonthSnapshotRecord(lastYear, lastMonth)

  if (snapshot?.top5.length) {
    cache.lastMonth = {
      year: lastYear,
      month: lastMonth,
      top5: snapshot.top5,
    }
  }
}

export function initializeRankingStorage(): void {
  const dbSnapshots = loadSnapshotsFromDb()
  const jsonSnapshots = loadSnapshotsFromJson()

  migrateJsonSnapshotsToDb(dbSnapshots, jsonSnapshots)

  cache.lastMonthSnapshots = dbSnapshots
  hydrateLastMonthFromSnapshots()
}

initializeRankingStorage()

export function canPersistLastMonthSnapshot(top5: RankedPlayer[]): boolean {
  return top5.length > 0
}

export function setLastMonthCache(
  year: number,
  month: number,
  top5: RankedPlayer[],
): void {
  if (!canPersistLastMonthSnapshot(top5)) {
    console.warn(
      `[ranking-cache] lastMonth 캐시 갱신 거부 (${year}-${month}): 빈 TOP5`,
    )
    return
  }

  cache.lastMonth = { year, month, top5 }
}

export function getLastMonthSnapshotRecord(
  year: number,
  month: number,
): SnapshotRecord | null {
  const key = getMonthKey(year, month)
  return cache.lastMonthSnapshots[key] ?? null
}

export function getLastMonthSnapshot(
  year: number,
  month: number,
): SnapshotRecord | null {
  return getLastMonthSnapshotRecord(year, month)
}

export function hasPersistedLastMonthSnapshot(
  year: number,
  month: number,
): boolean {
  const key = getMonthKey(year, month)
  const inMemory = cache.lastMonthSnapshots[key]
  if (inMemory?.top5.length) {
    return true
  }

  const fromDb = getRankingSnapshotFromDb(key)
  return Boolean(fromDb?.top5.length)
}

export type SaveLastMonthSnapshotInput = {
  year: number
  month: number
  top5: RankedPlayer[]
  ranking?: RankedPlayer[]
  status?: SnapshotStatus
  sourceCount?: number
  validCount?: number
}

export function setLastMonthSnapshot(
  input: SaveLastMonthSnapshotInput,
): SnapshotRecord | null {
  const {
    year,
    month,
    top5,
    ranking = top5,
    status = "RECOVERED",
    sourceCount = top5.length,
    validCount = ranking.length,
  } = input

  if (!canPersistLastMonthSnapshot(top5)) {
    console.warn(
      `[ranking-cache] 스냅샷 저장 거부 (${year}-${month}): 빈 TOP5`,
    )
    return null
  }

  const monthKey = getMonthKey(year, month)
  const existing = getLastMonthSnapshotRecord(year, month)

  if (existing?.status === "FINAL" && existing.top5.length > 0) {
    console.log(
      `[ranking-cache] FINAL 스냅샷 유지 (${monthKey}), cachePreserved reason=final-immutable`,
    )
    return existing
  }

  const range = getMonthDateRange(year, month)
  const generatedAt = new Date()
  const snapshot: SnapshotRecord = {
    year,
    month,
    top5,
    ranking,
    fixedAt: generatedAt,
    startDate: range.startDate,
    endDate: range.endDate,
    sourceCount,
    validCount,
    status,
  }

  const saveResult = saveRankingSnapshotToDb(
    toPersistedSnapshot(snapshot, monthKey),
  )

  if (!saveResult.saved && existing) {
    console.warn(
      `[ranking-cache] DB 저장 스킵 (${monthKey}), cachePreserved reason=${saveResult.reason ?? "unknown"}`,
    )
    return existing
  }

  if (saveResult.saved) {
    cache.lastMonthSnapshots[monthKey] = snapshot
    saveSnapshotsToJson(cache.lastMonthSnapshots)
    cache.lastMonth = { year, month, top5 }

    console.log(
      `[ranking-cache] 스냅샷 저장 (${monthKey}) status=${status}, previous=${existing?.top5.length ?? 0}, fetched=${top5.length}, cacheUpdated=true`,
    )
    return snapshot
  }

  return existing ?? null
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

export function getLastMonthSnapshotMeta(
  year: number,
  month: number,
): {
  monthKey: string
  startDate: string
  endDate: string
  updatedAt: string | null
  sourceCount: number
  validCount: number
  status: SnapshotStatus
  source: "sqlite"
} | null {
  const snapshot = getLastMonthSnapshotRecord(year, month)
  if (!snapshot) {
    return null
  }

  const range = getMonthDateRange(year, month)

  return {
    monthKey: range.monthKey,
    startDate: range.startDate,
    endDate: range.endDate,
    updatedAt: snapshot.fixedAt.toISOString(),
    sourceCount: snapshot.sourceCount,
    validCount: snapshot.validCount,
    status: snapshot.status,
    source: "sqlite",
  }
}
