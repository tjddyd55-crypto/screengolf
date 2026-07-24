"use client"

import { FormEvent, use, useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import styles from "../../../admin.module.css"
import {
  DISPLAY_MODE_LABELS,
  type DisplayMode,
} from "@/lib/admin/constants"
import ScenePreviewFrame from "@/components/display/ScenePreviewFrame"

type DisplayAsset = {
  id: number
  title: string
  file_url: string
  fileUrl?: string
  file_type: "image" | "pdf"
  mime_type: string
  original_name?: string
  originalName?: string
  layout_type: "full" | "split_left" | "split_right"
  sizeLabel?: string | null
  file_missing?: boolean
  fileMissing?: boolean
  status?: string
}

type DisplayScene = {
  id: number
  name: string
  mode: DisplayMode
  notice_id: number | null
  media_full_file_id: number | null
  media_left_file_id: number | null
  media_right_file_id: number | null
  sort_order: number
  is_active: boolean
  is_current: boolean
  notice_title: string | null
  summary: string
  media_full_asset: DisplayAsset | null
  media_left_asset: DisplayAsset | null
  media_right_asset: DisplayAsset | null
}

type NoticeOption = {
  id: number
  title: string
  is_active: boolean
}

type SceneForm = {
  name: string
  mode: DisplayMode
  notice_id: string
  media_full_file_id: string
  media_left_file_id: string
  media_right_file_id: string
  sort_order: string
  is_active: boolean
}

const EMPTY_FORM: SceneForm = {
  name: "",
  mode: "ranking",
  notice_id: "",
  media_full_file_id: "",
  media_left_file_id: "",
  media_right_file_id: "",
  sort_order: "",
  is_active: true,
}

function assetLabel(asset: DisplayAsset): string {
  const displayName =
    asset.title ||
    asset.original_name ||
    asset.originalName ||
    `파일 #${asset.id}`
  const original = asset.original_name || asset.originalName || ""
  const format = (asset.mime_type || "").split("/")[1]?.toUpperCase() || ""
  const size = asset.sizeLabel ? ` · ${asset.sizeLabel}` : ""
  const status =
    asset.file_missing || asset.fileMissing || asset.status === "missing"
      ? " · 파일 누락"
      : ""
  const originalHint =
    original && original !== displayName ? ` (${original})` : ""
  return `${displayName}${originalHint}${format ? ` · ${format}` : ""}${size}${status}`
}

function displayFileName(asset: DisplayAsset | null | undefined): string {
  if (!asset) return ""
  const title = (asset.title || "").trim()
  const original = (
    asset.original_name ||
    asset.originalName ||
    ""
  ).trim()
  // title → original_name → id fallback (stored filename 기본 표시 금지)
  return title || original || `파일 #${asset.id}`
}

function sceneConnectedFiles(scene: DisplayScene): {
  text: string
  title: string
} | null {
  if (scene.mode === "media_full" && scene.media_full_asset) {
    const name = displayFileName(scene.media_full_asset)
    return { text: name, title: name }
  }

  if (scene.mode === "media_split") {
    const left = displayFileName(scene.media_left_asset)
    const right = displayFileName(scene.media_right_asset)
    const parts = [
      left ? `좌: ${left}` : null,
      right ? `우: ${right}` : null,
    ].filter(Boolean)
    if (parts.length === 0) return null
    return { text: parts.join("  "), title: parts.join(" / ") }
  }

  if (scene.mode === "notice" && scene.notice_title) {
    return { text: scene.notice_title, title: scene.notice_title }
  }

  return null
}

function isAssetMissing(asset: DisplayAsset | null | undefined): boolean {
  if (!asset) return true
  return Boolean(asset.file_missing || asset.fileMissing || asset.status === "missing")
}

type PageProps = {
  params: Promise<{ unitCode: string }>
}

export default function AdminDisplayScenesPage({ params }: PageProps) {
  const { unitCode } = use(params)
  const scenesApi = `/api/admin/display-units/${encodeURIComponent(unitCode)}/scenes`
  const displayHref = `/admin/display/${encodeURIComponent(unitCode)}`

  const [scenes, setScenes] = useState<DisplayScene[]>([])
  const [assets, setAssets] = useState<DisplayAsset[]>([])
  const [notices, setNotices] = useState<NoticeOption[]>([])
  const [form, setForm] = useState<SceneForm>(EMPTY_FORM)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [previewScene, setPreviewScene] = useState<DisplayScene | null>(null)
  const [showFormPreview, setShowFormPreview] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [scenesRes, assetsRes, noticesRes] = await Promise.all([
        fetch(scenesApi),
        fetch("/api/admin/display-assets"),
        fetch("/api/admin/notices"),
      ])

      const scenesJson = (await scenesRes.json()) as { data?: DisplayScene[] }
      const assetsJson = (await assetsRes.json()) as { data?: DisplayAsset[] }
      const noticesJson = (await noticesRes.json()) as { data?: NoticeOption[] }

      setScenes(scenesJson.data ?? [])
      setAssets(assetsJson.data ?? [])
      setNotices(noticesJson.data ?? [])
    } catch {
      setError("Scene 목록을 불러오지 못했습니다.")
    } finally {
      setLoading(false)
    }
  }, [scenesApi])

  useEffect(() => {
    loadData()
  }, [loadData])

  const fullAssets = useMemo(
    () => assets.filter((asset) => asset.layout_type === "full"),
    [assets],
  )

  const splitAssets = useMemo(
    () =>
      assets.filter(
        (asset) =>
          asset.layout_type === "split_left" || asset.layout_type === "split_right",
      ),
    [assets],
  )

  function openCreateModal() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setShowModal(true)
    setMessage("")
    setError("")
  }

  function openEditModal(scene: DisplayScene) {
    setEditingId(scene.id)
    setForm({
      name: scene.name,
      mode: scene.mode,
      notice_id: scene.notice_id ? String(scene.notice_id) : "",
      media_full_file_id: scene.media_full_file_id
        ? String(scene.media_full_file_id)
        : "",
      media_left_file_id: scene.media_left_file_id
        ? String(scene.media_left_file_id)
        : "",
      media_right_file_id: scene.media_right_file_id
        ? String(scene.media_right_file_id)
        : "",
      sort_order: String(scene.sort_order),
      is_active: scene.is_active,
    })
    setShowModal(true)
    setMessage("")
    setError("")
  }

  function buildPayload() {
    return {
      name: form.name,
      mode: form.mode,
      notice_id: form.notice_id ? Number(form.notice_id) : null,
      media_full_file_id: form.media_full_file_id
        ? Number(form.media_full_file_id)
        : null,
      media_left_file_id: form.media_left_file_id
        ? Number(form.media_left_file_id)
        : null,
      media_right_file_id: form.media_right_file_id
        ? Number(form.media_right_file_id)
        : null,
      sort_order: form.sort_order ? Number(form.sort_order) : undefined,
      is_active: form.is_active,
    }
  }

  const selectedFullAsset = assets.find(
    (asset) => asset.id === Number(form.media_full_file_id),
  )
  const selectedLeftAsset = assets.find(
    (asset) => asset.id === Number(form.media_left_file_id),
  )
  const selectedRightAsset = assets.find(
    (asset) => asset.id === Number(form.media_right_file_id),
  )
  const selectedNotice = notices.find(
    (notice) => notice.id === Number(form.notice_id),
  )

  const formMediaInvalid =
    (form.mode === "media_full" && isAssetMissing(selectedFullAsset)) ||
    (form.mode === "media_split" &&
      (isAssetMissing(selectedLeftAsset) || isAssetMissing(selectedRightAsset)))

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setMessage("")
    setError("")

    if (formMediaInvalid) {
      setError("선택한 파일을 불러올 수 없어 전광판에 적용할 수 없습니다.")
      return
    }

    try {
      const res = await fetch(
        editingId
          ? `/api/admin/display-scenes/${editingId}`
          : scenesApi,
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildPayload()),
        },
      )
      const json = (await res.json()) as { success?: boolean; error?: string }

      if (!res.ok || !json.success) {
        setError(json.error ?? "저장에 실패했습니다.")
        return
      }

      setShowModal(false)
      setMessage(editingId ? "Scene이 수정되었습니다." : "Scene이 생성되었습니다.")
      await loadData()
    } catch {
      setError("저장 중 오류가 발생했습니다.")
    }
  }

  async function handleApply(scene: DisplayScene) {
    setError("")

    if (
      (scene.mode === "media_full" && isAssetMissing(scene.media_full_asset)) ||
      (scene.mode === "media_split" &&
        (isAssetMissing(scene.media_left_asset) ||
          isAssetMissing(scene.media_right_asset)))
    ) {
      setError("선택한 파일을 불러올 수 없어 전광판에 적용할 수 없습니다.")
      return
    }

    const unitLabel =
      unitCode === "display-1"
        ? "전광판 1"
        : unitCode === "display-2"
          ? "전광판 2"
          : unitCode
    const confirmed = window.confirm(
      `'${scene.name}' Scene을 ${unitLabel}에 적용할까요?\n\n다른 전광판 화면에는 영향을 주지 않습니다.\n${unitLabel}는 최대 30초 이내에 전환됩니다.`,
    )
    if (!confirmed) return

    const res = await fetch(`/api/admin/display-scenes/${scene.id}/apply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ unitCode }),
    })
    const json = (await res.json()) as { success?: boolean; error?: string }

    if (!res.ok || !json.success) {
      setError(json.error ?? "적용에 실패했습니다.")
      return
    }

    setMessage(
      `${unitLabel}에 '${scene.name}' 화면을 적용했습니다. 최대 30초 이내에 반영됩니다.`,
    )
    await loadData()
  }

  async function handleDuplicate(id: number) {
    setError("")
    const res = await fetch(`/api/admin/display-scenes/${id}/duplicate`, {
      method: "POST",
    })
    const json = (await res.json()) as { success?: boolean; error?: string }

    if (!res.ok || !json.success) {
      setError(json.error ?? "복제에 실패했습니다.")
      return
    }

    setMessage("Scene이 복제되었습니다.")
    await loadData()
  }

  async function handleDeactivate(id: number) {
    if (!window.confirm("이 Scene을 비활성 처리하시겠습니까?")) return

    setError("")
    const res = await fetch(`/api/admin/display-scenes/${id}`, {
      method: "DELETE",
    })
    const json = (await res.json()) as { success?: boolean; error?: string }

    if (!res.ok || !json.success) {
      setError(json.error ?? "비활성 처리에 실패했습니다.")
      return
    }

    setMessage("Scene이 비활성 처리되었습니다.")
    await loadData()
  }

  if (loading) {
    return <p>불러오는 중...</p>
  }

  const activeScenes = scenes.filter((scene) => scene.is_active)
  const currentScene = activeScenes.find((scene) => scene.is_current)

  return (
    <>
      <Link href="/admin" className={styles.backLink}>
        ← 관리자 홈
      </Link>

      <div className={styles.pageHeader}>
        <h2 className={styles.pageTitle}>Scene 관리 · {unitCode}</h2>
        <div className={styles.buttonRow}>
          <Link
            href={displayHref}
            className={`${styles.btn} ${styles.btnSecondary}`}
          >
            빠른 설정
          </Link>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={openCreateModal}
          >
            Scene 추가
          </button>
        </div>
      </div>

      {currentScene ? (
        <div
          className={`${styles.panel} ${styles.currentAppliedBanner} ${styles.cardApplied}`}
        >
          <p className={styles.liveStatus}>
            <span className={styles.liveStatusDot} aria-hidden="true" />
            현재 송출 중
          </p>
          <p className={styles.appliedLabel}>현재 적용 화면</p>
          <p className={styles.appliedSceneName}>{currentScene.name}</p>
          <p className={styles.appliedModeLine}>
            {DISPLAY_MODE_LABELS[currentScene.mode]}
          </p>
        </div>
      ) : null}

      {message ? (
        <div className={`${styles.message} ${styles.messageSuccess}`}>{message}</div>
      ) : null}
      {error ? (
        <div className={`${styles.message} ${styles.messageError}`}>{error}</div>
      ) : null}

      {activeScenes.length === 0 ? (
        <div className={styles.panel}>등록된 Scene이 없습니다.</div>
      ) : (
        <div className={styles.sceneGrid}>
          {activeScenes.map((scene) => {
            const connected = sceneConnectedFiles(scene)
            return (
              <div
                key={scene.id}
                className={`${styles.card} ${styles.cardStatic} ${
                  scene.is_current ? styles.cardApplied : ""
                }`}
              >
                <div className={styles.cardHeader}>
                  <h3 className={styles.cardTitle} title={scene.name}>
                    {scene.name}
                  </h3>
                  {scene.is_current ? (
                    <span className={`${styles.badge} ${styles.badgeApplied}`}>
                      현재 적용 중
                    </span>
                  ) : null}
                </div>
                {scene.is_current ? (
                  <p className={styles.modeCheckMark}>✓ 현재 적용 중</p>
                ) : null}
                <p className={`${styles.cardDesc} ${styles.cardDescCompact}`}>
                  {DISPLAY_MODE_LABELS[scene.mode]}
                </p>
                {connected ? (
                  <p className={styles.cardMeta} title={connected.title}>
                    {connected.text}
                  </p>
                ) : (
                  <p className={styles.cardMeta}>&nbsp;</p>
                )}

                <div className={styles.cardPreview}>
                  <ScenePreviewFrame
                    mode={scene.mode}
                    fullAsset={scene.media_full_asset}
                    leftAsset={scene.media_left_asset}
                    rightAsset={scene.media_right_asset}
                    noticeTitle={scene.notice_title}
                  />
                </div>

                <div className={styles.cardActions}>
                  <div className={styles.cardActionsPrimary}>
                    <button
                      type="button"
                      className={`${styles.btn} ${styles.btnPrimary}`}
                      disabled={scene.is_current}
                      onClick={() => handleApply(scene)}
                    >
                      {scene.is_current ? "적용 중" : "적용"}
                    </button>
                    <button
                      type="button"
                      className={`${styles.btn} ${styles.btnSecondary}`}
                      onClick={() => setPreviewScene(scene)}
                    >
                      미리보기
                    </button>
                    <button
                      type="button"
                      className={`${styles.btn} ${styles.btnSecondary}`}
                      onClick={() => openEditModal(scene)}
                    >
                      수정
                    </button>
                  </div>
                  <div className={styles.cardActionsSecondary}>
                    <button
                      type="button"
                      className={`${styles.btn} ${styles.btnSecondary}`}
                      onClick={() => handleDuplicate(scene.id)}
                    >
                      복제
                    </button>
                    {!scene.is_current ? (
                      <button
                        type="button"
                        className={`${styles.btn} ${styles.btnDanger}`}
                        onClick={() => handleDeactivate(scene.id)}
                      >
                        비활성
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showModal ? (
        <div className={styles.modalOverlay}>
          <div className={`${styles.modal} ${styles.modalWide}`}>
            <h3 className={styles.modalTitle}>
              {editingId ? "Scene 수정" : "Scene 추가"}
            </h3>
            <form onSubmit={handleSubmit}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Scene 이름</label>
                <input
                  className={styles.formInput}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>표시 모드</label>
                <select
                  className={styles.formSelect}
                  value={form.mode}
                  onChange={(e) =>
                    setForm({ ...form, mode: e.target.value as DisplayMode })
                  }
                >
                  <option value="ranking">랭킹 화면</option>
                  <option value="notice">공지사항</option>
                  <option value="media_full">가로 전체 화면</option>
                  <option value="media_split">세로 2분할 화면</option>
                </select>
              </div>

              {form.mode === "notice" ? (
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>공지사항</label>
                  <select
                    className={styles.formSelect}
                    value={form.notice_id}
                    onChange={(e) =>
                      setForm({ ...form, notice_id: e.target.value })
                    }
                    required
                  >
                    <option value="">공지 선택</option>
                    {notices.map((notice) => (
                      <option key={notice.id} value={notice.id}>
                        {notice.title}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              {form.mode === "media_full" ? (
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>전체 화면 파일</label>
                  <select
                    className={styles.formSelect}
                    value={form.media_full_file_id}
                    onChange={(e) =>
                      setForm({ ...form, media_full_file_id: e.target.value })
                    }
                    required
                  >
                    <option value="">파일 선택</option>
                    {fullAssets.map((asset) => (
                      <option key={asset.id} value={asset.id}>
                        {assetLabel(asset)}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              {form.mode === "media_split" ? (
                <>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>왼쪽 파일</label>
                    <select
                      className={styles.formSelect}
                      value={form.media_left_file_id}
                      onChange={(e) =>
                        setForm({ ...form, media_left_file_id: e.target.value })
                      }
                      required
                    >
                      <option value="">파일 선택</option>
                      {splitAssets.map((asset) => (
                        <option key={asset.id} value={asset.id}>
                          {assetLabel(asset)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>오른쪽 파일</label>
                    <select
                      className={styles.formSelect}
                      value={form.media_right_file_id}
                      onChange={(e) =>
                        setForm({ ...form, media_right_file_id: e.target.value })
                      }
                      required
                    >
                      <option value="">파일 선택</option>
                      {splitAssets.map((asset) => (
                        <option key={asset.id} value={asset.id}>
                          {assetLabel(asset)}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              ) : null}

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>실시간 미리보기</label>
                <ScenePreviewFrame
                  mode={form.mode}
                  fullAsset={selectedFullAsset ?? null}
                  leftAsset={selectedLeftAsset ?? null}
                  rightAsset={selectedRightAsset ?? null}
                  noticeTitle={selectedNotice?.title}
                />
                {formMediaInvalid ? (
                  <p className={styles.formError}>
                    선택한 파일을 불러올 수 없어 전광판에 적용할 수 없습니다.
                  </p>
                ) : null}
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
                    onChange={(e) =>
                      setForm({ ...form, is_active: e.target.checked })
                    }
                  />
                  활성
                </label>
              </div>
              <div className={styles.buttonRow}>
                <button
                  type="submit"
                  className={`${styles.btn} ${styles.btnPrimary}`}
                  disabled={formMediaInvalid}
                >
                  저장
                </button>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnSecondary}`}
                  onClick={() => setShowFormPreview(true)}
                >
                  미리보기
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

      {previewScene ? (
        <div className={styles.modalOverlay}>
          <div className={`${styles.modal} ${styles.modalPreview}`}>
            <h3 className={styles.modalTitle}>
              미리보기 · {previewScene.name}
            </h3>
            <ScenePreviewFrame
              mode={previewScene.mode}
              fullAsset={previewScene.media_full_asset}
              leftAsset={previewScene.media_left_asset}
              rightAsset={previewScene.media_right_asset}
              noticeTitle={previewScene.notice_title}
              large
            />
            <div className={styles.buttonRow}>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnSecondary}`}
                onClick={() => setPreviewScene(null)}
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showFormPreview ? (
        <div className={styles.modalOverlay}>
          <div className={`${styles.modal} ${styles.modalPreview}`}>
            <h3 className={styles.modalTitle}>적용 전 미리보기</h3>
            <ScenePreviewFrame
              mode={form.mode}
              fullAsset={selectedFullAsset ?? null}
              leftAsset={selectedLeftAsset ?? null}
              rightAsset={selectedRightAsset ?? null}
              noticeTitle={selectedNotice?.title}
              large
            />
            <div className={styles.buttonRow}>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnSecondary}`}
                onClick={() => setShowFormPreview(false)}
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
