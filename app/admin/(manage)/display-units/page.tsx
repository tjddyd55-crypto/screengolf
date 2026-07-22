"use client"

import { FormEvent, useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import styles from "../../admin.module.css"

type DisplayUnit = {
  id: number
  name: string
  code: string
  sort_order: number
  is_active: boolean
  current_mode?: string
  current_scene?: { id: number; name: string } | null
}

type UnitForm = {
  name: string
  sort_order: string
  is_active: boolean
}

export default function AdminDisplayUnitsPage() {
  const router = useRouter()
  const [units, setUnits] = useState<DisplayUnit[]>([])
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [editing, setEditing] = useState<DisplayUnit | null>(null)
  const [form, setForm] = useState<UnitForm>({
    name: "",
    sort_order: "",
    is_active: true,
  })

  const loadUnits = useCallback(async () => {
    const res = await fetch("/api/admin/display-units")
    const json = (await res.json()) as { data?: DisplayUnit[] }
    setUnits(json.data ?? [])
  }, [])

  useEffect(() => {
    loadUnits()
  }, [loadUnits])

  function openEdit(unit: DisplayUnit) {
    setEditing(unit)
    setForm({
      name: unit.name,
      sort_order: String(unit.sort_order),
      is_active: unit.is_active,
    })
    setMessage("")
    setError("")
  }

  async function handleCreate() {
    setError("")
    setMessage("")
    try {
      const res = await fetch("/api/admin/display-units", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      const json = (await res.json()) as {
        success?: boolean
        data?: DisplayUnit
        error?: string
      }
      if (!res.ok || !json.success || !json.data) {
        setError(json.error ?? "전광판 추가에 실패했습니다.")
        return
      }
      setMessage("전광판이 추가되었습니다.")
      router.push(`/admin/display-scenes/${json.data.code}`)
    } catch {
      setError("전광판 추가 중 오류가 발생했습니다.")
    }
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault()
    if (!editing) return

    setError("")
    setMessage("")
    try {
      const res = await fetch(`/api/admin/display-units/${editing.code}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          sort_order: form.sort_order ? Number(form.sort_order) : undefined,
          is_active: form.is_active,
        }),
      })
      const json = (await res.json()) as { success?: boolean; error?: string }
      if (!res.ok || !json.success) {
        setError(json.error ?? "수정에 실패했습니다.")
        return
      }
      setEditing(null)
      setMessage("전광판이 수정되었습니다.")
      await loadUnits()
    } catch {
      setError("수정 중 오류가 발생했습니다.")
    }
  }

  async function handleDeactivate(unit: DisplayUnit) {
    if (!window.confirm(`「${unit.name}」을(를) 비활성 처리하시겠습니까?`)) {
      return
    }

    setError("")
    const res = await fetch(`/api/admin/display-units/${unit.code}`, {
      method: "DELETE",
    })
    const json = (await res.json()) as { success?: boolean; error?: string }
    if (!res.ok || !json.success) {
      setError(json.error ?? "비활성 처리에 실패했습니다.")
      return
    }
    setMessage("전광판이 비활성 처리되었습니다.")
    await loadUnits()
  }

  return (
    <>
      <Link href="/admin" className={styles.backLink}>
        ← 관리자 홈
      </Link>
      <div className={styles.pageHeader}>
        <h2 className={styles.pageTitle}>전광판 관리</h2>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnPrimary}`}
          onClick={handleCreate}
        >
          전광판 추가
        </button>
      </div>

      {message ? (
        <div className={`${styles.message} ${styles.messageSuccess}`}>
          {message}
        </div>
      ) : null}
      {error ? (
        <div className={`${styles.message} ${styles.messageError}`}>{error}</div>
      ) : null}

      <div className={`${styles.panel} ${styles.tableWrap}`}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>이름</th>
              <th>코드</th>
              <th>정렬</th>
              <th>현재 화면</th>
              <th>상태</th>
              <th>관리</th>
            </tr>
          </thead>
          <tbody>
            {units.length === 0 ? (
              <tr>
                <td colSpan={6}>등록된 전광판이 없습니다.</td>
              </tr>
            ) : (
              units.map((unit) => (
                <tr key={unit.id}>
                  <td data-label="이름">{unit.name}</td>
                  <td className={styles.desktopCol} data-label="코드">
                    {unit.code}
                  </td>
                  <td className={styles.desktopCol} data-label="정렬">
                    {unit.sort_order}
                  </td>
                  <td data-label="현재 화면">
                    {unit.current_scene?.name ?? unit.current_mode ?? "-"}
                  </td>
                  <td data-label="상태">
                    <span
                      className={`${styles.badge} ${
                        unit.is_active
                          ? styles.badgeActive
                          : styles.badgeInactive
                      }`}
                    >
                      {unit.is_active ? "활성" : "비활성"}
                    </span>
                  </td>
                  <td data-label="관리">
                    <div className={styles.buttonRow}>
                      <Link
                        href={`/admin/display-scenes/${unit.code}`}
                        className={`${styles.btn} ${styles.btnPrimary}`}
                      >
                        Scene
                      </Link>
                      <Link
                        href={`/admin/display/${unit.code}`}
                        className={`${styles.btn} ${styles.btnSecondary}`}
                      >
                        설정
                      </Link>
                      <button
                        type="button"
                        className={`${styles.btn} ${styles.btnSecondary}`}
                        onClick={() => openEdit(unit)}
                      >
                        수정
                      </button>
                      {unit.code !== "display-1" && unit.is_active ? (
                        <button
                          type="button"
                          className={`${styles.btn} ${styles.btnDanger}`}
                          onClick={() => handleDeactivate(unit)}
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

      {editing ? (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h3 className={styles.modalTitle}>전광판 수정 · {editing.code}</h3>
            <form onSubmit={handleSave}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>이름</label>
                <input
                  className={styles.formInput}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>정렬 순서</label>
                <input
                  type="number"
                  className={`${styles.formInput} ${styles.sortOrderInput}`}
                  value={form.sort_order}
                  onChange={(e) =>
                    setForm({ ...form, sort_order: e.target.value })
                  }
                />
              </div>
              {editing.code !== "display-1" ? (
                <div className={styles.formGroup}>
                  <label className={styles.radioLabel}>
                    <input
                      type="checkbox"
                      checked={form.is_active}
                      onChange={(e) =>
                        setForm({ ...form, is_active: e.target.checked })
                      }
                    />
                    활성
                  </label>
                </div>
              ) : null}
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
