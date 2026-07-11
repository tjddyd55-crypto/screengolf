export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { logRankingStorageStartup } = await import(
      "@/lib/sg-ranking/storage-startup"
    )
    logRankingStorageStartup()
  }
}
