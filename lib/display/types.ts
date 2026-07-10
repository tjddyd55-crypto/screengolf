import type { DisplayMode } from "@/lib/admin/constants"

export type DisplaySceneRef = {
  id: number
  name: string
}

export type DisplayMediaPayload = {
  fileUrl: string
  fileType: "image" | "pdf"
  mimeType: string
}

export type DisplayStatePayload =
  | { mode: "ranking"; scene?: DisplaySceneRef }
  | {
      mode: "notice"
      scene?: DisplaySceneRef
      notice: {
        id: number
        title: string
        body: string
        theme: string
      }
    }
  | {
      mode: "media_full"
      scene?: DisplaySceneRef
      media: DisplayMediaPayload
    }
  | {
      mode: "media_split"
      scene?: DisplaySceneRef
      left: DisplayMediaPayload
      right: DisplayMediaPayload
    }

export type DisplaySettingsView = {
  id: number
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

export type DisplaySceneView = {
  id: number
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
