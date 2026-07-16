import { getDb } from "./sqlite"
import {
  DISPLAY_MODES,
  DISPLAY_MODE_LABELS,
  type DisplayMode,
} from "@/lib/admin/constants"
import { getDisplayAssetById } from "./display-assets"
import { getNoticeById } from "./display-notices"
import { getDisplaySettings } from "./display-settings"
import {
  DEFAULT_DISPLAY_UNIT_CODE,
  resolveUnitId,
} from "./display-units"
import type { DisplaySceneView } from "@/lib/display/types"

export type DisplayScene = {
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
}

type SceneRow = {
  id: number
  display_unit_id: number
  name: string
  mode: DisplayMode
  notice_id: number | null
  media_full_file_id: number | null
  media_left_file_id: number | null
  media_right_file_id: number | null
  sort_order: number
  is_active: number
  created_at: string
  updated_at: string
}

function mapScene(row: SceneRow): DisplayScene {
  return {
    ...row,
    is_active: row.is_active === 1,
  }
}

function buildSummary(scene: DisplayScene): string {
  switch (scene.mode) {
    case "ranking":
      return "월간 랭킹 화면"
    case "notice": {
      if (!scene.notice_id) return "공지 미설정"
      const notice = getNoticeById(scene.notice_id)
      return notice ? `공지: ${notice.title}` : "공지 없음"
    }
    case "media_full": {
      if (!scene.media_full_file_id) return "파일 미설정"
      const asset = getDisplayAssetById(scene.media_full_file_id)
      return asset ? `전체: ${asset.title}` : "파일 없음"
    }
    case "media_split": {
      const left = scene.media_left_file_id
        ? getDisplayAssetById(scene.media_left_file_id)
        : null
      const right = scene.media_right_file_id
        ? getDisplayAssetById(scene.media_right_file_id)
        : null
      return `좌: ${left?.title ?? "-"} / 우: ${right?.title ?? "-"}`
    }
    default:
      return DISPLAY_MODE_LABELS[scene.mode]
  }
}

export function validateSceneConfig(input: {
  mode: DisplayMode
  notice_id?: number | null
  media_full_file_id?: number | null
  media_left_file_id?: number | null
  media_right_file_id?: number | null
}): void {
  if (!DISPLAY_MODES.includes(input.mode)) {
    throw new Error("유효하지 않은 mode입니다.")
  }

  if (input.mode === "ranking") return

  if (input.mode === "notice") {
    if (!input.notice_id) {
      throw new Error("공지사항 Scene에는 notice_id가 필요합니다.")
    }
    const notice = getNoticeById(input.notice_id)
    if (!notice) {
      throw new Error("공지사항을 찾을 수 없습니다.")
    }
    return
  }

  if (input.mode === "media_full") {
    if (!input.media_full_file_id) {
      throw new Error("가로 전체 화면 Scene에는 파일이 필요합니다.")
    }
    if (!getDisplayAssetById(input.media_full_file_id)) {
      throw new Error("전체 화면 파일을 찾을 수 없습니다.")
    }
    return
  }

  if (input.mode === "media_split") {
    if (!input.media_left_file_id || !input.media_right_file_id) {
      throw new Error("세로 2분할 Scene에는 왼쪽/오른쪽 파일이 모두 필요합니다.")
    }
    if (!getDisplayAssetById(input.media_left_file_id)) {
      throw new Error("왼쪽 파일을 찾을 수 없습니다.")
    }
    if (!getDisplayAssetById(input.media_right_file_id)) {
      throw new Error("오른쪽 파일을 찾을 수 없습니다.")
    }
  }
}

const SCENE_SELECT = `SELECT id, display_unit_id, name, mode, notice_id, media_full_file_id,
       media_left_file_id, media_right_file_id, sort_order, is_active, created_at, updated_at
       FROM display_scenes`

export function getDisplaySceneById(id: number): DisplayScene | null {
  const row = getDb()
    .prepare(`${SCENE_SELECT} WHERE id = ?`)
    .get(id) as SceneRow | undefined

  return row ? mapScene(row) : null
}

/** unitId 생략 시 Unit1(display-1) Scene만 조회 (기존 API 호환) */
export function listDisplayScenes(unitId?: number): DisplaySceneView[] {
  const resolvedUnitId =
    unitId ?? resolveUnitId(DEFAULT_DISPLAY_UNIT_CODE)
  const settings = getDisplaySettings(resolvedUnitId)
  const rows = getDb()
    .prepare(
      `${SCENE_SELECT}
       WHERE display_unit_id = ?
       ORDER BY sort_order ASC, id ASC`,
    )
    .all(resolvedUnitId) as SceneRow[]

  return rows.map((row) => {
    const scene = mapScene(row)
    const notice = scene.notice_id ? getNoticeById(scene.notice_id) : null

    return {
      ...scene,
      is_current: settings.current_scene_id === scene.id,
      notice_title: notice?.title ?? null,
      media_full_asset: scene.media_full_file_id
        ? getDisplayAssetById(scene.media_full_file_id)
        : null,
      media_left_asset: scene.media_left_file_id
        ? getDisplayAssetById(scene.media_left_file_id)
        : null,
      media_right_asset: scene.media_right_file_id
        ? getDisplayAssetById(scene.media_right_file_id)
        : null,
      summary: buildSummary(scene),
    }
  })
}

