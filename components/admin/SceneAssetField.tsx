"use client"

import { useId, useRef, useState } from "react"
import styles from "@/app/admin/admin.module.css"
import type { AssetLayoutType } from "@/lib/admin/constants"
import {
  SCENE_ASSET_ACCEPT,
  SCENE_ASSET_ACCEPT_HINT,
  uploadDisplayAssetFile,
  validateClientUploadFile,
  type UploadedDisplayAsset,
} from "@/lib/display/scene-asset-upload"

export type SceneAssetOption = {
  id: number
  title: string
  original_name?: string
  originalName?: string
  mime_type?: string
  sizeLabel?: string | null
  file_missing?: boolean
  fileMissing?: boolean
  status?: string
}

function optionLabel(asset: SceneAssetOption): string {
  const original = (asset.original_name || asset.originalName || "").trim()
  const title = (asset.title || "").trim()
  const displayName = original || title || `파일 #${asset.id}`
  const format = (asset.mime_type || "").split("/")[1]?.toUpperCase() || ""
  const size = asset.sizeLabel ? ` · ${asset.sizeLabel}` : ""
  const missing =
    asset.file_missing || asset.fileMissing || asset.status === "missing"
      ? " · 파일 누락"
      : ""
  return `${displayName}${format ? ` · ${format}` : ""}${size}${missing}`
}

type SceneAssetFieldProps = {
  label: string
  value: string
  assets: SceneAssetOption[]
  layoutType: AssetLayoutType
  required?: boolean
  disabled?: boolean
  onChange: (assetId: string) => void
  onUploaded: (asset: UploadedDisplayAsset) => void
  onLoadingChange?: (loading: boolean) => void
}

export default function SceneAssetField({
  label,
  value,
  assets,
  layoutType,
  required = true,
  disabled = false,
  onChange,
  onUploaded,
  onLoadingChange,
}: SceneAssetFieldProps) {
  const inputId = useId()
  const selectId = useId()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [lastFileName, setLastFileName] = useState("")

  function setUploadLoading(next: boolean) {
    setLoading(next)
    onLoadingChange?.(next)
  }

  async function handleFileChange(fileList: FileList | null) {
    const file = fileList?.[0]
    if (!file) return

    setLastFileName(file.name)
    setError("")

    const clientCheck = validateClientUploadFile(file)
    if (!clientCheck.ok) {
      setError(clientCheck.error)
      if (fileInputRef.current) fileInputRef.current.value = ""
      return
    }

    setUploadLoading(true)
    try {
      const asset = await uploadDisplayAssetFile({
        file,
        layoutType,
        title: file.name,
      })
      onUploaded(asset)
      onChange(String(asset.id))
      setLastFileName(asset.originalName || asset.original_name || file.name)
    } catch (uploadError) {
      const message =
        uploadError instanceof Error
          ? uploadError.message
          : "파일 업로드에 실패했습니다."
      setError(message)
    } finally {
      setUploadLoading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  return (
    <div className={styles.formGroup}>
      <label className={styles.formLabel} htmlFor={selectId}>
        {label}
      </label>
      <select
        id={selectId}
        className={styles.formSelect}
        value={value}
        disabled={disabled || loading}
        required={required}
        onChange={(event) => {
          setError("")
          onChange(event.target.value)
        }}
      >
        <option value="">파일 선택</option>
        {assets.map((asset) => (
          <option key={asset.id} value={asset.id}>
            {optionLabel(asset)}
          </option>
        ))}
      </select>

      <p className={styles.formHint} style={{ marginTop: 8 }}>
        또는
      </p>

      <label
        className={`${styles.btn} ${styles.btnSecondary} ${styles.sceneUploadButton}`}
        htmlFor={inputId}
        aria-busy={loading}
      >
        {loading ? "업로드 중..." : "파일 업로드"}
      </label>
      <input
        id={inputId}
        ref={fileInputRef}
        className={styles.sceneUploadInput}
        type="file"
        accept={SCENE_ASSET_ACCEPT}
        disabled={disabled || loading}
        onChange={(event) => {
          void handleFileChange(event.target.files)
        }}
      />
      <p className={styles.formHint}>{SCENE_ASSET_ACCEPT_HINT}</p>
      {lastFileName ? (
        <p className={styles.cardMeta} title={lastFileName}>
          {loading ? `업로드 중 · ${lastFileName}` : `선택 파일 · ${lastFileName}`}
        </p>
      ) : null}
      {error ? (
        <p className={styles.formError} aria-live="polite" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
