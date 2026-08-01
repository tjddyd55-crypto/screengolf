import type { DisplayMode } from "@/lib/admin/constants"

export type SceneListItem = {
  id: number
  name: string
  mode: DisplayMode
  sort_order: number
  is_active: boolean
  is_current: boolean
}

function sortByOrderThenId<T extends SceneListItem>(scenes: T[]): T[] {
  return [...scenes].sort((a, b) => {
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order
    return a.id - b.id
  })
}

/**
 * 현재 적용 Scene(별도 섹션)과 정렬 가능한 나머지를 분리한다.
 * DB sort_order는 변경하지 않는다.
 */
export function partitionScenesForDisplay<T extends SceneListItem>(
  scenes: T[],
): { current: T | null; rest: T[] } {
  const active = sortByOrderThenId(scenes.filter((scene) => scene.is_active))
  const current = active.find((scene) => scene.is_current) ?? null
  const rest = active.filter((scene) => !scene.is_current)
  return { current, rest }
}

/**
 * 화면 표시용 정렬 (검색 결과 등 단일 목록).
 * - 현재 송출 Scene은 항상 맨 앞
 * - 나머지는 sort_order ASC, id ASC
 * - DB sort_order 값은 변경하지 않음
 */
export function sortScenesForDisplay<T extends SceneListItem>(
  scenes: T[],
): T[] {
  const { current, rest } = partitionScenesForDisplay(scenes)
  return current ? [current, ...rest] : rest
}

/**
 * 현재 적용 Scene의 DB 위치를 유지한 채 rest만 재배치한 전체 ordered_ids.
 */
export function mergeReorderWithPinnedCurrent(
  previousOrderedIds: number[],
  currentId: number | null,
  nextRestIds: number[],
): number[] {
  if (currentId == null) return nextRestIds

  const currentIndex = previousOrderedIds.indexOf(currentId)
  if (currentIndex < 0) return [...nextRestIds, currentId]

  const next = [...nextRestIds]
  next.splice(currentIndex, 0, currentId)
  return next
}

export function filterScenesByName<T extends { name: string }>(
  scenes: T[],
  query: string,
): T[] {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return scenes
  return scenes.filter((scene) =>
    scene.name.toLowerCase().includes(normalized),
  )
}

export function getSceneListCounts(scenes: SceneListItem[]): {
  totalActive: number
  currentCount: number
} {
  const active = scenes.filter((scene) => scene.is_active)
  return {
    totalActive: active.length,
    currentCount: active.filter((scene) => scene.is_current).length,
  }
}

/**
 * 드래그 결과 순서 → 새 sort_order (1-based).
 */
export function buildSortOrderUpdates(
  orderedIds: number[],
): Array<{ id: number; sort_order: number }> {
  return orderedIds.map((id, index) => ({
    id,
    sort_order: index + 1,
  }))
}

export function moveSceneId(
  orderedIds: number[],
  fromIndex: number,
  toIndex: number,
): number[] {
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= orderedIds.length ||
    toIndex >= orderedIds.length ||
    fromIndex === toIndex
  ) {
    return orderedIds
  }
  const next = [...orderedIds]
  const [item] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, item)
  return next
}

export function formatDuplicatedSceneName(name: string): string {
  const base = name.trim() || "Scene"
  return `${base} (복사본)`
}
