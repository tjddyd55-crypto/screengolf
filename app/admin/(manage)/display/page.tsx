"use client"

import { ChangeEvent, useCallback, useEffect, useState } from "react"
import Link from "next/link"
import styles from "../../admin.module.css"
import {
  DISPLAY_MODE_LABELS,
  type DisplayMode,
} from "@/lib/admin/constants"
import DisplayMediaRenderer from "@/components/display/DisplayMediaRenderer"

type DisplayAsset = {
  id: number
  title: string
  file_url: string
  file_type: "image" | "pdf"
  mime_type: string
  layout_type: "full" | "split_left" | "split_right"
}

type DisplaySettings = {
  mode: DisplayMode
  current_scene_id: number | null
  current_scene: { id: number; name: string } | null
  active_notice_id: number | null
  media_full_file_id: number | null
  media_left_file_id: number | null
  media_right_file_id: number | null
  media_full_asset: DisplayAsset | null
  media_left_asset: DisplayAsset | null
  media_right_asset: DisplayAsset | null
}

type NoticeOption = {
  id: number
  title: string
  is_active: boolean
}

async function uploadDisplayAsset(
  file: File,
  layoutType: "full" | "split_left" | "split_right",
  title?: string,
): Promise<DisplayAsset> {
  const formData = new FormData()
  formData.append("file", file)
  formData.append("layout_type", layoutType)
  formData.append("title", title ?? file.name)

  const res = await fetch("/api/admin/display-assets", {
    method: "POST",
    body: formData,
  })
  const json = (await res.json()) as {
    success?: boolean
    asset?: DisplayAsset
    error?: string
  }

  if (!res.ok || !json.success || !json.asset) {
    throw new Error(json.error ?? "파일 업로드에 실패했습니다.")
  }

  return json.asset
}

function AssetPreview({ asset }: { asset: DisplayAsset | null }) {
  if (!asset) return null

  return (
    <div
      style={{
        marginTop: 12,
        height: 180,
        borderRadius: 8,
        overflow: "hidden",
        border: "1px solid rgba(255,255,255,0.12)",
        background: "#0f172a",
      }}
    >
      <DisplayMediaRenderer
        fileUrl={asset.file_url}
        fileType={asset.file_type}
        mimeType={asset.mime_type}
        variant={asset.layout_type === "full" ? "full" : "split"}
      />
    </div>
  )
}

