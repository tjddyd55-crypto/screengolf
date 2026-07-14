import {
  ensureDisplayAssetDir,
  getDisplayStorageDiagnostics,
} from "@/lib/storage/display-storage"

let startupLogged = false

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
}
