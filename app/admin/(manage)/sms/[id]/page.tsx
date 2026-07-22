"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import styles from "../../../admin.module.css"
import type {
  StoreSmsCampaignLiveCounts,
  StoreSmsCampaignUiView,
} from "@/lib/store-sms/store-sms-campaign-ui"
import { isStoreSmsPollingStatus } from "@/lib/store-sms/store-sms-campaign-ui"

type Recipient = {
  id: number
  name: string
  phone: string
  status: string
  exclusion_reason: string | null
  error_message: string | null
  provider_message_id: string | null
}

type Campaign = {
  id: number
  title: string
  message: string
  send_mode: string
  scheduled_at: string | null
  status: string
  total_recipients: number
  sendable_recipients: number
  excluded_recipients: number
  success_count: number
  failed_count: number
}

const POLL_MS = 4000

function toneClass(tone: StoreSmsCampaignUiView["tone"]): string {
  switch (tone) {
    case "green":
      return styles.smsToneGreen
    case "blue":
      return styles.smsToneBlue
    case "orange":
      return styles.smsToneOrange
    case "yellow":
      return styles.smsToneYellow
    case "red":
      return styles.smsToneRed
    default:
      return styles.smsToneGray
  }
}

function formatCount(value: number): string {
  return `${value.toLocaleString()}명`
}

