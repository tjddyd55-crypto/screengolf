import fs from "node:fs"
import path from "node:path"

export type DataPathsDiagnostics = {
  cwd: string
  dataDir: string
  storeDbPath: string
  rankingSnapshotJsonPath: string
  persistentVolume: boolean
  dataDirExists: boolean
  storeDbExists: boolean
  storeDbSizeBytes: number | null
  dataDirWritable: boolean
}

function resolvePath(value: string): string {
  return path.resolve(value)
}

export function getDataDir(): string {
  const configured = process.env.DATA_DIR?.trim()
  if (configured) {
    return resolvePath(configured)
  }

  return path.join(process.cwd(), "data")
}

export function getStoreDbPath(): string {
  const configured = process.env.STORE_DB_PATH?.trim()
  if (configured) {
    return resolvePath(configured)
  }

  return path.join(getDataDir(), "store.db")
}

export function getRankingSnapshotJsonPath(): string {
  const configured = process.env.RANKING_SNAPSHOT_JSON_PATH?.trim()
  if (configured) {
    return resolvePath(configured)
  }

  return path.join(getDataDir(), "monthly-ranking-snapshots.json")
}

export function isPersistentVolumeConfigured(): boolean {
  return Boolean(process.env.DATA_DIR?.trim() || process.env.STORE_DB_PATH?.trim())
}

export function ensureDataDir(): string {
  const dataDir = getDataDir()

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true })
  }

  const probePath = path.join(dataDir, ".write-probe")
  try {
    fs.writeFileSync(probePath, "ok", "utf8")
    fs.unlinkSync(probePath)
  } catch (error) {
    throw new Error(
      `[data-paths] DATA_DIR 쓰기 불가: ${dataDir} (${error instanceof Error ? error.message : String(error)})`,
    )
  }

  return dataDir
}

export function getDataPathsDiagnostics(): DataPathsDiagnostics {
  const dataDir = getDataDir()
  const storeDbPath = getStoreDbPath()
  const dataDirExists = fs.existsSync(dataDir)
  const storeDbExists = fs.existsSync(storeDbPath)

  let dataDirWritable = false
  if (dataDirExists) {
    const probePath = path.join(dataDir, ".write-probe")
    try {
      fs.writeFileSync(probePath, "ok", "utf8")
      fs.unlinkSync(probePath)
      dataDirWritable = true
    } catch {
      dataDirWritable = false
    }
  }

  return {
    cwd: process.cwd(),
    dataDir,
    storeDbPath,
    rankingSnapshotJsonPath: getRankingSnapshotJsonPath(),
    persistentVolume: isPersistentVolumeConfigured(),
    dataDirExists,
    storeDbExists,
    storeDbSizeBytes: storeDbExists ? fs.statSync(storeDbPath).size : null,
    dataDirWritable,
  }
}
