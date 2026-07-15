import { dispatchDueStoreSmsCampaigns } from "@/lib/store-sms/store-sms-campaign-service"

const INTERVAL_MS = 60 * 1000

let started = false
let inFlight: Promise<void> | null = null

async function tick(): Promise<void> {
  if (inFlight) return
  inFlight = (async () => {
    try {
      const result = await dispatchDueStoreSmsCampaigns()
      if (result.processedIds.length > 0) {
        console.log(
          `[store-sms-cron] processed=${result.processedIds.length} ids=${result.processedIds.join(",")}`,
        )
      }
    } catch (error) {
      console.error("[store-sms-cron] tick failed:", error)
    } finally {
      inFlight = null
    }
  })()
  await inFlight
}

/** 스크린골프 서버 내 1분 주기 예약문자 dispatcher (HTTP Bearer cron과 병행 가능). */
export function startStoreSmsCron(): void {
  if (started) return
  if (process.env.NEXT_RUNTIME && process.env.NEXT_RUNTIME !== "nodejs") return
  started = true
  console.log("[store-sms-cron] started intervalMs=60000")
  void tick()
  setInterval(() => {
    void tick()
  }, INTERVAL_MS)
}