export default function AdminSmsDetailPage() {
  const params = useParams<{ id: string }>()
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [progress, setProgress] = useState<StoreSmsCampaignLiveCounts | null>(
    null,
  )
  const [ui, setUi] = useState<StoreSmsCampaignUiView | null>(null)
  const [recipients, setRecipients] = useState<Recipient[]>([])
  const [recipientsLoaded, setRecipientsLoaded] = useState(false)
  const [modeLabel, setModeLabel] = useState("")
  const [error, setError] = useState("")
  const [resumeNotice, setResumeNotice] = useState(false)
  const previousUiKeyRef = useRef<string | null>(null)
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const id = params.id
    let cancelled = false

    function clearPollTimer() {
      if (pollTimerRef.current) {
        clearTimeout(pollTimerRef.current)
        pollTimerRef.current = null
      }
    }

    async function load(summaryOnly: boolean) {
      const query = summaryOnly ? "?summary=1" : ""
      const res = await fetch(`/api/admin/store-sms/campaigns/${id}${query}`)
      const json = await res.json()
      if (cancelled) return

      if (!json.success) {
        setError(json.error ?? "상세 조회 실패")
        return
      }

      setError("")
      setCampaign(json.campaign)
      setProgress(json.progress ?? null)
      setUi(json.ui ?? null)
      if (json.mode?.label) setModeLabel(json.mode.label)

      if (!summaryOnly) {
        setRecipients(json.recipients ?? [])
        setRecipientsLoaded(true)
      }

      const nextUi = json.ui as StoreSmsCampaignUiView | undefined
      const prevKey = previousUiKeyRef.current
      if (prevKey === "balance_paused" && nextUi?.key === "sending") {
        setResumeNotice(true)
      }
      if (nextUi?.key === "balance_paused" || nextUi?.isTerminal) {
        setResumeNotice(false)
      }
      previousUiKeyRef.current = nextUi?.key ?? null

      const status = String(json.campaign?.status ?? "")
      clearPollTimer()
      if (isStoreSmsPollingStatus(status) && !nextUi?.isTerminal) {
        pollTimerRef.current = setTimeout(() => {
          load(true).catch(() => {
            if (!cancelled) setError("상태 갱신 실패")
          })
        }, POLL_MS)
      }
    }

    load(false).catch(() => {
      if (!cancelled) setError("상세 조회 실패")
    })

    return () => {
      cancelled = true
      clearPollTimer()
    }
  }, [params.id])

  const statusTone = ui ? toneClass(ui.tone) : styles.smsToneGray

  return (
    <>
      <Link href="/admin/sms/history" className={styles.backLink}>
        ← 발송 이력
      </Link>
      <h2 className={styles.pageTitle}>문자 상세 #{params.id}</h2>
      {modeLabel ? (
        <div className={`${styles.modeBanner} ${styles.modeBannerTest}`}>
          {modeLabel}
        </div>
      ) : null}
      {error ? (
        <div className={`${styles.message} ${styles.messageError}`}>{error}</div>
      ) : null}

      {campaign && progress && ui ? (
        <>
          <div className={styles.smsDetailHeader}>
            <div>
              <h3 className={styles.googlePanelTitle}>{campaign.title}</h3>
              <p className={styles.googleMeta}>
                방식: {campaign.send_mode === "scheduled" ? "예약" : "즉시"}
                {campaign.scheduled_at ? ` · 예약 ${campaign.scheduled_at}` : ""}
              </p>
            </div>
            <span className={`${styles.smsStatusBadge} ${statusTone}`}>
              {ui.label}
            </span>
          </div>

          <div className={styles.smsProgressGrid}>
            <div className={styles.smsStatCard}>
              <span className={styles.smsStatLabel}>전체 대상</span>
              <strong className={styles.smsStatValue}>
                {formatCount(progress.total)}
              </strong>
            </div>
            <div className={styles.smsStatCard}>
              <span className={styles.smsStatLabel}>발송 가능</span>
              <strong className={styles.smsStatValue}>
                {formatCount(progress.sendable)}
              </strong>
            </div>
            <div className={styles.smsStatCard}>
              <span className={styles.smsStatLabel}>완료</span>
              <strong className={styles.smsStatValue}>
                {formatCount(progress.success)}
              </strong>
            </div>
            <div className={styles.smsStatCard}>
              <span className={styles.smsStatLabel}>남음</span>
              <strong className={styles.smsStatValue}>
                {formatCount(progress.remaining)}
              </strong>
            </div>
            <div className={styles.smsStatCard}>
              <span className={styles.smsStatLabel}>제외</span>
              <strong className={styles.smsStatValue}>
                {formatCount(progress.excluded)}
              </strong>
            </div>
            <div className={styles.smsStatCard}>
              <span className={styles.smsStatLabel}>실패</span>
              <strong className={styles.smsStatValue}>
                {formatCount(progress.failed)}
              </strong>
            </div>
            <div className={styles.smsStatCard}>
              <span className={styles.smsStatLabel}>성공률</span>
              <strong className={styles.smsStatValue}>
                {progress.successRatePercent}%
              </strong>
            </div>
          </div>

          <div className={styles.smsProgressPanel}>
            <div className={styles.smsProgressMeta}>
              <span>진행률</span>
              <strong>{progress.progressPercent}%</strong>
            </div>
            <div
              className={styles.smsProgressTrack}
              role="progressbar"
              aria-valuenow={progress.progressPercent}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className={`${styles.smsProgressFill} ${statusTone}`}
                style={{ width: `${Math.min(100, progress.progressPercent)}%` }}
              />
            </div>
          </div>

          {ui.key === "sending" || ui.key === "scheduled_sending" ? (
            <div className={`${styles.smsBanner} ${styles.smsBannerBlue}`}>
              <p className={styles.smsBannerTitle}>현재 문자 발송중입니다.</p>
              <p className={styles.smsBannerText}>
                성공 {formatCount(progress.success)} · 남은 대상{" "}
                {formatCount(progress.remaining)}
              </p>
              <p className={styles.smsBannerHint}>잠시만 기다려 주세요.</p>
            </div>
          ) : null}

          {ui.isBalancePaused ? (
            <div className={`${styles.smsBanner} ${styles.smsBannerYellow}`}>
              <p className={styles.smsBannerTitle}>
                문자 잔액이 부족하여 발송이 일시 중단되었습니다.
              </p>
              <p className={styles.smsBannerText}>
                현재 성공 {progress.success.toLocaleString()}건 · 남은 대상{" "}
                {progress.remaining.toLocaleString()}건
              </p>
              <p className={styles.smsBannerHint}>
                문자 충전 후 자동으로 이어서 발송됩니다.
              </p>
            </div>
          ) : null}

          {resumeNotice && !ui.isBalancePaused && !ui.isTerminal ? (
            <div className={`${styles.smsBanner} ${styles.smsBannerBlue}`}>
              <p className={styles.smsBannerTitle}>
                문자 잔액이 충전되었습니다.
              </p>
              <p className={styles.smsBannerText}>
                남은 대상 발송을 계속 진행합니다.
              </p>
            </div>
          ) : null}

          {ui.key === "completed" || ui.key === "scheduled_completed" ? (
            <div className={`${styles.smsBanner} ${styles.smsBannerGreen}`}>
              <p className={styles.smsBannerTitle}>
                문자 발송이 완료되었습니다.
              </p>
              <p className={styles.smsBannerText}>
                전체 {formatCount(progress.total)} · 발송 성공{" "}
                {formatCount(progress.success)} · 제외{" "}
                {formatCount(progress.excluded)} · 실패{" "}
                {formatCount(progress.failed)}
              </p>
            </div>
          ) : null}

          {ui.key === "failed" ? (
            <div className={`${styles.smsBanner} ${styles.smsBannerRed}`}>
              <p className={styles.smsBannerTitle}>문자 발송에 실패했습니다.</p>
              <p className={styles.smsBannerText}>
                성공 {formatCount(progress.success)} · 실패{" "}
                {formatCount(progress.failed)} · 남음{" "}
                {formatCount(progress.remaining)}
              </p>
            </div>
          ) : null}

          <div className={styles.smsRetryRow}>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnSecondary}`}
              disabled
              title={
                ui.isBalancePaused
                  ? "잔액 부족 상태에서는 재발송 버튼을 사용하지 않습니다."
                  : "실패 재발송은 준비 중입니다."
              }
            >
              실패한 대상 다시 발송
            </button>
            <span className={styles.smsRetryHint}>
              {ui.isBalancePaused
                ? "잔액 부족 시에는 충전 후 자동으로 이어서 발송됩니다."
                : ui.canShowRetryPlaceholder
                  ? "Gateway/통신 실패 재발송은 준비 중입니다."
                  : "실패 건이 있을 때만 활성화됩니다."}
            </span>
          </div>

          <div className={styles.panel} style={{ marginBottom: 16 }}>
            <h3 className={styles.googlePanelTitle}>메시지</h3>
            <pre className={styles.messagePreview}>{campaign.message}</pre>
          </div>
        </>
      ) : null}

      <div className={`${styles.panel} ${styles.tableWrap}`}>
        <h3 className={styles.googlePanelTitle}>수신자 목록</h3>
        {!recipientsLoaded ? (
          <p className={styles.googleMeta}>목록을 불러오는 중…</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>이름</th>
                <th>연락처</th>
                <th>상태</th>
                <th>제외/오류</th>
                <th>provider id</th>
              </tr>
            </thead>
            <tbody>
              {recipients.length === 0 ? (
                <tr>
                  <td colSpan={5}>수신자가 없습니다.</td>
                </tr>
              ) : (
                recipients.map((row) => (
                  <tr key={row.id}>
                    <td data-label="이름">{row.name}</td>
                    <td data-label="연락처">{row.phone}</td>
                    <td data-label="상태">{row.status}</td>
                    <td data-label="제외/오류">
                      {row.exclusion_reason ?? row.error_message ?? "-"}
                    </td>
                    <td className={styles.desktopCol} data-label="provider id">
                      {row.provider_message_id ?? "-"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}
