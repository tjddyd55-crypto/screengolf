"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import styles from "../admin.module.css"
import { type DisplayMode } from "@/lib/admin/constants"
import {
  formatCurrentAppliedSceneLabel,
  formatSettingsUpdatedAt,
  getDisplayModeLabel,
} from "@/lib/display/current-applied"
import { MonitorIcon } from "../AdminIcons"

type DisplayUnitCard = {
  id: number
  name: string
  code: string
  sort_order: number
  is_active: boolean
  current_mode: DisplayMode
  current_scene: { id: number; name: string } | null
  settings_updated_at?: string | null
}

function storeUrl(code: string): string {
  if (code === "display-1") return "/store/monthly-ranking-display"
  if (code === "display-2") return "/store/monthly-ranking-display-2"
  return `/store/display/${encodeURIComponent(code)}`
}

export default function AdminHomePage() {
  const router = useRouter()
  const [units, setUnits] = useState<DisplayUnitCard[]>([])
  const [error, setError] = useState("")
  const [creating, setCreating] = useState(false)

  const loadUnits = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/display-units")
      const json = (await res.json()) as {
        success?: boolean
        data?: DisplayUnitCard[]
        error?: string
      }
      if (!res.ok || !json.success) {
        setError(json.error ?? "전광판 목록을 불러오지 못했습니다.")
        return
      }
      setUnits(json.data ?? [])
      setError("")
    } catch {
      setError("전광판 목록을 불러오지 못했습니다.")
    }
  }, [])

  useEffect(() => {
    loadUnits()
  }, [loadUnits])

  async function handleCreateUnit() {
    setCreating(true)
    setError("")
    try {
      const res = await fetch("/api/admin/display-units", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      const json = (await res.json()) as {
        success?: boolean
        data?: { code: string }
        error?: string
      }
      if (!res.ok || !json.success || !json.data) {
        setError(json.error ?? "전광판 추가에 실패했습니다.")
        return
      }
      router.push(`/admin/display-scenes/${json.data.code}`)
    } catch {
      setError("전광판 추가 중 오류가 발생했습니다.")
    } finally {
      setCreating(false)
    }
  }

  return (
    <>
      <div className={styles.pageHeader}>
        <h2 className={styles.pageTitle} style={{ marginBottom: 0 }}>
          관리자 홈
        </h2>
        <div className={styles.buttonRow}>
          <Link
            href="/admin/display-units"
            className={`${styles.btn} ${styles.btnSecondary}`}
          >
            전광판 목록
          </Link>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnPrimary}`}
            disabled={creating}
            onClick={handleCreateUnit}
          >
            전광판 추가
          </button>
        </div>
      </div>

      {error ? (
        <div className={`${styles.message} ${styles.messageError}`}>{error}</div>
      ) : null}

      <h3 className={styles.sectionTitle}>전광판 관리</h3>
      <div className={styles.homeGrid}>
        {units.map((unit) => {
          const modeLabel = getDisplayModeLabel(unit.current_mode)
          const sceneLabel = formatCurrentAppliedSceneLabel({
            sceneName: unit.current_scene?.name,
            modeLabel,
          })
          const updatedLabel = formatSettingsUpdatedAt(
            unit.settings_updated_at,
          )
          return (
            <div
              key={unit.id}
              className={`${styles.card} ${styles.cardStatic} ${styles.cardApplied}`}
            >
              <div className={styles.cardHeader}>
                <div className={styles.unitTitleRow}>
                  <span className={styles.unitTitleIcon}>
                    <MonitorIcon size={20} />
                  </span>
                  <h3 className={styles.cardTitle}>{unit.name}</h3>
                </div>
              </div>
              <p className={styles.liveStatus}>
                <span className={styles.liveStatusDot} aria-hidden="true" />
                현재 송출 중
              </p>
              <p className={styles.appliedLabel}>현재 적용 화면</p>
              <p className={styles.appliedSceneName}>{sceneLabel}</p>
              <p className={styles.appliedModeLine}>{modeLabel}</p>
              {updatedLabel ? (
                <p className={styles.appliedMetaLine}>
                  마지막 변경 {updatedLabel}
                </p>
              ) : null}
              <p className={styles.cardMeta}>{unit.code}</p>
              <div className={styles.cardActions}>
                <Link
                  href={`/admin/display/${unit.code}`}
                  className={`${styles.btn} ${styles.btnPrimary}`}
                >
                  빠른 설정
                </Link>
                <Link
                  href={`/admin/display-scenes/${unit.code}`}
                  className={`${styles.btn} ${styles.btnSecondary}`}
                >
                  Scene 관리
                </Link>
                <Link
                  href={storeUrl(unit.code)}
                  target="_blank"
                  className={`${styles.btn} ${styles.btnSecondary}`}
                >
                  전광판 보기
                </Link>
              </div>
            </div>
          )
        })}
      </div>

      <h3 className={styles.sectionTitle}>매장 관리</h3>
      <div className={styles.homeGrid}>
        <Link href="/admin/notices" className={styles.card}>
          <h3 className={styles.cardTitle}>공지사항 관리</h3>
          <p className={styles.cardDesc}>
            전광판 공지사항을 등록·수정·삭제합니다. (전광판 공용)
          </p>
        </Link>
        <Link href="/admin/members" className={styles.card}>
          <h3 className={styles.cardTitle}>회원관리</h3>
          <p className={styles.cardDesc}>
            정액형 회원의 요금제·만기일을 관리합니다.
          </p>
        </Link>
        <Link href="/admin/google-contacts" className={styles.card}>
          <h3 className={styles.cardTitle}>고객 연락처</h3>
          <p className={styles.cardDesc}>
            Google 연락처(가자 스크린)를 연동·동기화합니다.
          </p>
        </Link>
        <Link href="/admin/sms" className={styles.card}>
          <h3 className={styles.cardTitle}>문자 발송</h3>
          <p className={styles.cardDesc}>
            고객 연락처를 선택해 즉시 또는 예약문자를 발송합니다.
          </p>
        </Link>
        <Link href="/admin/plan-types" className={styles.card}>
          <h3 className={styles.cardTitle}>요금제 관리</h3>
          <p className={styles.cardDesc}>회원 요금제 마스터를 등록·수정합니다.</p>
        </Link>
      </div>
    </>
  )
}