export function createDisplayScene(input: {
  name: string
  mode: DisplayMode
  display_unit_id?: number
  notice_id?: number | null
  media_full_file_id?: number | null
  media_left_file_id?: number | null
  media_right_file_id?: number | null
  sort_order?: number
  is_active?: boolean
}): DisplayScene {
  validateSceneConfig(input)

  const unitId =
    input.display_unit_id ?? resolveUnitId(DEFAULT_DISPLAY_UNIT_CODE)

  const maxSort = getDb()
    .prepare(
      `SELECT COALESCE(MAX(sort_order), 0) AS max_order
       FROM display_scenes WHERE display_unit_id = ?`,
    )
    .get(unitId) as { max_order: number }

  const result = getDb()
    .prepare(
      `INSERT INTO display_scenes (
        display_unit_id, name, mode, notice_id, media_full_file_id,
        media_left_file_id, media_right_file_id, sort_order, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      unitId,
      input.name,
      input.mode,
      input.notice_id ?? null,
      input.media_full_file_id ?? null,
      input.media_left_file_id ?? null,
      input.media_right_file_id ?? null,
      input.sort_order ?? maxSort.max_order + 1,
      (input.is_active ?? true) ? 1 : 0,
    )

  const scene = getDisplaySceneById(Number(result.lastInsertRowid))
  if (!scene) throw new Error("Scene 생성 후 조회에 실패했습니다.")
  return scene
}

export function updateDisplayScene(
  id: number,
  input: Partial<{
    name: string
    mode: DisplayMode
    notice_id: number | null
    media_full_file_id: number | null
    media_left_file_id: number | null
    media_right_file_id: number | null
    sort_order: number
    is_active: boolean
  }>,
): DisplayScene | null {
  const current = getDisplaySceneById(id)
  if (!current) return null

  const next = {
    mode: input.mode ?? current.mode,
    notice_id:
      input.notice_id !== undefined ? input.notice_id : current.notice_id,
    media_full_file_id:
      input.media_full_file_id !== undefined
        ? input.media_full_file_id
        : current.media_full_file_id,
    media_left_file_id:
      input.media_left_file_id !== undefined
        ? input.media_left_file_id
        : current.media_left_file_id,
    media_right_file_id:
      input.media_right_file_id !== undefined
        ? input.media_right_file_id
        : current.media_right_file_id,
  }

  validateSceneConfig(next)

  getDb()
    .prepare(
      `UPDATE display_scenes
       SET name = ?, mode = ?, notice_id = ?, media_full_file_id = ?,
           media_left_file_id = ?, media_right_file_id = ?, sort_order = ?,
           is_active = ?, updated_at = datetime('now')
       WHERE id = ?`,
    )
    .run(
      input.name ?? current.name,
      next.mode,
      next.notice_id,
      next.media_full_file_id,
      next.media_left_file_id,
      next.media_right_file_id,
      input.sort_order ?? current.sort_order,
      (input.is_active ?? current.is_active) ? 1 : 0,
      id,
    )

  return getDisplaySceneById(id)
}

export function deactivateDisplayScene(id: number): boolean {
  const scene = getDisplaySceneById(id)
  if (!scene) return false

  const settings = getDisplaySettings(scene.display_unit_id)
  if (settings.current_scene_id === id) {
    throw new Error("현재 적용 중인 화면은 삭제할 수 없습니다.")
  }

  const result = getDb()
    .prepare(
      "UPDATE display_scenes SET is_active = 0, updated_at = datetime('now') WHERE id = ?",
    )
    .run(id)

  return result.changes > 0
}

export function duplicateDisplayScene(id: number): DisplayScene | null {
  const scene = getDisplaySceneById(id)
  if (!scene) return null

  return createDisplayScene({
    display_unit_id: scene.display_unit_id,
    name: `${scene.name} 복사본`,
    mode: scene.mode,
    notice_id: scene.notice_id,
    media_full_file_id: scene.media_full_file_id,
    media_left_file_id: scene.media_left_file_id,
    media_right_file_id: scene.media_right_file_id,
    is_active: true,
  })
}

export function applyDisplayScene(id: number): DisplayScene {
  const scene = getDisplaySceneById(id)
  if (!scene || !scene.is_active) {
    throw new Error("적용할 Scene을 찾을 수 없습니다.")
  }

  validateSceneConfig(scene)

  getDb()
    .prepare(
      `UPDATE display_settings
       SET current_scene_id = ?, mode = ?, active_notice_id = ?,
           media_full_file_id = ?, media_left_file_id = ?, media_right_file_id = ?,
           updated_at = datetime('now')
       WHERE display_unit_id = ?`,
    )
    .run(
      scene.id,
      scene.mode,
      scene.notice_id,
      scene.media_full_file_id,
      scene.media_left_file_id,
      scene.media_right_file_id,
      scene.display_unit_id,
    )

  return scene
}

export function getRankingScene(unitId?: number): DisplayScene | null {
  const resolvedUnitId =
    unitId ?? resolveUnitId(DEFAULT_DISPLAY_UNIT_CODE)

  const row = getDb()
    .prepare(
      `${SCENE_SELECT}
       WHERE display_unit_id = ? AND mode = 'ranking' AND is_active = 1
       ORDER BY sort_order ASC, id ASC
       LIMIT 1`,
    )
    .get(resolvedUnitId) as SceneRow | undefined

  return row ? mapScene(row) : null
}
