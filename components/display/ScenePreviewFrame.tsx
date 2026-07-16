"use client"

import DisplayMediaRenderer from "@/components/display/DisplayMediaRenderer"
import styles from "./preview-frame.module.css"

export type PreviewAsset = {
  id: number
  title: string
  file_url?: string
  fileUrl?: string
  file_type?: "image" | "pdf"
  fileType?: "image" | "pdf"
  mime_type?: string
  mimeType?: string
  original_name?: string
  originalName?: string
  file_missing?: boolean
  fileMissing?: boolean
}

type ScenePreviewFrameProps = {
  mode: "ranking" | "notice" | "media_full" | "media_split"
  fullAsset?: PreviewAsset | null
  leftAsset?: PreviewAsset | null
  rightAsset?: PreviewAsset | null
  noticeTitle?: string | null
  adminMode?: boolean
  large?: boolean
}

function resolveUrl(asset: PreviewAsset): string {
  return asset.file_url || asset.fileUrl || ""
}

function resolveType(asset: PreviewAsset): "image" | "pdf" {
  return asset.file_type || asset.fileType || "image"
}

function resolveMime(asset: PreviewAsset): string {
  return asset.mime_type || asset.mimeType || "image/png"
}

function isMissing(asset: PreviewAsset | null | undefined): boolean {
  if (!asset) return true
  return Boolean(asset.file_missing || asset.fileMissing)
}

export default function ScenePreviewFrame({
  mode,
  fullAsset,
  leftAsset,
  rightAsset,
  noticeTitle,
  adminMode = true,
  large = false,
}: ScenePreviewFrameProps) {
  return (
    <div className={`${styles.frame} ${large ? styles.frameLarge : ""}`}>
      {mode === "ranking" ? (
        <div className={styles.placeholder}>
          <span>🏆</span>
          <span>월간 랭킹 화면</span>
        </div>
      ) : null}

      {mode === "notice" ? (
        <div className={styles.placeholder}>
          <span>공지사항 화면</span>
          {noticeTitle ? (
            <span className={styles.placeholderSub}>{noticeTitle}</span>
          ) : null}
        </div>
      ) : null}

      {mode === "media_full" ? (
        !fullAsset ? (
          <div className={styles.placeholder}>
            <span className={styles.placeholderSub}>파일 미리보기</span>
          </div>
        ) : isMissing(fullAsset) ? (
          <div className={styles.missing}>
            원본 파일이 없어 다시 업로드가 필요합니다.
          </div>
        ) : (
          <DisplayMediaRenderer
            fileUrl={resolveUrl(fullAsset)}
            fileType={resolveType(fullAsset)}
            mimeType={resolveMime(fullAsset)}
            title={fullAsset.title}
            variant="full"
            adminMode={adminMode}
          />
        )
      ) : null}

      {mode === "media_split" ? (
        <div className={styles.split}>
          <div className={`${styles.splitPane} ${styles.splitPaneLeft}`}>
            {!leftAsset ? (
              <div className={styles.placeholder}>
                <span className={styles.placeholderSub}>왼쪽</span>
              </div>
            ) : isMissing(leftAsset) ? (
              <div className={styles.missing}>왼쪽 파일 누락</div>
            ) : (
              <DisplayMediaRenderer
                fileUrl={resolveUrl(leftAsset)}
                fileType={resolveType(leftAsset)}
                mimeType={resolveMime(leftAsset)}
                title={leftAsset.title}
                variant="split"
                adminMode={adminMode}
              />
            )}
          </div>
          <div className={styles.splitPane}>
            {!rightAsset ? (
              <div className={styles.placeholder}>
                <span className={styles.placeholderSub}>오른쪽</span>
              </div>
            ) : isMissing(rightAsset) ? (
              <div className={styles.missing}>오른쪽 파일 누락</div>
            ) : (
              <DisplayMediaRenderer
                fileUrl={resolveUrl(rightAsset)}
                fileType={resolveType(rightAsset)}
                mimeType={resolveMime(rightAsset)}
                title={rightAsset.title}
                variant="split"
                adminMode={adminMode}
              />
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
