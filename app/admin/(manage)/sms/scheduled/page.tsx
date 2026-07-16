"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import styles from "../../../admin.module.css"
import SmsSubNav from "../SmsSubNav"
import { mapStoreSmsCampaignStatusLabel } from "@/lib/store-sms/store-sms-campaign-ui"

type Campaign = {
  id: number
  title: string
  scheduled_at: string | null
  total_recipients: number
  sendable_recipients: number
  status: string
  created_at: string
}

export default function AdminSmsScheduledPage() {
  const [rows, setRows] = useState<Campaign[]>([])
  const [error, setError] = useState("")
  const [modeLabel, setModeLabel] = useState("")

  async function load() {
    const res = await fetch("/api/admin/store-sms/campaigns?view=scheduled")
    const json = await res.json()
    if (!json.success) {
      setError(json.error ?? "목록 조회 실패")
      return
    }
    setRows(json.data ?? [])
    if (json.mode?.label) setModeLabel(json.mode.label)
  }

  useEffect(() => {
    load().catch(() => setError("목록 조회 실패"))
  }, [])

  async function cancel(id: number) {
    if (!window.confirm("이 예약을 취소할까요?")) return
    const res = await fetch(`/api/admin/store-sms/campaigns/${id}/cancel`, {
      method: "POST",
    })
    const json = await res.json()
    if (!res.ok || !json.success) {
      setError(json.error ?? "취소 실패")
      return
    }
    await load()
  }

  return (
    <>
      <Link href="/admin/sms" className={styles.backLink}>
        ← 문자 발송
      </Link>
      <SmsSubNav active="/admin/sms/scheduled" />
      <h2 className={styles.pageTitle}>예약 목록</h2>
      {modeLabel ? (
        <div className={`${styles.modeBanner} ${styles.modeBannerTest}`}>{modeLabel}</div>
      ) : null}
      {error ? (
        <div className={`${styles.message} ${styles.messageError}`}>{error}</div>
      ) : null}
      <div className={`${styles.panel} ${styles.tableWrap}`}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>제목</th>
              <th>예약시각</th>
              <th>총 대상</th>
              <th>발송 가능</th>
              <th>상태</th>
              <th>생성일</th>
              <th>관리</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7}>예약된 문자가 없습니다.</td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.title}</td>
                  <td>{row.scheduled_at ?? "-"}</td>
                  <td>{row.total_recipients}</td>
                  <td>{row.sendable_recipients}</td>
                  <td>
                    {mapStoreSmsCampaignStatusLabel(row.status, "scheduled").label}
                  </td>
                  <td>{row.created_at}</td>
                  <td>
                    <div className={styles.rowActions}>
                      <Link
                        href={`/admin/sms/${row.id}`}
                        className={`${styles.btn} ${styles.btnSecondary}`}
                      >
                        상세
                      </Link>
                      <button
                        type="button"
                        className={`${styles.btn} ${styles.btnDanger}`}
                        onClick={() => cancel(row.id)}
                      >
                        취소
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
