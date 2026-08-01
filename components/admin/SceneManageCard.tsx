"use client"

import {
  memo,
  type DragEvent,
  type KeyboardEvent,
  type MouseEvent,
} from "react"
import ScenePreviewFrame from "@/components/display/ScenePreviewFrame"
import {
  DISPLAY_MODE_LABELS,
  type DisplayMode,
} from "@/lib/admin/constants"
import styles from "@/app/admin/admin.module.css"

export type SceneCardAsset = {
  id: number
  title: string
  file_url: string
  fileUrl?: string
  file_type: "image" | "pdf"
  mime_type: string
  original_name?: string
  originalName?: string
  file_missing?: boolean
  fileMissing?: boolean
  status?: string
}

export type SceneCardData = {
  id: number
  name: string
  mode: DisplayMode
  is_current: boolean
  notice_title: string | null
  media_full_asset: SceneCardAsset | null
  media_left_asset: SceneCardAsset | null
  media_right_asset: SceneCardAsset | null
}

function displayFileName(asset: SceneCardAsset | null | undefined): string {
  if (!asset) return ""
  const title = (asset.title || "").trim()
  const original = (asset.original_name || asset.originalName || "").trim()
  return title || original || `파일 #${asset.id}`
}

function sceneConnectedFiles(scene: SceneCardData): {
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

type SceneManageCardProps = {
  scene: SceneCardData
  renaming: boolean
  renameValue: string
  dragOver: boolean
  /** 검색 중이거나 현재 적용(pinned) 카드면 순서 변경 비활성 */
  reorderEnabled?: boolean
  onDragStart: (event: DragEvent<HTMLElement>, sceneId: number) => void
  onDragOver: (event: DragEvent<HTMLElement>, sceneId: number) => void
  onDragLeave: (sceneId: number) => void
  onDrop: (event: DragEvent<HTMLElement>, sceneId: number) => void
  onDragEnd: () => void
  onHandleKeyDown: (
    event: KeyboardEvent<HTMLButtonElement>,
    sceneId: number,
  ) => void
  onStartRename: (scene: SceneCardData) => void
  onRenameChange: (value: string) => void
  onRenameKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void
  onRenameBlur: () => void
  onApply: (scene: SceneCardData) => void
  onDuplicate: (sceneId: number) => void
  onEdit: (scene: SceneCardData) => void
  onDeactivate: (sceneId: number) => void
  onPreview: (scene: SceneCardData) => void
}

function SceneManageCard({
  scene,
  renaming,
  renameValue,
  dragOver,
  reorderEnabled = true,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  onHandleKeyDown,
  onStartRename,
  onRenameChange,
  onRenameKeyDown,
  onRenameBlur,
  onApply,
  onDuplicate,
  onEdit,
  onDeactivate,
  onPreview,
}: SceneManageCardProps) {
  const connected = sceneConnectedFiles(scene)
  const canReorder = reorderEnabled && !renaming

  function stopDragBubble(event: MouseEvent) {
    event.stopPropagation()
  }

  return (
    <article
      className={`${styles.card} ${styles.cardStatic} ${styles.sceneCard} ${
        scene.is_current ? `${styles.cardApplied} ${styles.sceneCardCurrent}` : ""
      } ${dragOver ? styles.sceneCardDragOver : ""}`}
      draggable={canReorder}
      onDragStart={(event) => {
        if (!canReorder) {
          event.preventDefault()
          return
        }
        onDragStart(event, scene.id)
      }}
      onDragOver={(event) => {
        if (!canReorder) return
        onDragOver(event, scene.id)
      }}
      onDragLeave={() => {
        if (!canReorder) return
        onDragLeave(scene.id)
      }}
      onDrop={(event) => {
        if (!canReorder) return
        onDrop(event, scene.id)
      }}
      onDragEnd={onDragEnd}
      data-scene-id={scene.id}
      data-current={scene.is_current ? "true" : "false"}
    >
      <div className={styles.sceneCardToolbar}>
        <button
          type="button"
          className={styles.sceneDragHandle}
          aria-label={`${scene.name} 순서 변경`}
          title={
            canReorder
              ? "드래그하거나 방향키로 순서 변경"
              : "현재 적용 Scene은 별도 섹션에 고정됩니다"
          }
          disabled={!canReorder}
          onKeyDown={(event) => onHandleKeyDown(event, scene.id)}
          onMouseDown={stopDragBubble}
        >
          ☰
        </button>
        {scene.is_current ? (
          <span className={`${styles.badge} ${styles.badgeApplied}`}>
            현재 송출중
          </span>
        ) : null}
      </div>

      <div className={`${styles.cardPreview} ${styles.sceneCardPreview}`}>
        <ScenePreviewFrame
          mode={scene.mode}
          fullAsset={scene.media_full_asset}
          leftAsset={scene.media_left_asset}
          rightAsset={scene.media_right_asset}
          noticeTitle={scene.notice_title}
        />
      </div>

      <div className={styles.cardHeader}>
        {renaming ? (
          <input
            className={`${styles.formInput} ${styles.sceneRenameInput}`}
            value={renameValue}
            aria-label="Scene 이름 수정"
            autoFocus
            onChange={(event) => onRenameChange(event.target.value)}
            onKeyDown={onRenameKeyDown}
            onBlur={onRenameBlur}
          />
        ) : (
          <div className={styles.sceneTitleRow}>
            <h3
              className={`${styles.cardTitle} ${styles.sceneCardTitle}`}
              title={scene.name}
            >
              {scene.name}
            </h3>
            <button
              type="button"
              className={styles.sceneRenameButton}
              aria-label={`${scene.name} 이름 변경`}
              onClick={() => onStartRename(scene)}
            >
              ✏️
            </button>
          </div>
        )}
      </div>

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

      <div className={`${styles.cardActions} ${styles.sceneCardActions}`}>
        <div className={styles.sceneCardActionsRow}>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnPrimary}`}
            disabled={scene.is_current}
            aria-label={
              scene.is_current
                ? `${scene.name} 적용중`
                : `${scene.name} 적용`
            }
            onClick={() => onApply(scene)}
          >
            {scene.is_current ? "적용중" : "적용"}
          </button>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnSecondary}`}
            aria-label={`${scene.name} 복제`}
            onClick={() => onDuplicate(scene.id)}
          >
            복제
          </button>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnSecondary}`}
            aria-label={`${scene.name} 수정`}
            onClick={() => onEdit(scene)}
          >
            수정
          </button>
        </div>
        <div className={styles.sceneCardActionsRowSecondary}>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnSecondary}`}
            aria-label={`${scene.name} 미리보기`}
            onClick={() => onPreview(scene)}
          >
            미리보기
          </button>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnDanger}`}
            aria-label={`${scene.name} 비활성`}
            onClick={() => onDeactivate(scene.id)}
          >
            비활성
          </button>
        </div>
      </div>
    </article>
  )
}

export default memo(SceneManageCard)
