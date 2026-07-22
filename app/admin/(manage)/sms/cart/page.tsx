"use client"

import { FormEvent, useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import styles from "../../../admin.module.css"
import SmsSubNav from "../SmsSubNav"

type Contact = {
  id: number
  name: string
  nickname: string | null
  phone: string
  google_sync_status: string
  sms_opt_out: boolean
  is_active: boolean
}

type Pagination = {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "")
  if (digits.length === 11 && digits.startsWith("010")) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
  }
  return phone || "-"
}

export default function AdminSmsCartPage() {
  const router = useRouter()
  const [contacts, setContacts] = useState<Contact[]>([])
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    pageSize: 50,
    total: 0,
    totalPages: 1,
  })
  const [cartTotal, setCartTotal] = useState(0)
  const [query, setQuery] = useState("")
  const [appliedQuery, setAppliedQuery] = useState("")
  const [page, setPage] = useState(1)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [groupName, setGroupName] = useState("")
  const [groupDesc, setGroupDesc] = useState("")
  const [savingGroup, setSavingGroup] = useState(false)

  const load = useCallback(async () => {
    const params = new URLSearchParams({
      detail: "1",
      page: String(page),
      pageSize: "50",
    })
    if (appliedQuery.trim()) params.set("query", appliedQuery.trim())
    const res = await fetch(`/api/admin/store-sms/cart?${params.toString()}`)
    const json = await res.json()
    if (!json.success) {
      setError(json.error ?? "대상함 조회 실패")
      return
    }
    setContacts(json.data ?? [])
    setPagination(json.pagination)
    setCartTotal(json.total ?? json.pagination?.total ?? 0)
    setSelectedIds([])
  }, [page, appliedQuery])

  useEffect(() => {
    load().catch(() => setError("대상함 조회 실패"))
  }, [load])

  async function removeOne(id: number) {
    const res = await fetch(`/api/admin/store-sms/cart/items/${id}`, {
      method: "DELETE",
    })
    const json = await res.json()
    if (!json.success) {
      setError(json.error ?? "제거 실패")
      return
    }
    setMessage("대상함에서 제거했습니다.")
    await load()
  }

  async function removeSelected() {
    if (selectedIds.length === 0) return
    const res = await fetch("/api/admin/store-sms/cart/items", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactIds: selectedIds }),
    })
    const json = await res.json()
    if (!json.success) {
      setError(json.error ?? "선택 제거 실패")
      return
    }
    setMessage(`${json.removed}명을 제거했습니다.`)
    await load()
  }

  async function clearAll() {
    if (!window.confirm("대상함을 모두 비울까요?")) return
    const res = await fetch("/api/admin/store-sms/cart", { method: "DELETE" })
    const json = await res.json()
    if (!json.success) {
      setError(json.error ?? "비우기 실패")
      return
    }
    setMessage("대상함을 비웠습니다.")
    await load()
  }

  async function compose() {
    setError("")
    const res = await fetch("/api/admin/store-sms/cart/to-draft", {
      method: "POST",
    })
    const json = await res.json()
    if (!json.success || !json.draftId) {
      setError(json.error ?? "문자 작성으로 이동하지 못했습니다.")
      return
    }
    router.push(`/admin/sms/compose?draftId=${json.draftId}`)
  }

  async function saveGroup(event: FormEvent) {
    event.preventDefault()
    if (!groupName.trim()) {
      setError("그룹명을 입력해 주세요.")
      return
    }
    setSavingGroup(true)
    try {
      const res = await fetch("/api/admin/store-sms/contact-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: groupName.trim(),
          description: groupDesc.trim() || null,
          fromCart: true,
        }),
      })
      const json = await res.json()
      if (!json.success) {
        setError(json.error ?? "그룹 저장 실패")
        return
      }
      setMessage(`그룹이 저장되었습니다. (ID ${json.groupId})`)
      setGroupName("")
      setGroupDesc("")
    } finally {
      setSavingGroup(false)
    }
  }

  return (
    <>
      <Link href="/admin/sms" className={styles.backLink}>
        ← 문자 발송
      </Link>
      <SmsSubNav active="/admin/sms/cart" />
      <h2 className={styles.pageTitle}>문자 대상함</h2>
      <p className={styles.googleMeta}>총 {cartTotal.toLocaleString()}명</p>

      {message ? (
        <div className={`${styles.message} ${styles.messageSuccess}`}>{message}</div>
      ) : null}
      {error ? (
        <div className={`${styles.message} ${styles.messageError}`}>{error}</div>
      ) : null}

      <div className={styles.contactsToolbar}>
        <div className={styles.contactsToolbarLeft}>
          <input
            className={`${styles.formInput} ${styles.filterInput}`}
            placeholder="대상함 검색"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button
            type="button"
            className={`${styles.btn} ${styles.btnSecondary}`}
            onClick={() => {
              setAppliedQuery(query)
              setPage(1)
            }}
          >
            검색
          </button>
        </div>
        <div className={styles.contactsToolbarRight}>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnPrimary}`}
            disabled={cartTotal === 0}
            onClick={compose}
          >
            문자 작성
          </button>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnSecondary}`}
            disabled={selectedIds.length === 0}
            onClick={removeSelected}
          >
            선택 제거
          </button>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnDanger}`}
            disabled={cartTotal === 0}
            onClick={clearAll}
          >
            대상함 비우기
          </button>
        </div>
      </div>

      <form className={styles.panel} style={{ marginBottom: 16 }} onSubmit={saveGroup}>
        <h3 className={styles.googlePanelTitle}>현재 대상함을 그룹으로 저장</h3>
        <div className={styles.filterRow}>
          <input
            className={`${styles.formInput} ${styles.filterInput}`}
            placeholder="그룹명"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
          />
          <input
            className={`${styles.formInput} ${styles.filterInput}`}
            placeholder="설명 (선택)"
            value={groupDesc}
            onChange={(e) => setGroupDesc(e.target.value)}
          />
          <button
            type="submit"
            className={`${styles.btn} ${styles.btnSecondary}`}
            disabled={savingGroup || cartTotal === 0}
          >
            그룹 저장
          </button>
        </div>
      </form>

      <div className={`${styles.panel} ${styles.tableWrap}`}>
        <table className={`${styles.table} ${styles.contactsTable}`}>
          <thead>
            <tr>
              <th className={styles.colCheck}>
                <input
                  type="checkbox"
                  checked={
                    contacts.length > 0 &&
                    contacts.every((c) => selectedIds.includes(c.id))
                  }
                  onChange={() => {
                    const ids = contacts.map((c) => c.id)
                    const all = ids.every((id) => selectedIds.includes(id))
                    setSelectedIds((prev) =>
                      all
                        ? prev.filter((id) => !ids.includes(id))
                        : [...new Set([...prev, ...ids])],
                    )
                  }}
                />
              </th>
              <th>이름</th>
              <th>닉네임</th>
              <th>연락처</th>
              <th>연동 상태</th>
              <th>수신거부</th>
              <th>관리</th>
            </tr>
          </thead>
          <tbody>
            {contacts.length === 0 ? (
              <tr>
                <td colSpan={7}>대상함이 비어 있습니다.</td>
              </tr>
            ) : (
              contacts.map((contact) => (
                <tr key={contact.id}>
                  <td data-label="선택">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(contact.id)}
                      onChange={() =>
                        setSelectedIds((prev) =>
                          prev.includes(contact.id)
                            ? prev.filter((id) => id !== contact.id)
                            : [...prev, contact.id],
                        )
                      }
                    />
                  </td>
                  <td data-label="이름" title={contact.name}>
                    {contact.name}
                  </td>
                  <td
                    className={styles.desktopCol}
                    data-label="닉네임"
                    title={contact.nickname ?? ""}
                  >
                    {contact.nickname ?? "-"}
                  </td>
                  <td data-label="연락처" title={contact.phone}>
                    {formatPhone(contact.phone)}
                  </td>
                  <td className={styles.desktopCol} data-label="연동 상태">
                    {contact.google_sync_status}
                  </td>
                  <td className={styles.desktopCol} data-label="수신거부">
                    {contact.sms_opt_out ? "수신거부" : "수신 가능"}
                  </td>
                  <td data-label="관리">
                    <button
                      type="button"
                      className={`${styles.btn} ${styles.btnDanger}`}
                      onClick={() => removeOne(contact.id)}
                    >
                      제거
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className={styles.paginationBar}>
        <div>
          {pagination.page}/{pagination.totalPages} 페이지 · 표시{" "}
          {pagination.total.toLocaleString()}명
        </div>
        <div className={styles.paginationControls}>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnSecondary}`}
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            이전
          </button>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnSecondary}`}
            disabled={page >= pagination.totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            다음
          </button>
        </div>
      </div>
    </>
  )
}
