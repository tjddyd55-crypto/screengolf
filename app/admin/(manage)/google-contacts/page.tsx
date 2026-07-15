"use client"

import { FormEvent, Suspense, useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import styles from "../../admin.module.css"

type GoogleStatus = {
  connected: boolean
  accountEmail: string | null
  groupName: string | null
  connectedAt: string | null
  lastSyncedAt: string | null
  lastSyncStatus: string | null
  lastSyncMessage: string | null
}

type Contact = {
  id: number
  name: string
  nickname: string | null
  phone: string
  google_sync_status: string
  sms_opt_out: boolean
  is_active: boolean
  memo: string | null
  last_synced_at: string | null
}

type SyncSummary = {
  created: number
  updated: number
  unchanged: number
  skipped: number
  conflicts: number
  removedFromGroup: number
  googleContactCount?: number
  message?: string
}

type Pagination = {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

const GOOGLE_ERROR_MESSAGES: Record<string, string> = {
  config_missing: "Google 연락처 환경변수가 설정되지 않았습니다.",
  connect_failed: "Google 연결을 시작하지 못했습니다.",
  oauth_denied: "Google 계정 연결이 취소되었습니다.",
  oauth_invalid: "OAuth 응답이 올바르지 않습니다.",
  state_mismatch: "보안 검증(state)에 실패했습니다. 다시 연결해 주세요.",
  refresh_token_missing:
    "refresh token을 받지 못했습니다. Google 계정에서 앱 권한을 해제한 뒤 다시 연결해 주세요.",
  callback_failed: "Google 연결 처리에 실패했습니다.",
}

function syncStatusLabel(status: string): string {
  if (status === "linked") return "정상 연동"
  if (status === "not_in_group") return "라벨 제외"
  if (status === "conflict") return "충돌"
  return status
}

function formatPhoneDisplay(phone: string): string {
  const digits = phone.replace(/\D/g, "")
  if (digits.length === 11 && digits.startsWith("010")) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
  }
  if (digits.length === 10 && digits.startsWith("01")) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  return phone || "-"
}

function formatSyncedAt(value: string | null): string {
  if (!value) return "-"
  const match = value.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/)
  if (match) return `${match[1]} ${match[2]}`
  return value.slice(0, 16).replace("T", " ")
}

function GoogleContactsPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [googleStatus, setGoogleStatus] = useState<GoogleStatus | null>(null)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    pageSize: 50,
    total: 0,
    totalPages: 1,
  })
  const [search, setSearch] = useState("")
  const [appliedSearch, setAppliedSearch] = useState("")
  const [filter, setFilter] = useState("all")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [syncing, setSyncing] = useState(false)
  const [syncSummary, setSyncSummary] = useState<SyncSummary | null>(null)
  const [editing, setEditing] = useState<Contact | null>(null)
  const [editForm, setEditForm] = useState({
    nickname: "",
    memo: "",
    sms_opt_out: false,
    is_active: true,
  })

  const loadGoogleStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/google-contacts/status")
      const json = (await res.json()) as GoogleStatus & { success?: boolean }
      if (json.success === false) return
      setGoogleStatus({
        connected: Boolean(json.connected),
        accountEmail: json.accountEmail ?? null,
        groupName: json.groupName ?? null,
        connectedAt: json.connectedAt ?? null,
        lastSyncedAt: json.lastSyncedAt ?? null,
        lastSyncStatus: json.lastSyncStatus ?? null,
        lastSyncMessage: json.lastSyncMessage ?? null,
      })
    } catch {
      // ignore
    }
  }, [])

  const loadContacts = useCallback(async () => {
    const params = new URLSearchParams()
    if (appliedSearch.trim()) params.set("query", appliedSearch.trim())
    if (filter !== "all") params.set("status", filter)
    params.set("page", String(page))
    params.set("pageSize", String(pageSize))
    const res = await fetch(
      `/api/admin/google-contacts/list?${params.toString()}`,
    )
    const json = (await res.json()) as {
      data?: Contact[]
      pagination?: Pagination
    }
    setContacts(json.data ?? [])
    if (json.pagination) setPagination(json.pagination)
    setSelectedIds([])
  }, [appliedSearch, filter, page, pageSize])

  useEffect(() => {
    loadGoogleStatus()
  }, [loadGoogleStatus])

  useEffect(() => {
    loadContacts()
  }, [loadContacts])

  useEffect(() => {
    const connected = searchParams.get("googleConnected")
    const googleError = searchParams.get("googleError")
    if (connected === "1") {
      setMessage("Google 연락처가 연결되었습니다.")
      loadGoogleStatus()
    }
    if (googleError) {
      setError(
        GOOGLE_ERROR_MESSAGES[googleError] ??
          "Google 연결 중 오류가 발생했습니다.",
      )
    }
  }, [searchParams, loadGoogleStatus])

  const pageIds = useMemo(() => contacts.map((c) => c.id), [contacts])
  const allPageSelected =
    pageIds.length > 0 && pageIds.every((id) => selectedIds.includes(id))

  function toggleSelectAllPage() {
    if (allPageSelected) {
      setSelectedIds((prev) => prev.filter((id) => !pageIds.includes(id)))
      return
    }
    setSelectedIds((prev) => [...new Set([...prev, ...pageIds])])
  }

  function toggleSelect(id: number) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    )
  }

  async function createDraftAndCompose(input: {
    type: "selected" | "filtered_all"
    contactIds?: number[]
  }) {
    setError("")
    const res = await fetch("/api/admin/store-sms/drafts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        input.type === "selected"
          ? { type: "selected", contactIds: input.contactIds }
          : {
              type: "filtered_all",
              filter: {
                query: appliedSearch.trim() || undefined,
                status: filter,
              },
            },
      ),
    })
    const json = (await res.json()) as {
      success?: boolean
      draftId?: number
      error?: string
    }
    if (!res.ok || !json.success || !json.draftId) {
      setError(json.error ?? "문자 작성 화면으로 이동하지 못했습니다.")
      return
    }
    router.push(`/admin/sms/compose?draftId=${json.draftId}`)
  }

  async function handleSync() {
    setSyncing(true)
    setError("")
    setMessage("")
    setSyncSummary(null)
    try {
      const res = await fetch("/api/admin/google-contacts/sync", {
        method: "POST",
      })
      const json = (await res.json()) as SyncSummary & {
        success?: boolean
        error?: string
      }
      if (!res.ok || !json.success) {
        setError(json.error ?? "동기화에 실패했습니다.")
        return
      }
      setSyncSummary({
        created: json.created,
        updated: json.updated,
        unchanged: json.unchanged,
        skipped: json.skipped,
        conflicts: json.conflicts,
        removedFromGroup: json.removedFromGroup,
        googleContactCount: json.googleContactCount,
        message: json.message,
      })
      setMessage(json.message ?? "동기화가 완료되었습니다.")
      await Promise.all([loadContacts(), loadGoogleStatus()])
    } catch {
      setError("동기화 중 오류가 발생했습니다.")
    } finally {
      setSyncing(false)
    }
  }

  async function handleDisconnect() {
    if (!window.confirm("Google 연락처 연결을 해제하시겠습니까?")) return
    setError("")
    try {
      const res = await fetch("/api/admin/google-contacts/disconnect", {
        method: "POST",
      })
      const json = (await res.json()) as { success?: boolean; error?: string }
      if (!res.ok || !json.success) {
        setError(json.error ?? "연결 해제에 실패했습니다.")
        return
      }
      setMessage("Google 연락처 연결이 해제되었습니다.")
      setSyncSummary(null)
      await loadGoogleStatus()
    } catch {
      setError("연결 해제 중 오류가 발생했습니다.")
    }
  }

  function openEdit(contact: Contact) {
    setEditing(contact)
    setEditForm({
      nickname: contact.nickname ?? "",
      memo: contact.memo ?? "",
      sms_opt_out: contact.sms_opt_out,
      is_active: contact.is_active,
    })
  }

  async function handleEditSubmit(event: FormEvent) {
    event.preventDefault()
    if (!editing) return
    setError("")
    try {
      const res = await fetch(`/api/admin/google-contacts/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nickname: editForm.nickname || null,
          memo: editForm.memo || null,
          sms_opt_out: editForm.sms_opt_out,
          is_active: editForm.is_active,
        }),
      })
      const json = (await res.json()) as { success?: boolean; error?: string }
      if (!res.ok || !json.success) {
        setError(json.error ?? "수정에 실패했습니다.")
        return
      }
      setEditing(null)
      setMessage("연락처가 수정되었습니다.")
      await loadContacts()
    } catch {
      setError("수정 중 오류가 발생했습니다.")
    }
  }

  async function handleDeactivate(id: number) {
    if (!window.confirm("이 연락처를 비활성 처리하시겠습니까?")) return
    const res = await fetch(`/api/admin/google-contacts/${id}`, {
      method: "DELETE",
    })
    const json = (await res.json()) as { success?: boolean; error?: string }
    if (!res.ok || !json.success) {
      setError(json.error ?? "비활성 처리에 실패했습니다.")
      return
    }
    setMessage("연락처가 비활성 처리되었습니다.")
    await loadContacts()
  }

  const labelHint = googleStatus?.groupName
    ? `'${googleStatus.groupName}'`
    : "설정된"

  return (
    <>
      <Link href="/admin" className={styles.backLink}>
        ← 관리자 홈
      </Link>
      <div className={styles.pageHeader}>
        <div>
          <h2 className={styles.pageTitle}>고객 연락처</h2>
          <p className={styles.googleMeta} style={{ marginTop: 8 }}>
            Google 연락처의 {labelHint} 라벨에 포함된 고객을 동기화합니다.
          </p>
        </div>
      </div>

      <div className={`${styles.panel} ${styles.googlePanel}`}>
        <h3 className={styles.googlePanelTitle}>Google 연락처 연동</h3>
        {!googleStatus?.connected ? (
          <>
            <p className={styles.googleMeta}>
              Google 연락처의 {labelHint} 라벨 고객을 불러옵니다.
            </p>
            <div className={styles.googleActions}>
              <a
                href="/api/admin/google-contacts/connect"
                className={`${styles.btn} ${styles.btnPrimary}`}
              >
                Google 계정 연결
              </a>
            </div>
          </>
        ) : (
          <>
            <p className={styles.googleMeta}>
              연결 계정: {googleStatus.accountEmail ?? "-"}
            </p>
            <p className={styles.googleMeta}>
              대상 라벨: {googleStatus.groupName ?? "-"}
            </p>
            <p className={styles.googleMeta}>
              마지막 동기화: {googleStatus.lastSyncedAt ?? "없음"}
            </p>
            <p className={styles.googleMeta}>
              마지막 결과:{" "}
              {googleStatus.lastSyncMessage ??
                googleStatus.lastSyncStatus ??
                "-"}
            </p>
            <div className={styles.googleActions}>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnPrimary}`}
                disabled={syncing}
                onClick={handleSync}
              >
                {syncing ? "동기화 중..." : "지금 동기화"}
              </button>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnDanger}`}
                onClick={handleDisconnect}
              >
                연결 해제
              </button>
            </div>
            {syncSummary ? (
              <div className={styles.syncResultRow}>
                <span>전체 {syncSummary.googleContactCount ?? "-"}</span>
                <span>신규 {syncSummary.created}</span>
                <span>수정 {syncSummary.updated}</span>
                <span>변경 없음 {syncSummary.unchanged}</span>
                <span>제외 {syncSummary.skipped}</span>
                <span>충돌 {syncSummary.conflicts}</span>
                <span>그룹 제외 표시 {syncSummary.removedFromGroup}</span>
              </div>
            ) : null}
          </>
        )}
      </div>

      {message ? (
        <div className={`${styles.message} ${styles.messageSuccess}`}>
          {message}
        </div>
      ) : null}
      {error ? (
        <div className={`${styles.message} ${styles.messageError}`}>{error}</div>
      ) : null}

      <div className={styles.contactsToolbar}>
        <div className={styles.contactsToolbarLeft}>
          <input
            className={`${styles.formInput} ${styles.filterInput}`}
            placeholder="이름 / 닉네임 / 연락처 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className={`${styles.formSelect} ${styles.filterSelect}`}
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value)
              setPage(1)
            }}
          >
            <option value="all">전체</option>
            <option value="linked">정상 연동</option>
            <option value="not_in_group">라벨 제외</option>
            <option value="conflict">충돌</option>
            <option value="missing_phone">연락처 없음</option>
            <option value="sms_opt_out">문자 수신거부</option>
          </select>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnSecondary}`}
            onClick={() => {
              setAppliedSearch(search)
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
            disabled={selectedIds.length === 0}
            onClick={() =>
              createDraftAndCompose({
                type: "selected",
                contactIds: selectedIds,
              })
            }
          >
            선택 문자 작성 ({selectedIds.length})
          </button>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnSecondary}`}
            onClick={() => createDraftAndCompose({ type: "filtered_all" })}
          >
            검색 결과 전체 문자 작성
          </button>
        </div>
      </div>

      <div className={`${styles.panel} ${styles.tableWrap}`}>
        <table className={`${styles.table} ${styles.contactsTable}`}>
          <colgroup>
            <col className={styles.colCheck} />
            <col className={styles.colName} />
            <col className={styles.colNickname} />
            <col className={styles.colPhone} />
            <col className={styles.colStatus} />
            <col className={styles.colSynced} />
            <col className={styles.colOptOut} />
            <col className={styles.colActions} />
          </colgroup>
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  checked={allPageSelected}
                  onChange={toggleSelectAllPage}
                  aria-label="현재 페이지 전체 선택"
                />
              </th>
              <th>이름</th>
              <th>닉네임</th>
              <th>연락처</th>
              <th>Google 연동 상태</th>
              <th>마지막 동기화</th>
              <th>문자 수신거부</th>
              <th>관리</th>
            </tr>
          </thead>
          <tbody>
            {contacts.length === 0 ? (
              <tr>
                <td colSpan={8}>동기화된 연락처가 없습니다.</td>
              </tr>
            ) : (
              contacts.map((contact) => (
                <tr key={contact.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(contact.id)}
                      onChange={() => toggleSelect(contact.id)}
                      aria-label={`${contact.name} 선택`}
                    />
                  </td>
                  <td title={contact.name}>
                    {contact.name}
                    {!contact.is_active ? (
                      <>
                        {" "}
                        <span
                          className={`${styles.badge} ${styles.badgeInactive}`}
                        >
                          비활성
                        </span>
                      </>
                    ) : null}
                  </td>
                  <td title={contact.nickname ?? ""}>
                    {contact.nickname ?? "-"}
                  </td>
                  <td title={contact.phone}>
                    {formatPhoneDisplay(contact.phone)}
                  </td>
                  <td>{syncStatusLabel(contact.google_sync_status)}</td>
                  <td title={contact.last_synced_at ?? ""}>
                    {formatSyncedAt(contact.last_synced_at)}
                  </td>
                  <td>{contact.sms_opt_out ? "수신거부" : "수신 가능"}</td>
                  <td>
                    <div className={styles.rowActions}>
                      <button
                        type="button"
                        className={`${styles.btn} ${styles.btnSecondary}`}
                        onClick={() => openEdit(contact)}
                      >
                        수정
                      </button>
                      {contact.is_active ? (
                        <button
                          type="button"
                          className={`${styles.btn} ${styles.btnDanger}`}
                          onClick={() => handleDeactivate(contact.id)}
                        >
                          비활성
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className={styles.paginationBar}>
        <div>
          총 {pagination.total.toLocaleString()}명 · {pagination.page}/
          {pagination.totalPages} 페이지
        </div>
        <div className={styles.paginationControls}>
          <select
            className={`${styles.formSelect} ${styles.filterSelect}`}
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value))
              setPage(1)
            }}
          >
            <option value={30}>30명</option>
            <option value={50}>50명</option>
            <option value={100}>100명</option>
          </select>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnSecondary}`}
            disabled={pagination.page <= 1}
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
          >
            이전
          </button>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnSecondary}`}
            disabled={pagination.page >= pagination.totalPages}
            onClick={() =>
              setPage((prev) => Math.min(pagination.totalPages, prev + 1))
            }
          >
            다음
          </button>
        </div>
      </div>

      {editing ? (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h3 className={styles.modalTitle}>연락처 수정 · {editing.name}</h3>
            <p className={styles.formHint}>
              이름·연락처는 다음 Google 동기화에서 다시 갱신될 수 있습니다.
              닉네임·메모·수신거부·활성 상태만 관리자에서 유지됩니다.
            </p>
            <form onSubmit={handleEditSubmit}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>닉네임</label>
                <input
                  className={styles.formInput}
                  value={editForm.nickname}
                  onChange={(e) =>
                    setEditForm({ ...editForm, nickname: e.target.value })
                  }
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>메모</label>
                <textarea
                  className={styles.formTextarea}
                  value={editForm.memo}
                  onChange={(e) =>
                    setEditForm({ ...editForm, memo: e.target.value })
                  }
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.radioLabel}>
                  <input
                    type="checkbox"
                    checked={editForm.sms_opt_out}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        sms_opt_out: e.target.checked,
                      })
                    }
                  />
                  문자 수신거부
                </label>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.radioLabel}>
                  <input
                    type="checkbox"
                    checked={editForm.is_active}
                    onChange={(e) =>
                      setEditForm({ ...editForm, is_active: e.target.checked })
                    }
                  />
                  활성
                </label>
              </div>
              <div className={styles.buttonRow}>
                <button
                  type="submit"
                  className={`${styles.btn} ${styles.btnPrimary}`}
                >
                  저장
                </button>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnSecondary}`}
                  onClick={() => setEditing(null)}
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

export default function AdminGoogleContactsPage() {
  return (
    <Suspense fallback={<p>불러오는 중...</p>}>
      <GoogleContactsPageInner />
    </Suspense>
  )
}
