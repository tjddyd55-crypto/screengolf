export const DISPLAY_MODES = [
  "ranking",
  "notice",
  "media_full",
  "media_split",
] as const
export type DisplayMode = (typeof DISPLAY_MODES)[number]

export const DISPLAY_MODE_LABELS: Record<DisplayMode, string> = {
  ranking: "랭킹 화면",
  notice: "공지사항",
  media_full: "가로 전체 화면",
  media_split: "세로 2분할 화면",
}

export const ASSET_LAYOUT_TYPES = ["full", "split_left", "split_right"] as const
export type AssetLayoutType = (typeof ASSET_LAYOUT_TYPES)[number]

export const ASSET_FILE_TYPES = ["image", "pdf"] as const
export type AssetFileType = (typeof ASSET_FILE_TYPES)[number]

export const ALLOWED_DISPLAY_MIMES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/pdf",
] as const

export const MAX_DISPLAY_FILE_SIZE = 20 * 1024 * 1024

export const NOTICE_THEMES = [
  "default",
  "event",
  "warning",
  "promotion",
] as const
export type NoticeTheme = (typeof NOTICE_THEMES)[number]

export const NOTICE_THEME_LABELS: Record<NoticeTheme, string> = {
  default: "기본",
  event: "이벤트",
  warning: "주의",
  promotion: "프로모션",
}
