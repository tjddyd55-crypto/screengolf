"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import styles from "../../../admin.module.css"
import SmsSubNav from "../SmsSubNav"

type Group = {
  id: number
  name: string
  description: string | null
  member_count: number
  sendableEstimate: number
  updated_at: string
  is_active: boolean
}

export default function AdminSmsGroupsPage() {
  const router = useRouter()
  const [groups, setGroups] = useState<Group[]>([])
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  async function load() {
    const res = await fetch("/api/admin/store-sms/contact-groups")
    const json = await res.json()
    if (!json.success) {
      setError(json.error ?? "그룹 목록 조회 실패")
      return
    }
    setGroups(json.data ?? [])
  }

  useEffect(() => {
    load().catch(() => setError("그룹 목록 조회 실패"))
  }, [])

  async function addToCart(id: number, name: string, count: number) {
    if (
      !window.confirm(
        `현재 대상함에 그룹 "${name}" ${count}명을 추가할까요?\n기존 대상함은 유지되고 중복은 한 번만 담깁니다.`,
      )
    ) {
      return
    }
    const res = await fetch(
      `/api/admin/store-sms/contact-groups/${id}/add-to-cart`,
      { method: "POST" },
    )
    const json = await res.json()
    if (!json.success) {
      setError(json.error ?? "대상함 추가 실패")
      return
    }
    setMessage(
      `그룹 추가 완료 · 신규 ${json.added}명 · 대상함 총 ${json.total}명`,
    )
  }

  async function replaceCart(id: number, name: string, count: number) {
    if (
      !window.confirm(
        `현재 대상함을 비우고 그룹 "${name}" ${count}명으로 교체할까요?`,
      )
    ) {
      return
    }
    const res = await fetch(
      `/api/admin/store-sms/contact-groups/${id}/replace-cart`,
      { method: "POST" },
    )
    const json = await res.json()
    if (!json.success) {
      setError(json.error ?? "대상함 교체 실패")
      return
    }
    setMessage(`대상함을 그룹 ${json.total}명으로 교체했습니다.`)
  }

  async function composeFromGroup(id: number) {
    const add = await fetch(
      `/api/admin/store-sms/contact-groups/${id}/replace-cart`,
      { method: "POST" },
    )
    const addJson = await add.json()
    if (!add.ok || !addJson.success) {
      setError(addJson.error ?? "그룹 불러오기 실패")
      return
    }
    const draft = await fetch("/api/admin/store-sms/cart/to-draft", {
      method: "POST",
    })
    const draftJson = await draft.json()
    if (!draft.ok || !draftJson.draftId) {
      setError(draftJson.error ?? "문자 작성 이동 실패")
      return
    }
    router.push(`/admin/sms/compose?draftId=${draftJson.draftId}`)
  }

  async function deactivate(id: number) {
    if (!window.confirm("이 그룹을 비활성 처리할까요?")) return
    const res = await fetch(`/api/admin/store-sms/contact-groups/${id}`, {
      method: "DELETE",
    })
    const json = await res.json()
    if (!json.success) {
      setError(json.error ?? "비활성 실패")
      return
    }
    setMessage("그룹을 비활성 처리했습니다.")
    await load()
  }

  return (
    <>
      <Link href="/admin/sms" className={styles.backLink}>
        ← 문자 발송
      </Link>
      <SmsSubNav active="/admin/sms/groups" />
      <h2 className={styles.pageTitle}>문자 그룹</h2>
      <p className={styles.googleMeta}>
        Google 라벨과 별개인 관리자 전용 문자 대상 그룹입니다.
      </p>

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
              <th>그룹명</th>
              <th>설명</th>
              <th>저장 인원</th>
              <th>발송 가능 예상</th>
              <th>수정일</th>
              <th>관리</th>
            </tr>
          </thead>
          <tbody>
            {groups.length === 0 ? (
              <tr>
                <td colSpan={6}>저장된 그룹이 없습니다.</td>
              </tr>
            ) : (
              groups.map((group) => (
                <tr key={group.id}>
                  <td data-label="그룹명" title={group.name}>
                    {group.name}
                  </td>
                  <td
                    className={styles.desktopCol}
                    data-label="설명"
                    title={group.description ?? ""}
                  >
                    {group.description ?? "-"}
                  </td>
                  <td data-label="저장 인원">{group.member_count}</td>
                  <td data-label="발송 가능 예상">{group.sendableEstimate}</td>
                  <td className={styles.desktopCol} data-label="수정일">
                    {group.updated_at}
                  </td>
                  <td data-label="관리">
                    <div className={styles.rowActions}>
                      <button
                        type="button"
                        className={`${styles.btn} ${styles.btnSecondary}`}
                        onClick={() =>
                          addToCart(group.id, group.name, group.member_count)
                        }
                      >
                        대상함에 추가
                      </button>
                      <button
                        type="button"
                        className={`${styles.btn} ${styles.btnSecondary}`}
                        onClick={() =>
                          replaceCart(group.id, group.name, group.member_count)
                        }
                      >
                        대상함 교체
                      </button>
                      <button
                        type="button"
                        className={`${styles.btn} ${styles.btnPrimary}`}
                        onClick={() => composeFromGroup(group.id)}
                      >
                        문자 작성
                      </button>
                      <button
                        type="button"
                        className={`${styles.btn} ${styles.btnDanger}`}
                        onClick={() => deactivate(group.id)}
                      >
                        비활성
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
