"use client"

import { FormEvent, useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import styles from "../../admin.module.css"
import { isProtectedDisplayUnitCode } from "@/lib/display/protected-units"
import {
  formatCurrentAppliedSceneLabel,
  formatSettingsUpdatedAt,
  getDisplayModeLabel,
} from "@/lib/display/current-applied"
import { MonitorIcon } from "../../AdminIcons"
import type { DisplayMode } from "@/lib/admin/constants"

type DisplayUnit = {
  id: number
  name: string
  code: string
  sort_order: number
  is_active: boolean
  current_mode?: DisplayMode | string
  current_scene?: { id: number; name: string } | null
  settings_updated_at?: string | null
}

type UnitForm = {
  name: string
  sort_order: string
  is_active: boolean
}

function storeUrl(code: string): string {
  if (code === "display-1") return "/store/monthly-ranking-display"
  if (code === "display-2") return "/store/monthly-ranking-display-2"
  return `/store/display/${encodeURIComponent(code)}`
}

function modeLabel(mode?: string): string {
  return getDisplayModeLabel(mode)
}

export default function AdminDisplayUnitsPage() {
  const router = useRouter()
  const [units, setUnits] = useState<DisplayUnit[]>([])
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [editing, setEditing] = useState<DisplayUnit | null>(null)
  const [deleting, setDeleting] = useState<DisplayUnit | null>(null)
  const [deletingBusy, setDeletingBusy] = useState(false)
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

  async function handleDeleteConfirm() {
    if (!deleting || deletingBusy) return
    const target = deleting
    setDeletingBusy(true)
    setError("")
    try {
      const res = await fetch(`/api/admin/display-units/${target.code}`, {
        method: "DELETE",
      })
      const json = (await res.json()) as {
        success?: boolean
        error?: string
        data?: { name?: string; code?: string }
      }
      if (!res.ok || !json.success) {
        setError(json.error ?? "전광판 삭제에 실패했습니다.")
        return
      }
      setUnits((prev) => prev.filter((unit) => unit.code !== target.code))
      setMessage(`${target.name}을 삭제했습니다.`)
      setDeleting(null)
    } catch {
      setError("전광판 삭제 중 오류가 발생했습니다.")
    } finally {
      setDeletingBusy(false)
    }
  }

  function renderUnitCard(unit: DisplayUnit) {
    const protectedUnit = isProtectedDisplayUnitCode(unit.code)
    const sceneLabel = formatCurrentAppliedSceneLabel({
      sceneName: unit.current_scene?.name,
      modeLabel: modeLabel(unit.current_mode),
    })
    const currentMode = modeLabel(unit.current_mode)
    const updatedLabel = formatSettingsUpdatedAt(unit.settings_updated_at)
    const isRemoving = deletingBusy && deleting?.code === unit.code

    return (
      <article
        key={unit.id}
        className={`${styles.unitCard} ${styles.cardApplied} ${
          isRemoving ? styles.unitCardRemoving : ""
        }`}
      >
        <div className={styles.unitCardTop}>
          <div className={styles.unitTitleRow}>
            <span className={styles.unitTitleIcon}>
              <MonitorIcon size={18} />
            </span>
            <h3 className={styles.unitCardTitle}>{unit.name}</h3>
          </div>
          <div className={styles.buttonRow} style={{ gap: 6, flexWrap: "wrap" }}>
            {protectedUnit ? (
              <span className={`${styles.badge} ${styles.badgeInactive}`}>
                기본
              </span>
            ) : null}
            <span
              className={`${styles.badge} ${
                unit.is_active ? styles.badgeActive : styles.badgeInactive
              }`}
            >
              {unit.is_active ? "사용 중" : "비활성"}
            </span>
          </div>
        </div>
        <p className={styles.liveStatus}>
          <span className={styles.liveStatusDot} aria-hidden="true" />
          현재 송출 중
        </p>
        <p className={styles.unitCardCode}>{unit.code}</p>
        <p className={styles.appliedLabel}>현재 적용 화면</p>
        <p className={styles.appliedSceneName}>{sceneLabel}</p>
        <p className={styles.appliedModeLine}>{currentMode}</p>
        {updatedLabel ? (
          <p className={styles.appliedMetaLine}>마지막 변경 {updatedLabel}</p>
        ) : null}
        <div
          className={`${styles.unitCardActions} ${
            protectedUnit ? styles.unitCardActionsWide : ""
          }`}
        >
          <Link
            href={`/admin/display/${unit.code}`}
            className={`${styles.btn} ${styles.btnSecondary}`}
            aria-disabled={isRemoving}
            tabIndex={isRemoving ? -1 : undefined}
          >
            설정
          </Link>
          <Link
            href={`/admin/display-scenes/${unit.code}`}
            className={`${styles.btn} ${styles.btnPrimary}`}
            aria-disabled={isRemoving}
            tabIndex={isRemoving ? -1 : undefined}
          >
            Scene 관리
          </Link>
          <Link
            href={storeUrl(unit.code)}
            target="_blank"
            className={`${styles.btn} ${styles.btnSecondary}`}
            aria-disabled={isRemoving}
            tabIndex={isRemoving ? -1 : undefined}
          >
            보기
          </Link>
          {protectedUnit ? null : (
            <button
              type="button"
              className={`${styles.btn} ${styles.btnDangerOutline}`}
              disabled={isRemoving}
              onClick={() => {
                setDeleting(unit)
                setError("")
              }}
            >
              {isRemoving ? "삭제 중..." : "삭제"}
            </button>
          )}
        </div>
        {protectedUnit ? (
          <p className={styles.formHint} style={{ marginTop: 10 }}>
            기본 전광판은 삭제할 수 없습니다.
          </p>
        ) : null}
      </article>
    )
  }

  return (
    <>
      <Link href="/admin" className={`${styles.backLink} ${styles.desktopOnly}`}>
        ← 관리자 홈
      </Link>
      <div className={styles.pageHeaderCompact}>
        <div className={styles.pageTitleWithBack}>
          <Link
            href="/admin"
            className={`${styles.mobileBackBtn} ${styles.mobileOnly}`}
            aria-label="관리자 홈으로"
          >
            ←
          </Link>
          <h2 className={styles.pageTitleInline}>전광판 관리</h2>
        </div>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnPrimary} ${styles.btnCompact}`}
          onClick={handleCreate}
        >
          + 전광판 추가
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

      <div className={`${styles.panel} ${styles.tableWrap} ${styles.desktopOnly}`}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>이름</th>
              <th>코드</th>
              <th>정렬</th>
              <th>현재 적용 화면</th>
              <th>모드</th>
              <th>상태</th>
              <th>관리</th>
            </tr>
          </thead>
          <tbody>
            {units.length === 0 ? (
              <tr>
                <td colSpan={7}>등록된 전광판이 없습니다.</td>
              </tr>
            ) : (
              units.map((unit) => {
                const protectedUnit = isProtectedDisplayUnitCode(unit.code)
                const sceneLabel = formatCurrentAppliedSceneLabel({
                  sceneName: unit.current_scene?.name,
                  modeLabel: modeLabel(unit.current_mode),
                })
                const updatedLabel = formatSettingsUpdatedAt(
                  unit.settings_updated_at,
                )
                const isRemoving =
                  deletingBusy && deleting?.code === unit.code
                return (
                  <tr key={unit.id}>
                    <td>
                      <div className={styles.unitTitleRow}>
                        <span className={styles.unitTitleIcon}>
                          <MonitorIcon size={18} />
                        </span>
                        <strong>{unit.name}</strong>
                        {protectedUnit ? (
                          <span
                            className={`${styles.badge} ${styles.badgeInactive}`}
                          >
                            기본
                          </span>
                        ) : null}
                      </div>
                      <p className={styles.liveStatus} style={{ marginTop: 8 }}>
                        <span
                          className={styles.liveStatusDot}
                          aria-hidden="true"
                        />
                        현재 송출 중
                      </p>
                    </td>
                    <td>{unit.code}</td>
                    <td>{unit.sort_order}</td>
                    <td>
                      <div className={styles.appliedLabel}>현재 적용 화면</div>
                      <strong>{sceneLabel}</strong>
                      {updatedLabel ? (
                        <div className={styles.appliedMetaLine}>
                          마지막 변경 {updatedLabel}
                        </div>
                      ) : null}
                    </td>
                    <td>{modeLabel(unit.current_mode)}</td>
                    <td>
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
                    <td>
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
                          disabled={isRemoving}
                          onClick={() => openEdit(unit)}
                        >
                          수정
                        </button>
                        {protectedUnit ? (
                          <button
                            type="button"
                            className={`${styles.btn} ${styles.btnSecondary}`}
                            disabled
                            title="기본 전광판은 삭제할 수 없습니다."
                          >
                            삭제
                          </button>
                        ) : (
                          <button
                            type="button"
                            className={`${styles.btn} ${styles.btnDangerOutline}`}
                            disabled={isRemoving}
                            onClick={() => {
                              setDeleting(unit)
                              setError("")
                            }}
                          >
                            {isRemoving ? "삭제 중..." : "삭제"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <div className={`${styles.unitCardList} ${styles.mobileOnly}`}>
        {units.length === 0 ? (
          <div className={styles.panel}>등록된 전광판이 없습니다.</div>
        ) : (
          units.map((unit) => renderUnitCard(unit))
        )}
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
              {!isProtectedDisplayUnitCode(editing.code) ? (
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

      {deleting ? (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h3 className={styles.modalTitle}>전광판을 삭제할까요?</h3>
            <p className={styles.deleteConfirmBody}>
              ‘{deleting.name}’과 연결된 설정 및 Scene이 삭제됩니다.
            </p>
            <p className={styles.deleteConfirmBody}>
              업로드한 이미지와 공지사항은 삭제되지 않습니다.
            </p>
            <p className={styles.deleteConfirmWarn}>
              삭제한 전광판은 복구할 수 없습니다.
            </p>
            <div className={styles.buttonRow}>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnSecondary}`}
                disabled={deletingBusy}
                onClick={() => setDeleting(null)}
              >
                취소
              </button>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnDanger}`}
                disabled={deletingBusy}
                onClick={handleDeleteConfirm}
              >
                {deletingBusy ? "삭제 중..." : "삭제"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
