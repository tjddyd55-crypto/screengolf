"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import styles from "../../../admin.module.css"

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

export default function AdminSmsDetailPage() {
  const params = useParams<{ id: string }>()
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [recipients, setRecipients] = useState<Recipient[]>([])
  const [modeLabel, setModeLabel] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    const id = params.id
    fetch(`/api/admin/store-sms/campaigns/${id}`)
      .then((res) => res.json())
      .then((json) => {
        if (!json.success) {
          setError(json.error ?? "상세 조회 실패")
          return
        }
        setCampaign(json.campaign)
        setRecipients(json.recipients ?? [])
        if (json.mode?.label) setModeLabel(json.mode.label)
      })
      .catch(() => setError("상세 조회 실패"))
  }, [params.id])

  return (
    <>
      <Link href="/admin/sms/history" className={styles.backLink}>
        ← 발송 이력
      </Link>
      <h2 className={styles.pageTitle}>문자 상세 #{params.id}</h2>
      {modeLabel ? (
        <div className={`${styles.modeBanner} ${styles.modeBannerTest}`}>{modeLabel}</div>
      ) : null}
      {error ? (
        <div className={`${styles.message} ${styles.messageError}`}>{error}</div>
      ) : null}
      {campaign ? (
        <div className={styles.panel} style={{ marginBottom: 16 }}>
          <h3 className={styles.googlePanelTitle}>{campaign.title}</h3>
          <p className={styles.googleMeta}>상태: {campaign.status}</p>
          <p className={styles.googleMeta}>방식: {campaign.send_mode}</p>
          <p className={styles.googleMeta}>예약: {campaign.scheduled_at ?? "-"}</p>
          <p className={styles.googleMeta}>
            대상 {campaign.total_recipients} / 가능 {campaign.sendable_recipients} /
            제외 {campaign.excluded_recipients} / 성공 {campaign.success_count} /
            실패 {campaign.failed_count}
          </p>
          <pre
            style={{
              whiteSpace: "pre-wrap",
              background: "#0f172a",
              padding: 12,
              borderRadius: 8,
              marginTop: 12,
            }}
          >
            {campaign.message}
          </pre>
        </div>
      ) : null}
      <div className={`${styles.panel} ${styles.tableWrap}`}>
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
            {recipients.map((row) => (
              <tr key={row.id}>
                <td>{row.name}</td>
                <td>{row.phone}</td>
                <td>{row.status}</td>
                <td>{row.exclusion_reason ?? row.error_message ?? "-"}</td>
                <td>{row.provider_message_id ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
