"use client"

import { ChangeEvent, use, useCallback, useEffect, useState } from "react"
import Link from "next/link"
import styles from "../../../admin.module.css"
import {
  DISPLAY_MODE_LABELS,
  type DisplayMode,
} from "@/lib/admin/constants"
import ScenePreviewFrame from "@/components/display/ScenePreviewFrame"
import {
  resolveQuickSettingCardState,
  type QuickSettingCardUiState,
} from "@/lib/display/current-applied"
import {
  getBroadcastStatusHint,
  getBroadcastStatusLabel,
  type DisplayBroadcastStatus,
} from "@/lib/display/broadcast-state"

type DisplayAsset = {
  id: number
  title: string
  fileUrl: string
  fileType: "image" | "pdf"
  mimeType: string
  layoutType: "full" | "split_left" | "split_right"
  originalName?: string
  fileMissing?: boolean
  status?: string
  // 하위 호환
  file_url?: string
  file_type?: "image" | "pdf"
  mime_type?: string
  layout_type?: "full" | "split_left" | "split_right"
  original_name?: string
  file_missing?: boolean
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
  broadcast_status?: DisplayBroadcastStatus
  has_renderable_content?: boolean
  broadcast_label?: string
  current_scene_name?: string | null
  mode_label?: string | null
  updated_at?: string | null
}

type NoticeOption = {
  id: number
  title: string
  is_active: boolean
}

function normalizeAsset(asset: DisplayAsset): DisplayAsset {
  return {
    id: asset.id,
    title: asset.title,
    fileUrl: asset.fileUrl || asset.file_url || "",
    fileType: asset.fileType || asset.file_type || "image",
    mimeType: asset.mimeType || asset.mime_type || "image/png",
    layoutType: asset.layoutType || asset.layout_type || "full",
    originalName: asset.originalName || asset.original_name,
    fileMissing: Boolean(asset.fileMissing || asset.file_missing),
    status: asset.status,
    file_url: asset.fileUrl || asset.file_url,
    file_type: asset.fileType || asset.file_type,
    mime_type: asset.mimeType || asset.mime_type,
    layout_type: asset.layoutType || asset.layout_type,
    original_name: asset.originalName || asset.original_name,
    file_missing: Boolean(asset.fileMissing || asset.file_missing),
  }
}

function isUsableAsset(asset: DisplayAsset | null): boolean {
  if (!asset) return false
  if (asset.fileMissing || asset.file_missing || asset.status === "missing") {
    return false
  }
  return Boolean(asset.id && (asset.fileUrl || asset.file_url))
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

  return normalizeAsset(json.asset)
}

function cardBadge(state: QuickSettingCardUiState) {
  if (state.badge === "applied") {
    return (
      <span className={`${styles.badge} ${styles.badgeApplied}`}>
        현재 적용 중
      </span>
    )
  }
  if (state.badge === "selected") {
    return (
      <span className={`${styles.badge} ${styles.badgeSelected}`}>
        선택됨
      </span>
    )
  }
  if (state.badge === "scene") {
    return (
      <span className={`${styles.badge} ${styles.badgeScene}`}>
        Scene에서 사용 중
      </span>
    )
  }
  return null
}

function UploadHint({
  asset,
  emptyText,
}: {
  asset: DisplayAsset | null
  emptyText: string
}) {
  if (!asset) {
    return <p className={styles.formHint}>{emptyText}</p>
  }

  if (asset.fileMissing || asset.status === "missing") {
    return (
      <p className={styles.formError}>
        기존 원본 파일이 없어 새 파일을 선택해야 합니다.
      </p>
    )
  }

  const label =
    (asset.title || "").trim() ||
    (asset.originalName || asset.original_name || "").trim() ||
    `파일 #${asset.id}`

  return (
    <p className={styles.formHint} title={label}>
      {label}
    </p>
  )
}

type PageProps = {
  params: Promise<{ unitCode: string }>
}

