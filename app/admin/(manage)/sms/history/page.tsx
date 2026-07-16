"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import styles from "../../../admin.module.css"
import SmsSubNav from "../SmsSubNav"

type Campaign = {
  id: number
  title: string
  send_mode: string
  scheduled_at: string | null
  started_at: string | null
  completed_at: string | null
  success_count: number
  failed_count: number
  excluded_recipients: number
  status: string
}

export default function AdminSmsHistoryPage() {
  const [rows, setRows] = useState<Campaign[]>([])
  const [error, setError] = useState("")

  useEffect(() => {
    fetch("/api/admin/store-sms/campaigns?view=history")
      .then((res) => res.json())
      .then((json) => {
        if (!json.success) {
          setError(json.error ?? "이력 조회 실패")
          return
        }
        setRows(json.data ?? [])
      })
      .catch(() => setError("이력 조회 실패"))
  }, [])

  return (
    <>
      <Link href="/admin/sms" className={styles.backLink}>
        ← 문자 발송
      </Link>
      <SmsSubNav active="/admin/sms/history" />
      <h2 className={styles.pageTitle}>발송 이력</h2>
      {error ? (
        <div className={`${styles.message} ${styles.messageError}`}>{error}</div>
      ) : null}
      <div className={`${styles.panel} ${styles.tableWrap}`}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>제목</th>
              <th>발송 방식</th>
              <th>예약/실행 시각</th>
              <th>성공</th>
              <th>실패</th>
              <th>제외</th>
              <th>상태</th>
              <th>상세</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8}>이력이 없습니다.</td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.title}</td>
                  <td>{row.send_mode}</td>
                  <td>{row.completed_at ?? row.started_at ?? row.scheduled_at ?? "-"}</td>
                  <td>{row.success_count}</td>
                  <td>{row.failed_count}</td>
                  <td>{row.excluded_recipients}</td>
                  <td>{row.status}</td>
                  <td>
                    <Link href={`/admin/sms/${row.id}`} className={styles.btnLink}>
                      보기
                    </Link>
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
