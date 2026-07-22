"use client"

import { FormEvent, useCallback, useEffect, useState } from "react"
import Link from "next/link"
import styles from "../../admin.module.css"

type PlanType = {
  id: number
  name: string
  code: string
  sort_order: number
  is_active: boolean
}

type PlanTypeForm = {
  name: string
  code: string
  sort_order: string
  is_active: boolean
}

const EMPTY_FORM: PlanTypeForm = {
  name: "",
  code: "",
  sort_order: "",
  is_active: true,
}

export default function AdminPlanTypesPage() {
  const [planTypes, setPlanTypes] = useState<PlanType[]>([])
  const [form, setForm] = useState<PlanTypeForm>(EMPTY_FORM)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  const loadPlanTypes = useCallback(async () => {
    const res = await fetch("/api/admin/plan-types")
    const json = (await res.json()) as { data?: PlanType[] }
    setPlanTypes(json.data ?? [])
  }, [])

  useEffect(() => {
    loadPlanTypes()
  }, [loadPlanTypes])

  function openCreateModal() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setShowModal(true)
    setMessage("")
    setError("")
  }

  function openEditModal(planType: PlanType) {
    setEditingId(planType.id)
    setForm({
      name: planType.name,
      code: planType.code,
      sort_order: String(planType.sort_order),
      is_active: planType.is_active,
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
      if (editingId) {
        const res = await fetch(`/api/admin/plan-types/${editingId}`, {
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

        setMessage("요금제가 수정되었습니다.")
      } else {
        const res = await fetch("/api/admin/plan-types", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name,
            code: form.code,
            sort_order: form.sort_order ? Number(form.sort_order) : undefined,
            is_active: form.is_active,
          }),
        })
        const json = (await res.json()) as { success?: boolean; error?: string }

        if (!res.ok || !json.success) {
          setError(json.error ?? "등록에 실패했습니다.")
          return
        }

        setMessage("요금제가 등록되었습니다.")
      }

      setShowModal(false)
      await loadPlanTypes()
    } catch {
      setError("저장 중 오류가 발생했습니다.")
    }
  }

  async function handleDeactivate(id: number) {
    if (!window.confirm("이 요금제를 비활성 처리하시겠습니까?")) return

    const res = await fetch(`/api/admin/plan-types/${id}`, { method: "DELETE" })
    const json = (await res.json()) as { success?: boolean; error?: string }

    if (!res.ok || !json.success) {
      setError(json.error ?? "비활성 처리에 실패했습니다.")
      return
    }

    setMessage("요금제가 비활성 처리되었습니다.")
    await loadPlanTypes()
  }

  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <Link href="/admin" className={styles.btnLink}>
          ← 관리자 홈
        </Link>
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
        }}
      >
        <h2 className={styles.pageTitle} style={{ margin: 0 }}>
          요금제 관리
        </h2>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnPrimary}`}
          onClick={openCreateModal}
        >
          요금제 추가
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
              <th>이름</th>
              <th>코드</th>
              <th>정렬</th>
              <th>상태</th>
              <th>관리</th>
            </tr>
          </thead>
          <tbody>
            {planTypes.length === 0 ? (
              <tr>
                <td colSpan={5}>등록된 요금제가 없습니다.</td>
              </tr>
            ) : (
              planTypes.map((planType) => (
                <tr key={planType.id}>
                  <td data-label="이름">{planType.name}</td>
                  <td className={styles.desktopCol} data-label="코드">
                    {planType.code}
                  </td>
                  <td className={styles.desktopCol} data-label="정렬">
                    {planType.sort_order}
                  </td>
                  <td data-label="상태">
                    <span
                      className={`${styles.badge} ${
                        planType.is_active ? styles.badgeActive : styles.badgeInactive
                      }`}
                    >
                      {planType.is_active ? "활성" : "비활성"}
                    </span>
                  </td>
                  <td data-label="관리">
                    <div className={styles.buttonRow}>
                      <button
                        type="button"
                        className={`${styles.btn} ${styles.btnSecondary}`}
                        onClick={() => openEditModal(planType)}
                      >
                        수정
                      </button>
                      {planType.is_active ? (
                        <button
                          type="button"
                          className={`${styles.btn} ${styles.btnDanger}`}
                          onClick={() => handleDeactivate(planType.id)}
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

      {showModal ? (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h3 className={styles.modalTitle}>
              {editingId ? "요금제 수정" : "요금제 추가"}
            </h3>
            <form onSubmit={handleSubmit}>
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
                <label className={styles.formLabel}>코드</label>
                <input
                  className={styles.formInput}
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  placeholder="예: weekend_flat"
                  disabled={Boolean(editingId)}
                  required={!editingId}
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>정렬 순서</label>
                <input
                  type="number"
                  className={styles.formInput}
                  value={form.sort_order}
                  onChange={(e) => setForm({ ...form, sort_order: e.target.value })}
                  placeholder="비워두면 마지막 순서"
                />
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