export default function AdminDisplayPage({ params }: PageProps) {
  const { unitCode } = use(params)
  const settingsApi = `/api/admin/display-units/${encodeURIComponent(unitCode)}/settings`
  const scenesHref = `/admin/display-scenes/${encodeURIComponent(unitCode)}`
  const storeHref =
    unitCode === "display-1"
      ? "/store/monthly-ranking-display"
      : unitCode === "display-2"
        ? "/store/monthly-ranking-display-2"
        : `/store/display/${encodeURIComponent(unitCode)}`

  const [settings, setSettings] = useState<DisplaySettings | null>(null)
  const [notices, setNotices] = useState<NoticeOption[]>([])
  const [selectedMode, setSelectedMode] = useState<DisplayMode>("ranking")
  const [activeNoticeId, setActiveNoticeId] = useState<number | "">("")
  const [fullAsset, setFullAsset] = useState<DisplayAsset | null>(null)
  const [leftAsset, setLeftAsset] = useState<DisplayAsset | null>(null)
  const [rightAsset, setRightAsset] = useState<DisplayAsset | null>(null)
  const [message, setMessage] = useState("")
  const [fullUploadError, setFullUploadError] = useState("")
  const [leftUploadError, setLeftUploadError] = useState("")
  const [rightUploadError, setRightUploadError] = useState("")
  const [applyError, setApplyError] = useState("")
  const [loading, setLoading] = useState(true)
  const [applying, setApplying] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [settingsRes, noticesRes] = await Promise.all([
        fetch(settingsApi),
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
        setFullAsset(
          nextSettings.media_full_asset
            ? normalizeAsset(nextSettings.media_full_asset)
            : null,
        )
        setLeftAsset(
          nextSettings.media_left_asset
            ? normalizeAsset(nextSettings.media_left_asset)
            : null,
        )
        setRightAsset(
          nextSettings.media_right_asset
            ? normalizeAsset(nextSettings.media_right_asset)
            : null,
        )
      }
    } catch {
      setApplyError("설정을 불러오지 못했습니다.")
    } finally {
      setLoading(false)
    }
  }, [settingsApi])

  useEffect(() => {
    loadData()
  }, [loadData])

  async function handleFullUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    setFullUploadError("")
    setMessage("")
    try {
      const asset = await uploadDisplayAsset(file, "full")
      setFullAsset(asset)
      setMessage("가로 전체 화면 파일이 업로드되었습니다.")
    } catch (uploadError) {
      setFullUploadError(
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

    if (side === "left") setLeftUploadError("")
    else setRightUploadError("")
    setMessage("")

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
      const messageText =
        uploadError instanceof Error
          ? uploadError.message
          : "파일 업로드에 실패했습니다."
      if (side === "left") setLeftUploadError(messageText)
      else setRightUploadError(messageText)
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
    setApplyError("")

    try {
      const res = await fetch(settingsApi, {
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
        setApplyError(json.error ?? "적용에 실패했습니다.")
        return
      }

      // 적용 성공 후 서버 SSOT(broadcast_status 포함)를 그대로 반영한다.
      // 로컬 selectedMode만으로 "현재 적용 중"을 만들지 않는다.
      const next = json.data ?? null
      setSettings(next)
      if (next) {
        setSelectedMode(next.mode)
        setActiveNoticeId(next.active_notice_id ?? "")
        setFullAsset(
          next.media_full_asset
            ? normalizeAsset(next.media_full_asset)
            : null,
        )
        setLeftAsset(
          next.media_left_asset
            ? normalizeAsset(next.media_left_asset)
            : null,
        )
        setRightAsset(
          next.media_right_asset
            ? normalizeAsset(next.media_right_asset)
            : null,
        )
      }
      setMessage("전광판 설정이 적용되었습니다. 30초 이내에 반영됩니다.")
    } catch {
      setApplyError("적용 중 오류가 발생했습니다.")
    } finally {
      setApplying(false)
    }
  }

  async function handleApplyRanking() {
    await applySettings({ mode: "ranking" })
  }

  async function handleApplyMediaFull() {
    if (!isUsableAsset(fullAsset)) {
      setApplyError("가로 전체 화면 파일을 먼저 정상 업로드해 주세요.")
      return
    }

    await applySettings({
      mode: "media_full",
      media_full_file_id: fullAsset!.id,
    })
  }

  async function handleApplyMediaSplit() {
    if (!isUsableAsset(leftAsset) || !isUsableAsset(rightAsset)) {
      setApplyError("왼쪽/오른쪽 파일을 모두 정상 업로드해 주세요.")
      return
    }

    await applySettings({
      mode: "media_split",
      media_left_file_id: leftAsset!.id,
      media_right_file_id: rightAsset!.id,
    })
  }

  async function handleApplyNotice() {
    if (!activeNoticeId) {
      setApplyError("표시할 공지사항을 선택해 주세요.")
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

  const broadcastStatus = settings?.broadcast_status ?? "WAITING"
  const isBroadcasting = broadcastStatus === "BROADCASTING"
  const currentSceneId =
    settings?.current_scene_id ?? settings?.current_scene?.id ?? null
  const isSceneBroadcasting = isBroadcasting && currentSceneId != null
  const currentSceneLabel =
    settings?.current_scene_name ?? settings?.current_scene?.name ?? null
  const resolvedMode = settings?.mode ?? null
  const currentModeLabel =
    settings?.mode_label ??
    (resolvedMode ? DISPLAY_MODE_LABELS[resolvedMode] : "랭킹 화면")

  const rankingCard = resolveQuickSettingCardState({
    cardMode: "ranking",
    broadcastStatus,
    resolvedMode,
    currentSceneId,
    selectedMode,
  })
  const fullCard = resolveQuickSettingCardState({
    cardMode: "media_full",
    broadcastStatus,
    resolvedMode,
    currentSceneId,
    selectedMode,
  })
  const splitCard = resolveQuickSettingCardState({
    cardMode: "media_split",
    broadcastStatus,
    resolvedMode,
    currentSceneId,
    selectedMode,
  })
  const noticeCard = resolveQuickSettingCardState({
    cardMode: "notice",
    broadcastStatus,
    resolvedMode,
    currentSceneId,
    selectedMode,
  })

  const canApplyFull = isUsableAsset(fullAsset)
  const canApplySplit = isUsableAsset(leftAsset) && isUsableAsset(rightAsset)

  const bannerClass = isBroadcasting
    ? styles.displayUnitCardBroadcasting
    : styles.displayUnitCardWaiting
  const liveClass = isBroadcasting
    ? styles.liveStatus
    : `${styles.liveStatus} ${styles.liveStatusWaiting}`

  const bannerLiveLabel = isSceneBroadcasting
    ? "현재 Scene 적용 중"
    : isBroadcasting
      ? "현재 적용 중"
      : (settings?.broadcast_label ?? getBroadcastStatusLabel(broadcastStatus))

  return (
    <>
      <Link href="/admin" className={styles.backLink}>
        ← 관리자 홈
      </Link>

      <div className={styles.pageHeader}>
        <h2 className={styles.pageTitle}>전광판 설정 · {unitCode}</h2>
        <Link
          href={storeHref}
          target="_blank"
          className={`${styles.btn} ${styles.btnSecondary}`}
        >
          전광판 보기
        </Link>
      </div>

      <div
        className={`${styles.panel} ${styles.infoPanel} ${styles.currentAppliedBanner} ${styles.broadcastBanner} ${bannerClass}`}
      >
        <p className={liveClass}>
          <span className={styles.liveStatusDot} aria-hidden="true" />
          {bannerLiveLabel}
        </p>
        {isSceneBroadcasting ? (
          <>
            <p className={styles.appliedLabel}>현재 적용 화면</p>
            <p className={styles.appliedSceneName}>
              {currentSceneLabel ?? currentModeLabel}
            </p>
            <p className={styles.appliedModeLine}>{currentModeLabel}</p>
            <p className={styles.appliedMetaLine}>
              Scene 관리에서 적용된 화면입니다.
            </p>
          </>
        ) : isBroadcasting ? (
          <>
            <p className={styles.appliedMetaLine}>
              현재 이 전광판 URL에 {currentModeLabel}이 표시되고 있습니다.
            </p>
            <p className={styles.appliedLabel}>현재 적용 화면</p>
            <p className={styles.appliedSceneName}>{currentModeLabel}</p>
          </>
        ) : (
          <>
            <p className={styles.appliedSceneName}>
              현재 적용된 화면이 없습니다.
            </p>
            <p className={styles.appliedMetaLine}>
              {getBroadcastStatusHint("WAITING")}
            </p>
          </>
        )}
        <div className={styles.broadcastBannerActions}>
          <Link href={scenesHref} className={styles.btnLink}>
            Scene 관리로 이동 →
          </Link>
        </div>
      </div>

      {message ? (
        <div className={`${styles.message} ${styles.messageSuccess}`}>{message}</div>
      ) : null}
      {applyError ? (
        <div className={`${styles.message} ${styles.messageError}`}>{applyError}</div>
      ) : null}

      <div className={styles.displayGrid}>
        <div
          className={`${styles.card} ${styles.cardStatic} ${
            rankingCard.emphasizeApplied ? styles.cardApplied : ""
          }`}
        >
          <div className={styles.cardHeader}>
            <h3 className={styles.cardTitle}>랭킹 화면</h3>
            {cardBadge(rankingCard)}
          </div>
          {rankingCard.isDirectApplied ? (
            <p className={styles.modeCheckMark}>✓ 현재 적용 중</p>
          ) : null}
          <p className={styles.cardDesc}>기존 월간 랭킹 전광판을 표시합니다.</p>
          <div className={styles.cardPreview}>
            <ScenePreviewFrame mode="ranking" />
          </div>
          <div className={styles.cardActions}>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnPrimary}`}
              disabled={applying || rankingCard.isDirectApplied}
              onClick={handleApplyRanking}
            >
              {rankingCard.buttonLabel}
            </button>
          </div>
        </div>

        <div
          className={`${styles.card} ${styles.cardStatic} ${
            fullCard.emphasizeApplied ? styles.cardApplied : ""
          }`}
        >
          <div className={styles.cardHeader}>
            <h3 className={styles.cardTitle}>가로 전체 화면</h3>
            {cardBadge(fullCard)}
          </div>
          {fullCard.isDirectApplied ? (
            <p className={styles.modeCheckMark}>✓ 현재 적용 중</p>
          ) : null}
          <p className={styles.cardDesc}>
            이미지 또는 PDF 1개를 전체 화면에 표시합니다.
          </p>
          <div className={styles.formGroup}>
            <input
              type="file"
              className={styles.fileInput}
              accept=".jpg,.jpeg,.png,.webp,.pdf,image/png,image/jpeg,image/webp,application/pdf"
              onChange={handleFullUpload}
            />
            {fullUploadError ? (
              <p className={styles.formError}>{fullUploadError}</p>
            ) : null}
            <UploadHint
              asset={fullAsset}
              emptyText="파일을 선택하면 미리보기가 표시됩니다."
            />
          </div>
          <div className={styles.cardPreview}>
            {isUsableAsset(fullAsset) ? (
              <ScenePreviewFrame mode="media_full" fullAsset={fullAsset} />
            ) : (
              <ScenePreviewFrame mode="media_full" fullAsset={null} />
            )}
          </div>
          <div className={styles.cardActions}>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnPrimary}`}
              disabled={applying || !canApplyFull || fullCard.isDirectApplied}
              onClick={handleApplyMediaFull}
            >
              {fullCard.buttonLabel}
            </button>
          </div>
        </div>

        <div
          className={`${styles.card} ${styles.cardStatic} ${
            splitCard.emphasizeApplied ? styles.cardApplied : ""
          }`}
        >
          <div className={styles.cardHeader}>
            <h3 className={styles.cardTitle}>세로 2분할 화면</h3>
            {cardBadge(splitCard)}
          </div>
          {splitCard.isDirectApplied ? (
            <p className={styles.modeCheckMark}>✓ 현재 적용 중</p>
          ) : null}
          <p className={styles.cardDesc}>
            왼쪽/오른쪽에 각각 이미지 또는 PDF를 표시합니다.
          </p>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>왼쪽 파일</label>
            <input
              type="file"
              className={styles.fileInput}
              accept=".jpg,.jpeg,.png,.webp,.pdf,image/png,image/jpeg,image/webp,application/pdf"
              onChange={(event) => handleSplitUpload("left", event)}
            />
            {leftUploadError ? (
              <p className={styles.formError}>{leftUploadError}</p>
            ) : null}
            <UploadHint
              asset={leftAsset}
              emptyText="왼쪽 파일을 선택하면 미리보기가 표시됩니다."
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>오른쪽 파일</label>
            <input
              type="file"
              className={styles.fileInput}
              accept=".jpg,.jpeg,.png,.webp,.pdf,image/png,image/jpeg,image/webp,application/pdf"
              onChange={(event) => handleSplitUpload("right", event)}
            />
            {rightUploadError ? (
              <p className={styles.formError}>{rightUploadError}</p>
            ) : null}
            <UploadHint
              asset={rightAsset}
              emptyText="오른쪽 파일을 선택하면 미리보기가 표시됩니다."
            />
          </div>
          <div className={styles.cardPreview}>
            <ScenePreviewFrame
              mode="media_split"
              leftAsset={leftAsset}
              rightAsset={rightAsset}
            />
          </div>
          <div className={styles.cardActions}>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnPrimary}`}
              disabled={applying || !canApplySplit || splitCard.isDirectApplied}
              onClick={handleApplyMediaSplit}
            >
              {splitCard.buttonLabel}
            </button>
          </div>
        </div>

        <div
          className={`${styles.card} ${styles.cardStatic} ${
            noticeCard.emphasizeApplied ? styles.cardApplied : ""
          }`}
        >
          <div className={styles.cardHeader}>
            <h3 className={styles.cardTitle}>공지사항</h3>
            {cardBadge(noticeCard)}
          </div>
          {noticeCard.isDirectApplied ? (
            <p className={styles.modeCheckMark}>✓ 현재 적용 중</p>
          ) : null}
          <p className={styles.cardDesc}>텍스트 공지 화면을 표시합니다.</p>
          <div className={styles.formGroup}>
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
          </div>
          <div className={styles.cardPreview}>
            <ScenePreviewFrame
              mode="notice"
              noticeTitle={
                notices.find((n) => n.id === Number(activeNoticeId))?.title ??
                null
              }
            />
          </div>
          <div className={styles.cardActions}>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnPrimary}`}
              disabled={applying || noticeCard.isDirectApplied}
              onClick={handleApplyNotice}
            >
              {noticeCard.buttonLabel}
            </button>
          </div>
        </div>
      </div>

      {settings ? (
        <p className={styles.mutedText}>
          선택 중인 모드: {DISPLAY_MODE_LABELS[selectedMode]}
        </p>
      ) : null}
    </>
  )
}
