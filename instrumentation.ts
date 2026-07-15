export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { logRankingStorageStartup } = await import(
      "@/lib/sg-ranking/storage-startup"
    )
    const { logDisplayStorageStartup } = await import(
      "@/lib/storage/display-startup"
    )
    const { startStoreSmsCron } = await import(
      "@/lib/store-sms/store-sms-cron"
    )
    logRankingStorageStartup()
    logDisplayStorageStartup()
    startStoreSmsCron()
  }
}
