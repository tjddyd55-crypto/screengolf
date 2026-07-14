"use client"

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import styles from "../../admin.module.css"
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
  const original = asset.original_name || asset.originalName || ""
  const format = (asset.mime_type || "").split("/")[1]?.toUpperCase() || ""
  const size = asset.sizeLabel ? ` · ${asset.sizeLabel}` : ""
  const status =
    asset.file_missing || asset.fileMissing || asset.status === "missing"
      ? " · 파일 누락"
      : ""
  return `${asset.title}${original ? ` (${original})` : ""}${format ? ` · ${format}` : ""}${size}${status}`
}

function isAssetMissing(asset: DisplayAsset | null | undefined): boolean {
  if (!asset) return true
  return Boolean(asset.file_missing || asset.fileMissing || asset.status === "missing")
}

export default function AdminDisplayScenesPage() {
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
        fetch("/api/admin/display-scenes"),
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
  }, [])

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
          : "/api/admin/display-scenes",
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

    const res = await fetch(`/api/admin/display-scenes/${scene.id}/apply`, {
      method: "POST",
    })
    const json = (await res.json()) as { success?: boolean; error?: string }

    if (!res.ok || !json.success) {
      setError(json.error ?? "적용에 실패했습니다.")
      return
    }

    setMessage("Scene이 전광판에 적용되었습니다. 30초 이내에 반영됩니다.")
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
          Scene 관리
        </h2>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnPrimary}`}
          onClick={openCreateModal}
        >
          Scene 추가
        </button>
      </div>

      {message ? (
        <div className={`${styles.message} ${styles.messageSuccess}`}>{message}</div>
      ) : null}
      {error ? (
        <div className={`${styles.message} ${styles.messageError}`}>{error}</div>
      ) : null}

      <div className={styles.cardGrid}>
        {activeScenes.length === 0 ? (
          <div className={styles.panel}>등록된 Scene이 없습니다.</div>
        ) : (
          activeScenes.map((scene) => (
            <div key={scene.id} className={styles.card} style={{ cursor: "default" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <h3 className={styles.cardTitle}>{scene.name}</h3>
                {scene.is_current ? (
                  <span className={`${styles.badge} ${styles.badgeActive}`}>
                    적용 중
                  </span>
                ) : null}
              </div>
              <p className={styles.cardDesc}>
                {DISPLAY_MODE_LABELS[scene.mode]}
              </p>
              <p style={{ color: "#cbd5e1", fontSize: 14, margin: "0 0 12px" }}>
                {scene.summary}
              </p>

              {(scene.mode === "media_full" || scene.mode === "media_split") && (
                <div style={{ marginBottom: 12 }}>
                  <ScenePreviewFrame
                    mode={scene.mode}
                    fullAsset={scene.media_full_asset}
                    leftAsset={scene.media_left_asset}
                    rightAsset={scene.media_right_asset}
                  />
                </div>
              )}

              <div className={styles.buttonRow} style={{ marginTop: 12 }}>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnPrimary}`}
                  onClick={() => handleApply(scene)}
                >
                  적용
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
          ))
        )}
      </div>

      {showModal ? (
        <div className={styles.modalOverlay}>
          <div className={styles.modal} style={{ maxWidth: 720 }}>
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

              {(form.mode === "media_full" ||
                form.mode === "media_split" ||
                form.mode === "ranking" ||
                form.mode === "notice") && (
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
                    <p style={{ color: "#f87171", fontSize: 13, marginTop: 8 }}>
                      선택한 파일을 불러올 수 없어 전광판에 적용할 수 없습니다.
                    </p>
                  ) : null}
                </div>
              )}

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
          <div className={styles.modal} style={{ maxWidth: 960 }}>
            <h3 className={styles.modalTitle}>
              미리보기 · {previewScene.name}
            </h3>
            <ScenePreviewFrame
              mode={previewScene.mode}
              fullAsset={previewScene.media_full_asset}
              leftAsset={previewScene.media_left_asset}
              rightAsset={previewScene.media_right_asset}
              noticeTitle={previewScene.notice_title}
            />
            <div className={styles.buttonRow} style={{ marginTop: 16 }}>
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
          <div className={styles.modal} style={{ maxWidth: 960 }}>
            <h3 className={styles.modalTitle}>적용 전 미리보기</h3>
            <ScenePreviewFrame
              mode={form.mode}
              fullAsset={selectedFullAsset ?? null}
              leftAsset={selectedLeftAsset ?? null}
              rightAsset={selectedRightAsset ?? null}
              noticeTitle={selectedNotice?.title}
            />
            <div className={styles.buttonRow} style={{ marginTop: 16 }}>
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
