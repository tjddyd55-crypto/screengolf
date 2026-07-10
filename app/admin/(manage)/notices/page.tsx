"use client"

import { FormEvent, useCallback, useEffect, useState } from "react"
import Link from "next/link"
import styles from "../../admin.module.css"
import {
  NOTICE_THEME_LABELS,
  NOTICE_THEMES,
  type NoticeTheme,
} from "@/lib/admin/constants"

type Notice = {
  id: number
  title: string
  body: string
  theme: NoticeTheme
  is_active: boolean
  created_at: string
  updated_at: string
}

type NoticeForm = {
  title: string
  body: string
  theme: NoticeTheme
  is_active: boolean
}

const EMPTY_FORM: NoticeForm = {
  title: "",
  body: "",
  theme: "default",
  is_active: true,
}

export default function AdminNoticesPage() {
  const [notices, setNotices] = useState<Notice[]>([])
  const [form, setForm] = useState<NoticeForm>(EMPTY_FORM)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  const loadNotices = useCallback(async () => {
    const res = await fetch("/api/admin/notices")
    const json = (await res.json()) as { data?: Notice[] }
    setNotices(json.data ?? [])
  }, [])

  useEffect(() => {
    loadNotices()
  }, [loadNotices])

  function openCreateModal() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setShowModal(true)
    setMessage("")
    setError("")
  }

  function openEditModal(notice: Notice) {
    setEditingId(notice.id)
    setForm({
      title: notice.title,
      body: notice.body,
      theme: notice.theme,
      is_active: notice.is_active,
    })
    setShowModal(true)
    setMessage("")
    setError("")
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setMessage("")
    setError("")

    try {
      const res = await fetch("/api/admin/notices", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingId ? { id: editingId, ...form } : form),
      })
      const json = (await res.json()) as { success?: boolean; error?: string }

      if (!res.ok || !json.success) {
        setError(json.error ?? "저장에 실패했습니다.")
        return
      }

      setShowModal(false)
      setMessage(editingId ? "공지사항이 수정되었습니다." : "공지사항이 등록되었습니다.")
      await loadNotices()
    } catch {
      setError("저장 중 오류가 발생했습니다.")
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm("이 공지사항을 삭제하시겠습니까?")) return

    const res = await fetch(`/api/admin/notices?id=${id}`, { method: "DELETE" })
    const json = (await res.json()) as { success?: boolean; error?: string }

    if (!res.ok || !json.success) {
      setError(json.error ?? "삭제에 실패했습니다.")
      return
    }

    setMessage("공지사항이 삭제되었습니다.")
    await loadNotices()
  }

  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <Link href="/admin" className={styles.btnLink}>
          ← 관리자 홈
        </Link>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h2 className={styles.pageTitle} style={{ margin: 0 }}>
          공지사항 관리
        </h2>
        <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={openCreateModal}>
          공지 등록
        </button>
      </div>

      {message ? (
        <div className={`${styles.message} ${styles.messageSuccess}`}>{message}</div>
      ) : null}
      {error ? (
        <div className={`${styles.message} ${styles.messageError}`}>{error}</div>
      ) : null}

      <div className={`${styles.panel} ${styles.tableWrap}`}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>제목</th>
              <th>테마</th>
              <th>상태</th>
              <th>수정일</th>
              <th>관리</th>
            </tr>
          </thead>
          <tbody>
            {notices.length === 0 ? (
              <tr>
                <td colSpan={5}>등록된 공지사항이 없습니다.</td>
              </tr>
            ) : (
              notices.map((notice) => (
                <tr key={notice.id}>
                  <td>{notice.title}</td>
                  <td>{NOTICE_THEME_LABELS[notice.theme]}</td>
                  <td>
                    <span
                      className={`${styles.badge} ${
                        notice.is_active ? styles.badgeActive : styles.badgeInactive
                      }`}
                    >
                      {notice.is_active ? "활성" : "비활성"}
                    </span>
                  </td>
                  <td>{notice.updated_at.slice(0, 16).replace("T", " ")}</td>
                  <td>
                    <div className={styles.buttonRow}>
                      <button
                        type="button"
                        className={`${styles.btn} ${styles.btnSecondary}`}
                        onClick={() => openEditModal(notice)}
                      >
                        수정
                      </button>
                      <button
                        type="button"
                        className={`${styles.btn} ${styles.btnDanger}`}
                        onClick={() => handleDelete(notice.id)}
                      >
                        삭제
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal ? (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h3 className={styles.modalTitle}>
              {editingId ? "공지사항 수정" : "공지사항 등록"}
            </h3>
            <form onSubmit={handleSubmit}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="title">
                  제목
                </label>
                <input
                  id="title"
                  className={styles.formInput}
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="body">
                  내용
                </label>
                <textarea
                  id="body"
                  className={styles.formTextarea}
                  value={form.body}
                  onChange={(e) => setForm({ ...form, body: e.target.value })}
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="theme">
                  테마
                </label>
                <select
                  id="theme"
                  className={styles.formSelect}
                  value={form.theme}
                  onChange={(e) =>
                    setForm({ ...form, theme: e.target.value as NoticeTheme })
                  }
                >
                  {NOTICE_THEMES.map((theme) => (
                    <option key={theme} value={theme}>
                      {NOTICE_THEME_LABELS[theme]}
                    </option>
                  ))}
                </select>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.radioLabel}>
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                  />
                  활성
                </label>
              </div>
              <div className={styles.buttonRow}>
                <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`}>
                  저장
                </button>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnSecondary}`}
                  onClick={() => setShowModal(false)}
                >
                  취소
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  )
}