export default function AdminDisplayPage() {
  const [settings, setSettings] = useState<DisplaySettings | null>(null)
  const [notices, setNotices] = useState<NoticeOption[]>([])
  const [selectedMode, setSelectedMode] = useState<DisplayMode>("ranking")
  const [activeNoticeId, setActiveNoticeId] = useState<number | "">("")
  const [fullAsset, setFullAsset] = useState<DisplayAsset | null>(null)
  const [leftAsset, setLeftAsset] = useState<DisplayAsset | null>(null)
  const [rightAsset, setRightAsset] = useState<DisplayAsset | null>(null)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const [applying, setApplying] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [settingsRes, noticesRes] = await Promise.all([
        fetch("/api/admin/display-settings"),
        fetch("/api/admin/notices"),
      ])

      const settingsJson = (await settingsRes.json()) as {
        data?: DisplaySettings
      }
      const noticesJson = (await noticesRes.json()) as {
        data?: NoticeOption[]
      }

      const nextSettings = settingsJson.data ?? null
      setSettings(nextSettings)
      setNotices(noticesJson.data ?? [])

      if (nextSettings) {
        setSelectedMode(nextSettings.mode)
        setActiveNoticeId(nextSettings.active_notice_id ?? "")
        setFullAsset(nextSettings.media_full_asset)
        setLeftAsset(nextSettings.media_left_asset)
        setRightAsset(nextSettings.media_right_asset)
      }
    } catch {
      setError("설정을 불러오지 못했습니다.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  async function handleFullUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    setError("")
    try {
      const asset = await uploadDisplayAsset(file, "full")
      setFullAsset(asset)
      setMessage("가로 전체 화면 파일이 업로드되었습니다.")
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "파일 업로드에 실패했습니다.",
      )
    } finally {
      event.target.value = ""
    }
  }

  async function handleSplitUpload(
    side: "left" | "right",
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0]
    if (!file) return

    setError("")
    try {
      const asset = await uploadDisplayAsset(
        file,
        side === "left" ? "split_left" : "split_right",
      )
      if (side === "left") {
        setLeftAsset(asset)
      } else {
        setRightAsset(asset)
      }
      setMessage(
        `${side === "left" ? "왼쪽" : "오른쪽"} 파일이 업로드되었습니다.`,
      )
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "파일 업로드에 실패했습니다.",
      )
    } finally {
      event.target.value = ""
    }
  }

  async function applySettings(payload: {
    mode: DisplayMode
    active_notice_id?: number | null
    media_full_file_id?: number | null
    media_left_file_id?: number | null
    media_right_file_id?: number | null
  }) {
    setApplying(true)
    setMessage("")
    setError("")

    try {
      const res = await fetch("/api/admin/display-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const json = (await res.json()) as {
        success?: boolean
        error?: string
        data?: DisplaySettings
      }

      if (!res.ok || !json.success) {
        setError(json.error ?? "적용에 실패했습니다.")
        return
      }

      setSettings(json.data ?? null)
      setSelectedMode(payload.mode)
      setMessage("전광판 설정이 적용되었습니다. 30초 이내에 반영됩니다.")
    } catch {
      setError("적용 중 오류가 발생했습니다.")
    } finally {
      setApplying(false)
    }
  }

  async function handleApplyRanking() {
    await applySettings({ mode: "ranking" })
  }

  async function handleApplyMediaFull() {
    if (!fullAsset) {
      setError("가로 전체 화면 파일을 먼저 업로드해 주세요.")
      return
    }

    await applySettings({
      mode: "media_full",
      media_full_file_id: fullAsset.id,
    })
  }

  async function handleApplyMediaSplit() {
    if (!leftAsset || !rightAsset) {
      setError("왼쪽/오른쪽 파일을 모두 업로드해 주세요.")
      return
    }

    await applySettings({
      mode: "media_split",
      media_left_file_id: leftAsset.id,
      media_right_file_id: rightAsset.id,
    })
  }

  async function handleApplyNotice() {
    if (!activeNoticeId) {
      setError("표시할 공지사항을 선택해 주세요.")
      return
    }

    await applySettings({
      mode: "notice",
      active_notice_id: Number(activeNoticeId),
    })
  }

  if (loading) {
    return <p>불러오는 중...</p>
  }

  const currentSceneLabel = settings?.current_scene?.name
  const currentModeLabel = settings
    ? DISPLAY_MODE_LABELS[settings.mode]
    : "랭킹 화면"

  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <Link href="/admin" className={styles.btnLink}>
          ← 관리자 홈
        </Link>
      </div>
      <h2 className={styles.pageTitle}>전광판 설정 (빠른 설정)</h2>

      <div className={`${styles.panel} ${styles.message}`} style={{ marginBottom: 16 }}>
        <div style={{ marginBottom: 8 }}>
          <strong>현재 전광판 화면:</strong>{" "}
          {currentSceneLabel ?? currentModeLabel}
        </div>
        <Link href="/admin/display-scenes" className={styles.btnLink}>
          Scene 관리로 이동 →
        </Link>
      </div>

      {message ? (
        <div className={`${styles.message} ${styles.messageSuccess}`}>{message}</div>
      ) : null}
      {error ? (
        <div className={`${styles.message} ${styles.messageError}`}>{error}</div>
      ) : null}

      <div className={styles.cardGrid}>
        <div className={styles.card} style={{ cursor: "default" }}>
          <h3 className={styles.cardTitle}>랭킹 화면</h3>
          <p className={styles.cardDesc}>기존 월간 랭킹 전광판을 표시합니다.</p>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnPrimary}`}
            disabled={applying}
            onClick={handleApplyRanking}
          >
            적용
          </button>
        </div>

        <div className={styles.card} style={{ cursor: "default" }}>
          <h3 className={styles.cardTitle}>가로 전체 화면</h3>
          <p className={styles.cardDesc}>이미지 또는 PDF 1개를 전체 화면에 표시합니다.</p>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,application/pdf"
            onChange={handleFullUpload}
          />
          <AssetPreview asset={fullAsset} />
          <div className={styles.buttonRow} style={{ marginTop: 12 }}>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnPrimary}`}
              disabled={applying}
              onClick={handleApplyMediaFull}
            >
              적용
            </button>
          </div>
        </div>

        <div className={styles.card} style={{ cursor: "default" }}>
          <h3 className={styles.cardTitle}>세로 2분할 화면</h3>
          <p className={styles.cardDesc}>왼쪽/오른쪽에 각각 이미지 또는 PDF를 표시합니다.</p>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>왼쪽 파일</label>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,application/pdf"
              onChange={(event) => handleSplitUpload("left", event)}
            />
            <AssetPreview asset={leftAsset} />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>오른쪽 파일</label>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,application/pdf"
              onChange={(event) => handleSplitUpload("right", event)}
            />
            <AssetPreview asset={rightAsset} />
          </div>
          <div className={styles.buttonRow}>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnPrimary}`}
              disabled={applying}
              onClick={handleApplyMediaSplit}
            >
              적용
            </button>
          </div>
        </div>

        <div className={styles.card} style={{ cursor: "default" }}>
          <h3 className={styles.cardTitle}>공지사항</h3>
          <p className={styles.cardDesc}>텍스트 공지 화면을 표시합니다.</p>
          <select
            className={styles.formSelect}
            value={activeNoticeId}
            onChange={(e) =>
              setActiveNoticeId(e.target.value ? Number(e.target.value) : "")
            }
          >
            <option value="">공지를 선택하세요</option>
            {notices.map((notice) => (
              <option key={notice.id} value={notice.id}>
                {notice.title}
                {!notice.is_active ? " (비활성)" : ""}
              </option>
            ))}
          </select>
          <div className={styles.buttonRow} style={{ marginTop: 12 }}>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnPrimary}`}
              disabled={applying}
              onClick={handleApplyNotice}
            >
              적용
            </button>
          </div>
        </div>
      </div>

      {settings ? (
        <p style={{ marginTop: 20, color: "#94a3b8", fontSize: 14 }}>
          선택 중인 모드: {DISPLAY_MODE_LABELS[selectedMode]}
        </p>
      ) : null}
    </>
  )
}
