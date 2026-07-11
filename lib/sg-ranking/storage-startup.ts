import { getDataPathsDiagnostics, ensureDataDir } from "@/lib/storage/data-paths"
import {
  getLastMonthCache,
  getLastMonthSnapshotRecord,
  initializeRankingStorage,
} from "./ranking-cache"
import { getKoreaYearMonth, getPreviousMonth } from "./date-range"

let startupLogged = false

export function logRankingStorageStartup(): void {
  if (startupLogged) {
    return
  }
  startupLogged = true

  try {
    ensureDataDir()
    initializeRankingStorage()
  } catch (error) {
    console.error("[ranking-storage] 초기화 실패:", error)
  }

  const diagnostics = getDataPathsDiagnostics()
  const { year, month } = getKoreaYearMonth()
  const previous = getPreviousMonth(year, month)
  const monthKey = `${previous.year}-${String(previous.month).padStart(2, "0")}`
  const snapshot = getLastMonthSnapshotRecord(previous.year, previous.month)
  const hydrated = getLastMonthCache()

  console.log(`[ranking-storage] dataDir=${diagnostics.dataDir}`)
  console.log(`[ranking-storage] dbPath=${diagnostics.storeDbPath}`)
  console.log(
    `[ranking-storage] persistentVolume=${diagnostics.persistentVolume}`,
  )
  console.log(
    `[ranking-storage] dataDirExists=${diagnostics.dataDirExists}, writable=${diagnostics.dataDirWritable}, storeDbExists=${diagnostics.storeDbExists}, storeDbSizeBytes=${diagnostics.storeDbSizeBytes ?? 0}`,
  )
  console.log(
    `[ranking-storage] lastMonthSnapshot=${snapshot ? `${monthKey} ${snapshot.status}` : "none"}`,
  )
  console.log(
    `[ranking-storage] hydratedTop5=${hydrated?.top5.length ?? 0}`,
  )

  if (!diagnostics.persistentVolume) {
    console.warn(
      "[ranking-storage] DATA_DIR 미설정: Railway Volume 없으면 재배포 시 DB/스냅샷이 소실될 수 있습니다.",
    )
  }
}
