"use client"

import { FormEvent, Suspense, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import styles from "../../../admin.module.css"

type DraftSummary = {
  total: number
  sendable: number
  excluded: number
  exclusionCounts: Record<string, number>
}

function SmsComposeInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const draftIdParam = searchParams.get("draftId")
  const draftId = draftIdParam ? Number(draftIdParam) : null

  const [modeLabel, setModeLabel] = useState("테스트 모드: 실제 문자가 발송되지 않습니다.")
  const [live, setLive] = useState(false)
  const [summary, setSummary] = useState<DraftSummary | null>(null)
  const [title, setTitle] = useState("")
  const [message, setMessage] = useState("")
  const [sendMode, setSendMode] = useState<"immediate" | "scheduled">("immediate")
  const [scheduledLocal, setScheduledLocal] = useState("")
  const [bytes, setBytes] = useState(0)
  const [messageType, setMessageType] = useState<"SMS" | "LMS">("SMS")
  const [error, setError] = useState("")
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetch("/api/admin/store-sms/status")
      .then((res) => res.json())
      .then((json) => {
        if (json.mode?.label) setModeLabel(json.mode.label)
        setLive(Boolean(json.mode?.live))
      })
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    if (!draftId) return
    fetch(`/api/admin/store-sms/drafts/${draftId}`)
      .then((res) => res.json())
      .then((json) => {
        if (!json.success) {
          setError(json.error ?? "초안을 불러오지 못했습니다.")
          return
        }
        setSummary(json.summary)
      })
      .catch(() => setError("초안을 불러오지 못했습니다."))
  }, [draftId])

  useEffect(() => {
    const timer = setTimeout(() => {
      fetch("/api/admin/store-sms/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      })
        .then((res) => res.json())
        .then((json) => {
          if (json.success) {
            setBytes(json.bytes)
            setMessageType(json.messageType)
          }
        })
        .catch(() => undefined)
    }, 200)
    return () => clearTimeout(timer)
  }, [message])

  const exclusionText = useMemo(() => {
    if (!summary) return ""
    return Object.entries(summary.exclusionCounts)
      .map(([key, value]) => `${key}: ${value}`)
      .join(", ")
  }, [summary])

  function openConfirm(event: FormEvent) {
    event.preventDefault()
    setError("")
    if (!draftId) {
      setError("고객 연락처에서 대상을 선택해 draft를 생성한 뒤 작성해 주세요.")
      return
    }
    if (!title.trim() || !message.trim()) {
      setError("제목과 메시지를 입력해 주세요.")
      return
    }
    if (sendMode === "scheduled" && !scheduledLocal) {
      setError("예약 시각을 입력해 주세요.")
      return
    }
    setConfirmOpen(true)
  }

  async function submitCampaign() {
    if (!draftId) return
    setSubmitting(true)
    setError("")
    try {
      const scheduledAt =
        sendMode === "scheduled" && scheduledLocal
          ? new Date(scheduledLocal).toISOString()
          : null
      const res = await fetch("/api/admin/store-sms/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          message,
          sendMode,
          scheduledAt,
          draftId,
        }),
      })
      const json = (await res.json()) as {
        success?: boolean
        campaignId?: number
        error?: string
      }
      if (!res.ok || !json.success || !json.campaignId) {
        setError(json.error ?? "캠페인 생성에 실패했습니다.")
        setConfirmOpen(false)
        return
      }
      router.push(`/admin/sms/${json.campaignId}`)
    } catch {
      setError("캠페인 생성 중 오류가 발생했습니다.")
      setConfirmOpen(false)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <Link href="/admin/sms" className={styles.backLink}>
        ← 문자 발송
      </Link>
      <div className={styles.subNav}>
        <Link href="/admin/sms/compose" className={styles.subNavActive}>
          작성
        </Link>
        <Link href="/admin/sms/scheduled">예약</Link>
        <Link href="/admin/sms/history">이력</Link>
      </div>
      <h2 className={styles.pageTitle}>문자 작성</h2>
      <div
        className={`${styles.modeBanner} ${live ? styles.modeBannerLive : styles.modeBannerTest}`}
      >
        {modeLabel}
      </div>

      {error ? (
        <div className={`${styles.message} ${styles.messageError}`}>{error}</div>
      ) : null}

      {summary ? (
        <div className={styles.summaryGrid}>
          <div className={styles.summaryItem}>
            <p className={styles.summaryLabel}>선택 대상</p>
            <p className={styles.summaryValue}>{summary.total}</p>
          </div>
          <div className={styles.summaryItem}>
            <p className={styles.summaryLabel}>발송 가능</p>
            <p className={styles.summaryValue}>{summary.sendable}</p>
          </div>
          <div className={styles.summaryItem}>
            <p className={styles.summaryLabel}>제외</p>
            <p className={styles.summaryValue}>{summary.excluded}</p>
          </div>
        </div>
      ) : (
        <p className={styles.formHint}>
          `/admin/google-contacts`에서 선택 또는 검색 결과 전체로 들어와 주세요.
        </p>
      )}

      {exclusionText ? (
        <p className={styles.formHint}>제외 사유: {exclusionText}</p>
      ) : null}

      <form className={styles.panel} onSubmit={openConfirm}>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>제목 (관리자용)</label>
          <input
            className={styles.formInput}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="예: 7월 이벤트 안내"
          />
        </div>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>메시지</label>
          <textarea
            className={styles.formTextarea}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="{이름}님, 안녕하세요."
          />
          <p className={styles.formHint}>
            변수: {"{이름}"}, {"{닉네임}"} · {bytes} byte · 예상 {messageType}
          </p>
        </div>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>발송 방식</label>
          <div className={styles.radioGroup}>
            <label className={styles.radioLabel}>
              <input
                type="radio"
                checked={sendMode === "immediate"}
                onChange={() => setSendMode("immediate")}
              />
              즉시 발송
            </label>
            <label className={styles.radioLabel}>
              <input
                type="radio"
                checked={sendMode === "scheduled"}
                onChange={() => setSendMode("scheduled")}
              />
              예약 발송
            </label>
          </div>
        </div>
        {sendMode === "scheduled" ? (
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>예약 시각 (로컬)</label>
            <input
              type="datetime-local"
              className={styles.formInput}
              value={scheduledLocal}
              onChange={(e) => setScheduledLocal(e.target.value)}
            />
            <p className={styles.formHint}>현재 시각보다 최소 5분 이후만 가능합니다.</p>
          </div>
        ) : null}
        <div className={styles.buttonRow}>
          <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`}>
            최종 확인
          </button>
        </div>
      </form>

      {confirmOpen ? (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h3 className={styles.modalTitle}>발송 최종 확인</h3>
            <p className={styles.googleMeta}>대상: 발송 가능 {summary?.sendable ?? 0} / 제외 {summary?.excluded ?? 0}</p>
            <p className={styles.googleMeta}>방식: {sendMode === "immediate" ? "즉시" : `예약 ${scheduledLocal}`}</p>
            <p className={styles.googleMeta}>{modeLabel}</p>
            <pre
              style={{
                whiteSpace: "pre-wrap",
                background: "#0f172a",
                padding: 12,
                borderRadius: 8,
                marginTop: 12,
              }}
            >
              {message}
            </pre>
            <div className={styles.buttonRow} style={{ marginTop: 16 }}>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnPrimary}`}
                disabled={submitting}
                onClick={submitCampaign}
              >
                {submitting ? "처리 중..." : "확인 후 실행"}
              </button>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnSecondary}`}
                disabled={submitting}
                onClick={() => setConfirmOpen(false)}
              >
                돌아가기
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

export default function AdminSmsComposePage() {
  return (
    <Suspense fallback={<p>불러오는 중...</p>}>
      <SmsComposeInner />
    </Suspense>
  )
}
