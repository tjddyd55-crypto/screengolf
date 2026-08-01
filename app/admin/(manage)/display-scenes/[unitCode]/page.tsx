"use client"

import {
  FormEvent,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type DragEvent,
  type KeyboardEvent,
} from "react"
import Link from "next/link"
import styles from "../../../admin.module.css"
import {
  DISPLAY_MODE_LABELS,
  type DisplayMode,
} from "@/lib/admin/constants"
import ScenePreviewFrame from "@/components/display/ScenePreviewFrame"
import SceneManageCard, {
  type SceneCardData,
} from "@/components/admin/SceneManageCard"
import {
  getBroadcastStatusHint,
  getBroadcastStatusLabel,
  type DisplayBroadcastStatus,
} from "@/lib/display/broadcast-state"
import {
  filterScenesByName,
  getSceneListCounts,
  mergeReorderWithPinnedCurrent,
  moveSceneId,
  partitionScenesForDisplay,
  sortScenesForDisplay,
} from "@/lib/display/scene-list-ui"

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

type DisplayScene = SceneCardData & {
  notice_id: number | null
  media_full_file_id: number | null
  media_left_file_id: number | null
  media_right_file_id: number | null
  sort_order: number
  is_active: boolean
  summary: string
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

function isAssetMissing(
  asset:
    | {
        file_missing?: boolean
        fileMissing?: boolean
        status?: string
      }
    | null
    | undefined,
): boolean {
  if (!asset) return true
  return Boolean(asset.file_missing || asset.fileMissing || asset.status === "missing")
}

type PageProps = {
  params: Promise<{ unitCode: string }>
}

export default function AdminDisplayScenesPage({ params }: PageProps) {
  const { unitCode } = use(params)
  const scenesApi = `/api/admin/display-units/${encodeURIComponent(unitCode)}/scenes`
  const reorderApi = `${scenesApi}/reorder`
  const clearCurrentApi = `/api/admin/display-units/${encodeURIComponent(unitCode)}/clear-current`
  const settingsApi = `/api/admin/display-units/${encodeURIComponent(unitCode)}/settings`
  const storeHref =
    unitCode === "display-1"
      ? "/store/monthly-ranking-display"
      : unitCode === "display-2"
        ? "/store/monthly-ranking-display-2"
        : `/store/display/${encodeURIComponent(unitCode)}`

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
  const [searchQuery, setSearchQuery] = useState("")
  const [renamingId, setRenamingId] = useState<number | null>(null)
  const [renameValue, setRenameValue] = useState("")
  const [draggingId, setDraggingId] = useState<number | null>(null)
  const [dragOverId, setDragOverId] = useState<number | null>(null)
  const [showClearModal, setShowClearModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [broadcastStatus, setBroadcastStatus] =
    useState<DisplayBroadcastStatus>("WAITING")
  const [broadcastLabel, setBroadcastLabel] = useState("적용된 화면 없음")
  const [broadcastSceneName, setBroadcastSceneName] = useState<string | null>(
    null,
  )
  const [broadcastModeLabel, setBroadcastModeLabel] = useState<string | null>(
    null,
  )

  const loadData = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!options?.silent) setLoading(true)
      try {
        const [scenesRes, assetsRes, noticesRes, settingsRes] =
          await Promise.all([
            fetch(scenesApi),
            fetch("/api/admin/display-assets"),
            fetch("/api/admin/notices"),
            fetch(settingsApi),
          ])

        const scenesJson = (await scenesRes.json()) as { data?: DisplayScene[] }
        const assetsJson = (await assetsRes.json()) as { data?: DisplayAsset[] }
        const noticesJson = (await noticesRes.json()) as {
          data?: NoticeOption[]
        }
        const settingsJson = (await settingsRes.json()) as {
          data?: {
            broadcast_status?: DisplayBroadcastStatus
            broadcast_label?: string
            current_scene_name?: string | null
            mode_label?: string | null
          }
        }

        setScenes(scenesJson.data ?? [])
        setAssets(assetsJson.data ?? [])
        setNotices(noticesJson.data ?? [])
        const status = settingsJson.data?.broadcast_status ?? "WAITING"
        setBroadcastStatus(status)
        setBroadcastLabel(
          settingsJson.data?.broadcast_label ?? getBroadcastStatusLabel(status),
        )
        setBroadcastSceneName(settingsJson.data?.current_scene_name ?? null)
        setBroadcastModeLabel(settingsJson.data?.mode_label ?? null)
      } catch {
        setError("Scene 목록을 불러오지 못했습니다.")
      } finally {
        if (!options?.silent) setLoading(false)
      }
    },
    [scenesApi, settingsApi],
  )

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
          asset.layout_type === "split_left" ||
          asset.layout_type === "split_right",
      ),
    [assets],
  )

  const { current: currentScene, rest: restScenes } = useMemo(
    () => partitionScenesForDisplay(scenes),
    [scenes],
  )

  const displayScenes = useMemo(
    () => sortScenesForDisplay(scenes),
    [scenes],
  )

  const searching = Boolean(searchQuery.trim())

  const filteredScenes = useMemo(
    () => filterScenesByName(displayScenes, searchQuery),
    [displayScenes, searchQuery],
  )

  const counts = useMemo(() => getSceneListCounts(scenes), [scenes])

  const listScenes = searching ? filteredScenes : restScenes

  function openCreateModal() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setShowModal(true)
    setMessage("")
    setError("")
  }

  function openEditModal(scene: DisplayScene | SceneCardData) {
    const full = scenes.find((item) => item.id === scene.id)
    if (!full) return
    setEditingId(full.id)
    setForm({
      name: full.name,
      mode: full.mode,
      notice_id: full.notice_id ? String(full.notice_id) : "",
      media_full_file_id: full.media_full_file_id
        ? String(full.media_full_file_id)
        : "",
      media_left_file_id: full.media_left_file_id
        ? String(full.media_left_file_id)
        : "",
      media_right_file_id: full.media_right_file_id
        ? String(full.media_right_file_id)
        : "",
      sort_order: String(full.sort_order),
      is_active: full.is_active,
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

  async function saveScene(applyAfter: boolean) {
    setMessage("")
    setError("")

    if (formMediaInvalid) {
      setError("선택한 파일을 불러올 수 없어 전광판에 적용할 수 없습니다.")
      return
    }

    if (!form.name.trim()) {
      setError("Scene 이름은 필수입니다.")
      return
    }

    setSaving(true)
    try {
      const res = await fetch(
        editingId ? `/api/admin/display-scenes/${editingId}` : scenesApi,
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildPayload()),
        },
      )
      const json = (await res.json()) as {
        success?: boolean
        error?: string
        data?: { id: number; name?: string }
      }

      if (!res.ok || !json.success || !json.data?.id) {
        setError(json.error ?? "저장에 실패했습니다.")
        return
      }

      const savedId = json.data.id
      const savedName = json.data.name ?? form.name

      if (applyAfter) {
        const applyRes = await fetch(
          `/api/admin/display-scenes/${savedId}/apply`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ unitCode }),
          },
        )
        const applyJson = (await applyRes.json()) as {
          success?: boolean
          error?: string
        }
        if (!applyRes.ok || !applyJson.success) {
          setShowModal(false)
          setError(
            applyJson.error ??
              "Scene은 저장되었지만 적용에 실패했습니다. 목록에서 다시 적용해 주세요.",
          )
          await loadData({ silent: true })
          return
        }
        setMessage(`'${savedName}' Scene을 저장하고 적용했습니다.`)
      } else {
        setMessage(
          editingId
            ? "Scene이 수정되었습니다. (송출 상태는 변경되지 않았습니다.)"
            : "Scene이 생성되었습니다. (송출 상태는 변경되지 않았습니다.)",
        )
      }

      setShowModal(false)
      await loadData({ silent: true })
    } catch {
      setError("저장 중 오류가 발생했습니다.")
    } finally {
      setSaving(false)
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    await saveScene(false)
  }

  async function handleClearCurrent() {
    setError("")
    const res = await fetch(clearCurrentApi, { method: "POST" })
    const json = (await res.json()) as { success?: boolean; error?: string }
    if (!res.ok || !json.success) {
      setError(json.error ?? "현재 화면 해제에 실패했습니다.")
      return
    }
    setShowClearModal(false)
    setMessage("현재 적용 화면을 해제했습니다. Scene과 파일은 유지됩니다.")
    await loadData({ silent: true })
  }

  async function handleApply(scene: SceneCardData) {
    setError("")

    const full = scenes.find((item) => item.id === scene.id)
    if (!full) return

    if (
      (full.mode === "media_full" && isAssetMissing(full.media_full_asset)) ||
      (full.mode === "media_split" &&
        (isAssetMissing(full.media_left_asset) ||
          isAssetMissing(full.media_right_asset)))
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
      `'${full.name}' Scene을 ${unitLabel}에 적용할까요?\n\n다른 전광판 화면에는 영향을 주지 않습니다.\n${unitLabel}는 최대 30초 이내에 전환됩니다.`,
    )
    if (!confirmed) return

    const res = await fetch(`/api/admin/display-scenes/${full.id}/apply`, {
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
      `${unitLabel}에 '${full.name}' 화면을 적용했습니다. 최대 30초 이내에 반영됩니다.`,
    )
    await loadData({ silent: true })
  }

  async function handleDuplicate(id: number) {
    setError("")
    const res = await fetch(`/api/admin/display-scenes/${id}/duplicate`, {
      method: "POST",
    })
    const json = (await res.json()) as {
      success?: boolean
      error?: string
      data?: DisplayScene
    }

    if (!res.ok || !json.success) {
      setError(json.error ?? "복제에 실패했습니다.")
      return
    }

    setMessage("Scene이 복제되었습니다.")
    await loadData({ silent: true })
  }

  async function handleDeactivate(id: number) {
    const target = scenes.find((scene) => scene.id === id)
    const confirmMessage = target?.is_current
      ? "현재 적용 중인 Scene을 비활성화하면 전광판이 적용된 화면 없음 상태로 변경됩니다."
      : "이 Scene을 비활성 처리하시겠습니까?"
    if (!window.confirm(confirmMessage)) return

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
    await loadData({ silent: true })
  }

  function startRename(scene: SceneCardData) {
    setRenamingId(scene.id)
    setRenameValue(scene.name)
  }

  async function commitRename() {
    if (renamingId == null) return
    const targetId = renamingId
    const nextName = renameValue.trim()
    if (!nextName) {
      setError("Scene 이름은 비울 수 없습니다.")
      setRenamingId(null)
      return
    }

    const current = scenes.find((scene) => scene.id === targetId)
    if (!current || current.name === nextName) {
      setRenamingId(null)
      return
    }

    setError("")
    const res = await fetch(`/api/admin/display-scenes/${targetId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: nextName }),
    })
    const json = (await res.json()) as { success?: boolean; error?: string }

    setRenamingId(null)
    if (!res.ok || !json.success) {
      setError(json.error ?? "이름 변경에 실패했습니다.")
      return
    }

    setScenes((prev) =>
      prev.map((scene) =>
        scene.id === targetId ? { ...scene, name: nextName } : scene,
      ),
    )
    setMessage("Scene 이름이 변경되었습니다.")
  }

  function handleRenameKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault()
      void commitRename()
    }
    if (event.key === "Escape") {
      event.preventDefault()
      setRenamingId(null)
    }
  }

  async function persistOrder(orderedIds: number[]) {
    setError("")
    const previous = scenes
    setScenes((prev) =>
      prev.map((scene) => {
        const index = orderedIds.indexOf(scene.id)
        if (index < 0) return scene
        return { ...scene, sort_order: index + 1 }
      }),
    )

    const res = await fetch(reorderApi, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ordered_ids: orderedIds }),
    })
    const json = (await res.json()) as {
      success?: boolean
      error?: string
      data?: DisplayScene[]
    }

    if (!res.ok || !json.success) {
      setScenes(previous)
      setError(json.error ?? "순서 저장에 실패했습니다.")
      return
    }

    if (json.data) setScenes(json.data)
  }

  function handleDragStart(event: DragEvent<HTMLElement>, sceneId: number) {
    if (searching) {
      event.preventDefault()
      return
    }
    setDraggingId(sceneId)
    event.dataTransfer.effectAllowed = "move"
    event.dataTransfer.setData("text/plain", String(sceneId))
  }

  function handleDragOver(event: DragEvent<HTMLElement>, sceneId: number) {
    if (searching) return
    event.preventDefault()
    event.dataTransfer.dropEffect = "move"
    if (dragOverId !== sceneId) setDragOverId(sceneId)
  }

  function handleDragLeave(sceneId: number) {
    if (dragOverId === sceneId) setDragOverId(null)
  }

  async function handleDrop(event: DragEvent<HTMLElement>, targetId: number) {
    event.preventDefault()
    if (searching) {
      setDragOverId(null)
      setDraggingId(null)
      return
    }
    const sourceId = Number(
      event.dataTransfer.getData("text/plain") || draggingId || "",
    )
    setDragOverId(null)
    setDraggingId(null)
    if (!sourceId || sourceId === targetId) return

    const restIds = restScenes.map((scene) => scene.id)
    const fromIndex = restIds.indexOf(sourceId)
    const toIndex = restIds.indexOf(targetId)
    if (fromIndex < 0 || toIndex < 0) return

    const nextRestIds = moveSceneId(restIds, fromIndex, toIndex)
    const previousFull = displayScenes.map((scene) => scene.id)
    const fullIds = mergeReorderWithPinnedCurrent(
      previousFull,
      currentScene?.id ?? null,
      nextRestIds,
    )
    await persistOrder(fullIds)
  }

  function handleDragEnd() {
    setDraggingId(null)
    setDragOverId(null)
  }

  async function handleHandleKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    sceneId: number,
  ) {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return
    if (searching) return
    event.preventDefault()

    const restIds = restScenes.map((scene) => scene.id)
    const index = restIds.indexOf(sceneId)
    if (index < 0) return
    const targetIndex = event.key === "ArrowUp" ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= restIds.length) return

    const nextRestIds = moveSceneId(restIds, index, targetIndex)
    const previousFull = displayScenes.map((scene) => scene.id)
    await persistOrder(
      mergeReorderWithPinnedCurrent(
        previousFull,
        currentScene?.id ?? null,
        nextRestIds,
      ),
    )
  }

  if (loading) {
    return <p>불러오는 중...</p>
  }

  const bannerClass =
    broadcastStatus === "BROADCASTING"
      ? styles.displayUnitCardBroadcasting
      : styles.displayUnitCardWaiting
  const liveClass =
    broadcastStatus === "BROADCASTING"
      ? styles.liveStatus
      : `${styles.liveStatus} ${styles.liveStatusWaiting}`
  const appliedSceneDisplayName =
    broadcastSceneName ??
    currentScene?.name ??
    broadcastModeLabel ??
    "—"

  return (
    <>
      <Link href="/admin" className={styles.backLink}>
        ← 관리자 홈
      </Link>

      <div className={styles.pageHeader}>
        <h2 className={styles.pageTitle}>Scene 관리 · {unitCode}</h2>
        <div className={styles.buttonRow}>
          <Link
            href={storeHref}
            target="_blank"
            className={`${styles.btn} ${styles.btnSecondary}`}
          >
            전광판 보기
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

      <div
        className={`${styles.panel} ${styles.currentAppliedBanner} ${styles.broadcastBanner} ${bannerClass}`}
      >
        <p className={liveClass}>
          <span className={styles.liveStatusDot} aria-hidden="true" />
          {broadcastLabel}
        </p>
        <p className={styles.appliedSceneName}>
          {broadcastStatus === "BROADCASTING"
            ? `현재 적용 화면: ${appliedSceneDisplayName}`
            : "현재 적용된 Scene이 없습니다."}
        </p>
        {broadcastStatus === "WAITING" ? (
          <p className={styles.appliedMetaLine}>
            {getBroadcastStatusHint(broadcastStatus)}
          </p>
        ) : broadcastModeLabel || currentScene ? (
          <p className={styles.appliedModeLine}>
            {broadcastModeLabel ??
              (currentScene
                ? DISPLAY_MODE_LABELS[currentScene.mode]
                : null)}
          </p>
        ) : null}
        {broadcastStatus === "BROADCASTING" ? (
          <div className={styles.broadcastBannerActions}>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnSecondary}`}
              onClick={() => setShowClearModal(true)}
            >
              현재 화면 해제
            </button>
          </div>
        ) : null}
      </div>

      <div className={styles.sceneToolbar}>
        <div className={styles.sceneCounts}>
          <span>Scene {counts.totalActive}개</span>
          <span>현재 송출중 {counts.currentCount}개</span>
        </div>
        <label className={styles.sceneSearchLabel}>
          <span className={styles.srOnly}>Scene 검색</span>
          <input
            className={`${styles.formInput} ${styles.sceneSearchInput}`}
            type="search"
            placeholder="Scene 이름 검색"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            aria-label="Scene 이름 검색"
          />
        </label>
      </div>

      {message ? (
        <div className={`${styles.message} ${styles.messageSuccess}`}>
          {message}
        </div>
      ) : null}
      {error ? (
        <div className={`${styles.message} ${styles.messageError}`}>{error}</div>
      ) : null}

      {counts.totalActive === 0 ? (
        <div className={`${styles.panel} ${styles.sceneEmptyState}`}>
          <p className={styles.sceneEmptyTitle}>Scene가 없습니다.</p>
          <p className={styles.sceneEmptyDesc}>첫 Scene을 만들어보세요.</p>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={openCreateModal}
          >
            + Scene 만들기
          </button>
        </div>
      ) : searching && filteredScenes.length === 0 ? (
        <div className={`${styles.panel} ${styles.sceneEmptyState}`}>
          <p className={styles.sceneEmptyTitle}>검색 결과가 없습니다.</p>
        </div>
      ) : (
        <>
          {!searching && currentScene ? (
            <div className={styles.sceneCurrentSection}>
              <p className={styles.sceneCurrentSectionLabel}>현재 적용</p>
              <div className={styles.sceneGrid}>
                <SceneManageCard
                  scene={currentScene}
                  renaming={renamingId === currentScene.id}
                  renameValue={renameValue}
                  dragOver={false}
                  reorderEnabled={false}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onDragEnd={handleDragEnd}
                  onHandleKeyDown={handleHandleKeyDown}
                  onStartRename={startRename}
                  onRenameChange={setRenameValue}
                  onRenameKeyDown={handleRenameKeyDown}
                  onRenameBlur={() => {
                    void commitRename()
                  }}
                  onApply={handleApply}
                  onDuplicate={handleDuplicate}
                  onEdit={openEditModal}
                  onDeactivate={handleDeactivate}
                  onPreview={(item) => {
                    const full = scenes.find(
                      (sceneItem) => sceneItem.id === item.id,
                    )
                    if (full) setPreviewScene(full)
                  }}
                />
              </div>
            </div>
          ) : null}
          {listScenes.length > 0 ? (
            <>
              {!searching && restScenes.length > 0 ? (
                <p className={styles.sceneRestSectionLabel}>다른 Scene</p>
              ) : null}
              <div className={styles.sceneGrid}>
                {listScenes.map((scene) => (
                  <SceneManageCard
                    key={scene.id}
                    scene={scene}
                    renaming={renamingId === scene.id}
                    renameValue={renameValue}
                    dragOver={dragOverId === scene.id}
                    reorderEnabled={!searching && !scene.is_current}
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onDragEnd={handleDragEnd}
                    onHandleKeyDown={handleHandleKeyDown}
                    onStartRename={startRename}
                    onRenameChange={setRenameValue}
                    onRenameKeyDown={handleRenameKeyDown}
                    onRenameBlur={() => {
                      void commitRename()
                    }}
                    onApply={handleApply}
                    onDuplicate={handleDuplicate}
                    onEdit={openEditModal}
                    onDeactivate={handleDeactivate}
                    onPreview={(item) => {
                      const full = scenes.find(
                        (sceneItem) => sceneItem.id === item.id,
                      )
                      if (full) setPreviewScene(full)
                    }}
                  />
                ))}
              </div>
            </>
          ) : null}
        </>
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
                        setForm({
                          ...form,
                          media_right_file_id: e.target.value,
                        })
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
                  onChange={(e) =>
                    setForm({ ...form, sort_order: e.target.value })
                  }
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
                  type="button"
                  className={`${styles.btn} ${styles.btnSecondary}`}
                  disabled={saving}
                  onClick={() => setShowModal(false)}
                >
                  취소
                </button>
                <button
                  type="submit"
                  className={`${styles.btn} ${styles.btnSecondary}`}
                  disabled={formMediaInvalid || saving}
                >
                  Scene 저장
                </button>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnPrimary}`}
                  disabled={formMediaInvalid || saving}
                  onClick={() => {
                    void saveScene(true)
                  }}
                >
                  저장 후 적용
                </button>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnSecondary}`}
                  disabled={saving}
                  onClick={() => setShowFormPreview(true)}
                >
                  미리보기
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

      {showClearModal ? (
        <div
          className={styles.modalOverlay}
          role="dialog"
          aria-modal="true"
          aria-labelledby="clear-current-title"
        >
          <div className={styles.modal}>
            <h3 id="clear-current-title" className={styles.modalTitle}>
              현재 적용 화면을 해제할까요?
            </h3>
            <p className={styles.cardDesc}>
              전광판에는 적용된 화면이 없는 상태로 표시됩니다.
            </p>
            <p className={styles.cardDesc}>
              Scene과 업로드 파일은 삭제되지 않습니다.
            </p>
            <div className={styles.buttonRow}>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnSecondary}`}
                onClick={() => setShowClearModal(false)}
              >
                취소
              </button>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnDanger}`}
                onClick={() => {
                  void handleClearCurrent()
                }}
              >
                화면 해제
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
