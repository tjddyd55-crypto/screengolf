import type { DisplayMode } from "@/lib/admin/constants"
import type { DisplayBroadcastStatus } from "@/lib/display/broadcast-state"

export type DisplaySceneRef = {
  id: number
  name: string
}

export type DisplayMediaPayload = {
  id?: number
  title?: string
  originalName?: string
  fileUrl: string
  fileType: "image" | "pdf"
  mimeType: string
  fileMissing?: boolean
}

export type DisplaySettingsView = {
  id: number
  display_unit_id: number
  unit_code: string | null
  unit_name: string | null
  mode: DisplayMode
  current_scene_id: number | null
  active_notice_id: number | null
  media_full_file_id: number | null
  media_left_file_id: number | null
  media_right_file_id: number | null
  updated_at: string
  current_scene: DisplaySceneRef | null
  media_full_asset: import("@/lib/db/display-assets").DisplayAsset | null
  media_left_asset: import("@/lib/db/display-assets").DisplayAsset | null
  media_right_asset: import("@/lib/db/display-assets").DisplayAsset | null
}

type BroadcastMeta = {
  broadcastStatus?: DisplayBroadcastStatus
  hasRenderableContent?: boolean
}

export type DisplayStatePayload =
  | {
      mode: "off"
      broadcastStatus: "WAITING"
      hasRenderableContent: false
      scene?: null
    }
  | ({ mode: "ranking"; scene?: DisplaySceneRef } & BroadcastMeta)
  | ({
      mode: "notice"
      scene?: DisplaySceneRef
      notice: {
        id: number
        title: string
        body: string
        theme: string
      }
    } & BroadcastMeta)
  | ({
      mode: "media_full"
      scene?: DisplaySceneRef
      media: DisplayMediaPayload
    } & BroadcastMeta)
  | ({
      mode: "media_split"
      scene?: DisplaySceneRef
      left: DisplayMediaPayload
      right: DisplayMediaPayload
    } & BroadcastMeta)

export type DisplaySceneView = {
  id: number
  display_unit_id: number
  name: string
  mode: DisplayMode
  notice_id: number | null
  media_full_file_id: number | null
  media_left_file_id: number | null
  media_right_file_id: number | null
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
  is_current: boolean
  notice_title: string | null
  media_full_asset: import("@/lib/db/display-assets").DisplayAsset | null
  media_left_asset: import("@/lib/db/display-assets").DisplayAsset | null
  media_right_asset: import("@/lib/db/display-assets").DisplayAsset | null
  summary: string
}
