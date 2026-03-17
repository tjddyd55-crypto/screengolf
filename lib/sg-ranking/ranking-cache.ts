import { RankedPlayer } from "./ranking-generator"
import fs from "node:fs"
import path from "node:path"

type Snapshot = {
  year: number
  month: number
  top5: RankedPlayer[]
  fixedAt: Date
}

type SnapshotRecord = {
  year: number
  month: number
  top5: RankedPlayer[]
  fixedAt: string
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

const SNAPSHOT_FILE_PATH = path.join(
  process.cwd(),
  "data",
  "monthly-ranking-snapshots.json",
)

function toSnapshotRecord(snapshot: Snapshot): SnapshotRecord {
  return {
    year: snapshot.year,
    month: snapshot.month,
    top5: snapshot.top5,
    fixedAt: snapshot.fixedAt.toISOString(),
  }
}

function fromSnapshotRecord(record: SnapshotRecord): Snapshot {
  return {
    year: record.year,
    month: record.month,
    top5: record.top5,
    fixedAt: new Date(record.fixedAt),
  }
}

function loadSnapshotsFromDisk(): Record<string, Snapshot> {
  try {
    if (!fs.existsSync(SNAPSHOT_FILE_PATH)) {
      return {}
    }

    const raw = fs.readFileSync(SNAPSHOT_FILE_PATH, "utf8")
    const parsed = JSON.parse(raw) as Record<string, SnapshotRecord>
    const snapshots: Record<string, Snapshot> = {}

    for (const [key, value] of Object.entries(parsed)) {
      snapshots[key] = fromSnapshotRecord(value)
    }

    return snapshots
  } catch (error) {
    console.warn("[ranking-cache] 스냅샷 파일 로딩 실패, 메모리 캐시로 진행합니다.", error)
    return {}
  }
}

function saveSnapshotsToDisk(snapshots: Record<string, Snapshot>): void {
  try {
    const dir = path.dirname(SNAPSHOT_FILE_PATH)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    const serializable: Record<string, SnapshotRecord> = {}
    for (const [key, snapshot] of Object.entries(snapshots)) {
      serializable[key] = toSnapshotRecord(snapshot)
    }

    fs.writeFileSync(
      SNAPSHOT_FILE_PATH,
      JSON.stringify(serializable, null, 2),
      "utf8",
    )
  } catch (error) {
    console.warn("[ranking-cache] 스냅샷 파일 저장 실패, 메모리 캐시만 유지합니다.", error)
  }
}

const cache: MonthlyCache = {
  lastMonth: null,
  lastMonthSnapshots: loadSnapshotsFromDisk(),
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
  saveSnapshotsToDisk(cache.lastMonthSnapshots)
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
