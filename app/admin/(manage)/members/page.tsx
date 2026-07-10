"use client"

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import styles from "../../admin.module.css"

type PlanTypeOption = {
  id: number
  name: string
  code: string
  is_active: boolean
}

type Member = {
  id: number
  name: string
  nickname: string | null
  phone: string | null
  plan_type_id: number | null
  plan_type: string | null
  plan_name: string | null
  expires_at: string | null
  memo: string | null
  is_active: boolean
  remaining_label: string
  remaining_status: "normal" | "warning" | "expired"
}

type MemberForm = {
  name: string
  nickname: string
  phone: string
  plan_type_id: string
  expires_at: string
  memo: string
  is_active: boolean
}

const EMPTY_FORM: MemberForm = {
  name: "",
  nickname: "",
  phone: "",
  plan_type_id: "",
  expires_at: "",
  memo: "",
  is_active: true,
}

function remainingClass(status: Member["remaining_status"]): string {
  if (status === "warning") return styles.statusWarning
  if (status === "expired") return styles.statusExpired
  return styles.statusNormal
}

export default function AdminMembersPage() {
  const [members, setMembers] = useState<Member[]>([])
  const [planTypes, setPlanTypes] = useState<PlanTypeOption[]>([])
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState("all")
  const [form, setForm] = useState<MemberForm>(EMPTY_FORM)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  const loadPlanTypes = useCallback(async () => {
    const res = await fetch("/api/admin/plan-types?activeOnly=true")
    const json = (await res.json()) as { data?: PlanTypeOption[] }
    setPlanTypes(json.data ?? [])
  }, [])

  const loadMembers = useCallback(async () => {
    const params = new URLSearchParams()
    if (search.trim()) params.set("search", search.trim())
    if (filter !== "all") params.set("filter", filter)

    const res = await fetch(`/api/admin/members?${params.toString()}`)
    const json = (await res.json()) as { data?: Member[] }
    setMembers(json.data ?? [])
  }, [search, filter])

  useEffect(() => {
    loadPlanTypes()
  }, [loadPlanTypes])

  useEffect(() => {
    loadMembers()
  }, [loadMembers])

  const [allPlanTypes, setAllPlanTypes] = useState<PlanTypeOption[]>([])

  useEffect(() => {
    fetch("/api/admin/plan-types")
      .then((res) => res.json())
      .then((json: { data?: PlanTypeOption[] }) => setAllPlanTypes(json.data ?? []))
  }, [])

  const selectablePlanTypes = useMemo(() => {
    const activePlans = planTypes
    if (!editingId || !form.plan_type_id) return activePlans

    const currentId = Number(form.plan_type_id)
    const hasCurrent = activePlans.some((plan) => plan.id === currentId)
    if (hasCurrent) return activePlans

    const currentMember = members.find((member) => member.id === editingId)
    if (!currentMember?.plan_type_id || !currentMember.plan_name) return activePlans

    return [
      ...activePlans,
      {
        id: currentMember.plan_type_id,
        name: `${currentMember.plan_name} (비활성)`,
        code: currentMember.plan_type ?? "",
        is_active: false,
      },
    ]
  }, [planTypes, editingId, form.plan_type_id, members])

  function openCreateModal() {
    setEditingId(null)
    setForm({
      ...EMPTY_FORM,
      plan_type_id: planTypes[0] ? String(planTypes[0].id) : "",
    })
    setShowModal(true)
    setMessage("")
    setError("")
  }

  function openEditModal(member: Member) {
    setEditingId(member.id)
    setForm({
      name: member.name,
      nickname: member.nickname ?? "",
      phone: member.phone ?? "",
      plan_type_id: member.plan_type_id ? String(member.plan_type_id) : "",
      expires_at: member.expires_at ?? "",
      memo: member.memo ?? "",
      is_active: member.is_active,
    })
    setShowModal(true)
    setMessage("")
    setError("")
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setMessage("")
    setError("")

    if (!form.plan_type_id) {
      setError("요금제를 선택해 주세요.")
      return
    }

    const payload = {
      ...(editingId ? { id: editingId } : {}),
      name: form.name,
      nickname: form.nickname || null,
      phone: form.phone || null,
      plan_type_id: Number(form.plan_type_id),
      expires_at: form.expires_at || null,
      memo: form.memo || null,
      is_active: form.is_active,
    }

    try {
      const res = await fetch("/api/admin/members", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const json = (await res.json()) as { success?: boolean; error?: string }

      if (!res.ok || !json.success) {
        setError(json.error ?? "저장에 실패했습니다.")
        return
      }

      setShowModal(false)
      setMessage(editingId ? "회원 정보가 수정되었습니다." : "회원이 등록되었습니다.")
      await loadMembers()
    } catch {
      setError("저장 중 오류가 발생했습니다.")
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm("이 회원을 비활성 처리하시겠습니까?")) return

    const res = await fetch(`/api/admin/members?id=${id}`, { method: "DELETE" })
    const json = (await res.json()) as { success?: boolean; error?: string }

    if (!res.ok || !json.success) {
      setError(json.error ?? "삭제에 실패했습니다.")
      return
    }

    setMessage("회원이 비활성 처리되었습니다.")
    await loadMembers()
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
          회원관리
        </h2>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnPrimary}`}
          onClick={openCreateModal}
        >
          회원 등록
        </button>
      </div>

      {message ? (
        <div className={`${styles.message} ${styles.messageSuccess}`}>{message}</div>
      ) : null}
      {error ? (
        <div className={`${styles.message} ${styles.messageError}`}>{error}</div>
      ) : null}

      <div className={styles.filterRow}>
        <input
          className={styles.formInput}
          style={{ maxWidth: 240 }}
          placeholder="이름 / 닉네임 / 연락처 검색"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className={styles.formSelect}
          style={{ maxWidth: 180 }}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="all">전체</option>
          <option value="active">활성</option>
          <option value="expired">만료</option>
          {allPlanTypes.map((plan) => (
            <option key={plan.id} value={String(plan.id)}>
              {plan.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnSecondary}`}
          onClick={loadMembers}
        >
          검색
        </button>
      </div>

      <div className={`${styles.panel} ${styles.tableWrap}`}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>이름</th>
              <th>닉네임</th>
              <th>연락처</th>
              <th>요금제</th>
              <th>만기일</th>
              <th>남은일수</th>
              <th>상태</th>
              <th>관리</th>
            </tr>
          </thead>
          <tbody>
            {members.length === 0 ? (
              <tr>
                <td colSpan={8}>등록된 회원이 없습니다.</td>
              </tr>
            ) : (
              members.map((member) => (
                <tr key={member.id}>
                  <td>{member.name}</td>
                  <td>{member.nickname ?? "-"}</td>
                  <td>{member.phone ?? "-"}</td>
                  <td>{member.plan_name ?? member.plan_type ?? "-"}</td>
                  <td>{member.expires_at ?? "-"}</td>
                  <td className={remainingClass(member.remaining_status)}>
                    {member.remaining_label}
                  </td>
                  <td>
                    <span
                      className={`${styles.badge} ${
                        member.is_active ? styles.badgeActive : styles.badgeInactive
                      }`}
                    >
                      {member.is_active ? "활성" : "비활성"}
                    </span>
                  </td>
                  <td>
                    <div className={styles.buttonRow}>
                      <button
                        type="button"
                        className={`${styles.btn} ${styles.btnSecondary}`}
                        onClick={() => openEditModal(member)}
                      >
                        수정
                      </button>
                      <button
                        type="button"
                        className={`${styles.btn} ${styles.btnDanger}`}
                        onClick={() => handleDelete(member.id)}
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
              {editingId ? "회원 수정" : "회원 등록"}
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
                <label className={styles.formLabel}>닉네임</label>
                <input
                  className={styles.formInput}
                  value={form.nickname}
                  onChange={(e) => setForm({ ...form, nickname: e.target.value })}
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>연락처</label>
                <input
                  className={styles.formInput}
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>요금제</label>
                <select
                  className={styles.formSelect}
                  value={form.plan_type_id}
                  onChange={(e) =>
                    setForm({ ...form, plan_type_id: e.target.value })
                  }
                  required
                >
                  <option value="">요금제 선택</option>
                  {selectablePlanTypes.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>만기일</label>
                <input
                  type="date"
                  className={styles.formInput}
                  value={form.expires_at}
                  onChange={(e) => setForm({ ...form, expires_at: e.target.value })}
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>메모</label>
                <textarea
                  className={styles.formTextarea}
                  value={form.memo}
                  onChange={(e) => setForm({ ...form, memo: e.target.value })}
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
