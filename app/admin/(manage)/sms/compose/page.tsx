"use client"

import { FormEvent, Suspense, useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import styles from "../../../admin.module.css"
import SmsSubNav from "../SmsSubNav"

type DraftSummary = {
  total: number
  sendable: number
  excluded: number
  exclusionCounts: Record<string, number>
}

type ExclusionLabel = { reason: string; label: string; count: number }

type RecipientRow = {
  id: number
  google_contact_id: number | null
  name: string
  nickname: string | null
  phone: string
  eligibility_status: "sendable" | "excluded"
  exclusion_reason: string | null
  exclusionReasonLabel?: string
}

type DetailMode = "all" | "sendable" | "excluded" | null

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "")
  if (digits.length === 11 && digits.startsWith("010")) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
  }
  return phone || "연락처 없음"
}

function SmsComposeInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const draftIdParam = searchParams.get("draftId")
  const draftId = draftIdParam ? Number(draftIdParam) : null

  const [modeLabel, setModeLabel] = useState(
    "테스트 모드: 실제 문자가 발송되지 않습니다.",
  )
  const [live, setLive] = useState(false)
  const [summary, setSummary] = useState<DraftSummary | null>(null)
  const [exclusionLabels, setExclusionLabels] = useState<ExclusionLabel[]>([])
  const [title, setTitle] = useState("")
  const [message, setMessage] = useState("")
  const [sendMode, setSendMode] = useState<"immediate" | "scheduled">(
    "immediate",
  )
  const [scheduledLocal, setScheduledLocal] = useState("")
  const [bytes, setBytes] = useState(0)
  const [messageType, setMessageType] = useState<"SMS" | "LMS">("SMS")
  const [error, setError] = useState("")
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [detailMode, setDetailMode] = useState<DetailMode>(null)
  const [detailRows, setDetailRows] = useState<RecipientRow[]>([])
  const [detailPage, setDetailPage] = useState(1)
  const [detailTotalPages, setDetailTotalPages] = useState(1)
  const [detailTotal, setDetailTotal] = useState(0)
  const [detailQuery, setDetailQuery] = useState("")
  const [detailReason, setDetailReason] = useState("")
  const [detailLoading, setDetailLoading] = useState(false)

  useEffect(() => {
    fetch("/api/admin/store-sms/status")
      .then((res) => res.json())
      .then((json) => {
        if (json.mode?.live) {
          setLive(true)
          setModeLabel(
            "실발송 모드입니다. 최종 확인 후 실제 고객에게 문자가 발송됩니다.",
          )
        } else if (json.mode?.label) {
          setModeLabel(json.mode.label)
          setLive(false)
        }
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

    fetch(`/api/admin/store-sms/drafts/${draftId}/recipients?status=all&page=1&pageSize=1`)
      .then((res) => res.json())
      .then((json) => {
        if (json.success && json.summary?.exclusionLabels) {
          setExclusionLabels(json.summary.exclusionLabels)
          setSummary((prev) =>
            prev
              ? {
                  ...prev,
                  total: json.summary.total,
                  sendable: json.summary.sendable,
                  excluded: json.summary.excluded,
                  exclusionCounts: json.summary.exclusions ?? {},
                }
              : {
                  total: json.summary.total,
                  sendable: json.summary.sendable,
                  excluded: json.summary.excluded,
                  exclusionCounts: json.summary.exclusions ?? {},
                },
          )
        }
      })
      .catch(() => undefined)
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

  const loadDetail = useCallback(async () => {
    if (!draftId || !detailMode) return
    setDetailLoading(true)
    try {
      const params = new URLSearchParams({
        status: detailMode,
        page: String(detailPage),
        pageSize: "50",
      })
      if (detailQuery.trim()) params.set("query", detailQuery.trim())
      if (detailReason) params.set("exclusionReason", detailReason)
      const res = await fetch(
        `/api/admin/store-sms/drafts/${draftId}/recipients?${params}`,
      )
      const json = await res.json()
      if (!json.success) {
        setError(json.error ?? "대상 목록 조회 실패")
        return
      }
      setDetailRows(json.data ?? [])
      setDetailTotal(json.pagination.total)
      setDetailTotalPages(json.pagination.totalPages)
      if (json.summary?.exclusionLabels) {
        setExclusionLabels(json.summary.exclusionLabels)
      }
    } finally {
      setDetailLoading(false)
    }
  }, [draftId, detailMode, detailPage, detailQuery, detailReason])

  useEffect(() => {
    if (detailMode) {
      loadDetail().catch(() => undefined)
    }
  }, [detailMode, loadDetail])

  function openDetail(mode: DetailMode) {
    setDetailMode(mode)
    setDetailPage(1)
    setDetailQuery("")
    setDetailReason("")
  }

  function insertVariable(token: string) {
    setMessage((prev) => `${prev}${token}`)
  }

  function openConfirm(event: FormEvent) {
    event.preventDefault()
    setError("")
    if (!draftId) {
      setError("대상함 또는 고객 연락처에서 초안을 생성한 뒤 작성해 주세요.")
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
      <SmsSubNav active="/admin/sms/compose" />
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
            <p className={styles.summaryValue}>
              {summary.total.toLocaleString()}명
            </p>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnSecondary}`}
              style={{ marginTop: 8 }}
              onClick={() => openDetail("all")}
            >
              전체 보기
            </button>
          </div>
          <div className={styles.summaryItem}>
            <p className={styles.summaryLabel}>발송 가능</p>
            <p className={styles.summaryValue}>
              {summary.sendable.toLocaleString()}명
            </p>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnSecondary}`}
              style={{ marginTop: 8 }}
              onClick={() => openDetail("sendable")}
            >
              목록 보기
            </button>
          </div>
          <div className={styles.summaryItem}>
            <p className={styles.summaryLabel}>제외</p>
            <p className={styles.summaryValue}>
              {summary.excluded.toLocaleString()}명
            </p>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnSecondary}`}
              style={{ marginTop: 8 }}
              onClick={() => openDetail("excluded")}
            >
              제외 대상 보기
            </button>
          </div>
        </div>
      ) : (
        <p className={styles.formHint}>
          `/admin/sms/cart` 또는 `/admin/google-contacts`에서 대상을 담아 주세요.
        </p>
      )}

      {exclusionLabels.length > 0 ? (
        <div className={styles.exclusionCards}>
          {exclusionLabels.map((item) => (
            <div key={item.reason} className={styles.exclusionCard}>
              <span>{item.label}</span>
              <strong>{item.count}명</strong>
            </div>
          ))}
        </div>
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
          <div className={styles.variableRow}>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnSecondary}`}
              onClick={() => insertVariable("{이름}")}
            >
              {"{이름}"}
            </button>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnSecondary}`}
              onClick={() => insertVariable("{닉네임}")}
            >
              {"{닉네임}"}
            </button>
          </div>
          <textarea
            className={styles.formTextarea}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="{이름}님, 안녕하세요."
          />
          <p className={styles.formHint}>
            {bytes} byte · 예상 {messageType}
          </p>
        </div>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>발송 방식</label>
          <div className={styles.radioGroupWide}>
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
            <p className={styles.formHint}>
              현재 시각보다 최소 5분 이후만 가능합니다.
            </p>
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
            <p className={styles.googleMeta}>
              대상: 발송 가능 {summary?.sendable ?? 0} / 제외{" "}
              {summary?.excluded ?? 0}
            </p>
            <p className={styles.googleMeta}>
              방식:{" "}
              {sendMode === "immediate" ? "즉시" : `예약 ${scheduledLocal}`}
            </p>
            <p className={styles.googleMeta}>{modeLabel}</p>
            <pre className={styles.messagePreview}>{message}</pre>
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

      {detailMode ? (
        <div className={styles.modalOverlay}>
          <div className={`${styles.modal} ${styles.modalWide}`}>
            <h3 className={styles.modalTitle}>
              {detailMode === "excluded"
                ? "제외 대상"
                : detailMode === "sendable"
                  ? "발송 가능 대상"
                  : "선택 대상 전체"}
            </h3>
            <div className={styles.filterRow}>
              <input
                className={`${styles.formInput} ${styles.filterInput}`}
                placeholder="이름/닉네임/연락처"
                value={detailQuery}
                onChange={(e) => setDetailQuery(e.target.value)}
              />
              {detailMode === "excluded" ? (
                <select
                  className={`${styles.formSelect} ${styles.filterSelect}`}
                  value={detailReason}
                  onChange={(e) => {
                    setDetailReason(e.target.value)
                    setDetailPage(1)
                  }}
                >
                  <option value="">제외 사유 전체</option>
                  {exclusionLabels.map((item) => (
                    <option key={item.reason} value={item.reason}>
                      {item.label}
                    </option>
                  ))}
                </select>
              ) : null}
              <button
                type="button"
                className={`${styles.btn} ${styles.btnSecondary}`}
                onClick={() => {
                  setDetailPage(1)
                  loadDetail()
                }}
              >
                검색
              </button>
            </div>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>이름</th>
                    <th>닉네임</th>
                    <th>연락처</th>
                    <th>상태</th>
                    <th>제외 사유</th>
                    <th>관리</th>
                  </tr>
                </thead>
                <tbody>
                  {detailLoading ? (
                    <tr>
                      <td colSpan={6}>불러오는 중...</td>
                    </tr>
                  ) : detailRows.length === 0 ? (
                    <tr>
                      <td colSpan={6}>대상이 없습니다.</td>
                    </tr>
                  ) : (
                    detailRows.map((row) => (
                      <tr key={row.id}>
                        <td title={row.name}>{row.name}</td>
                        <td title={row.nickname ?? ""}>{row.nickname ?? "-"}</td>
                        <td title={row.phone}>{formatPhone(row.phone)}</td>
                        <td>
                          {row.eligibility_status === "sendable"
                            ? "발송 가능"
                            : "제외"}
                        </td>
                        <td title={row.exclusionReasonLabel ?? ""}>
                          {row.exclusionReasonLabel ?? "-"}
                        </td>
                        <td>
                          {row.google_contact_id ? (
                            <Link
                              href="/admin/google-contacts"
                              className={styles.btnLink}
                            >
                              연락처
                            </Link>
                          ) : (
                            "-"
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className={styles.paginationBar}>
              <div>
                총 {detailTotal.toLocaleString()}명 · {detailPage}/
                {detailTotalPages}
              </div>
              <div className={styles.paginationControls}>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnSecondary}`}
                  disabled={detailPage <= 1}
                  onClick={() => setDetailPage((p) => Math.max(1, p - 1))}
                >
                  이전
                </button>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnSecondary}`}
                  disabled={detailPage >= detailTotalPages}
                  onClick={() => setDetailPage((p) => p + 1)}
                >
                  다음
                </button>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnPrimary}`}
                  onClick={() => setDetailMode(null)}
                >
                  닫기
                </button>
              </div>
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
