import { getDb } from "@/lib/db/sqlite"
import { migrateAllDirectModesToScenes } from "@/lib/display/migrate-direct-to-scene"
import {
  ensureDisplayAssetDir,
  getDisplayStorageDiagnostics,
} from "@/lib/storage/display-storage"

let startupLogged = false
let directMigrationRan = false

export function logDisplayStorageStartup(): void {
  if (startupLogged) return
  startupLogged = true

  try {
    ensureDisplayAssetDir()
  } catch (error) {
    console.error("[display-storage] 초기화 실패:", error)
  }

  const diagnostics = getDisplayStorageDiagnostics()
  console.log(`[display-storage] assetDir=${diagnostics.assetDir}`)
  console.log(
    `[display-storage] persistentVolume=${diagnostics.persistentVolume}`,
  )
  console.log(`[display-storage] writable=${diagnostics.writable}`)

  runDirectModeSceneMigrationOnce()
}

/**
 * 유효 legacy direct mode → Scene 이관 (프로세스당 1회).
 * getUnitBroadcastState 등 조회 경로에서는 호출하지 않는다.
 */
export function runDirectModeSceneMigrationOnce(): void {
  if (directMigrationRan) return
  directMigrationRan = true

  try {
    getDb()
    const count = migrateAllDirectModesToScenes()
    if (count > 0) {
      console.log(`[display] direct→Scene migrated units=${count}`)
    }
  } catch (error) {
    console.error("[display] direct→Scene migration failed:", error)
  }
}

/** 테스트용 */
export function resetDisplayStartupFlagsForTests(): void {
  startupLogged = false
  directMigrationRan = false
}
