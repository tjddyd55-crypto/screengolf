import { describe, expect, it } from "vitest"
import {
  buildSortOrderUpdates,
  filterScenesByName,
  formatDuplicatedSceneName,
  getSceneListCounts,
  mergeReorderWithPinnedCurrent,
  moveSceneId,
  partitionScenesForDisplay,
  sortScenesForDisplay,
  type SceneListItem,
} from "@/lib/display/scene-list-ui"

function scene(
  partial: Partial<SceneListItem> & Pick<SceneListItem, "id" | "name">,
): SceneListItem {
  return {
    mode: "ranking",
    sort_order: partial.sort_order ?? partial.id,
    is_active: true,
    is_current: false,
    ...partial,
  }
}

describe("scene-list-ui", () => {
  it("현재 송출 Scene을 항상 첫 번째로 올린다", () => {
    const list = sortScenesForDisplay([
      scene({ id: 1, name: "기본 랭킹", sort_order: 1 }),
      scene({ id: 2, name: "여름 이벤트", sort_order: 2 }),
      scene({ id: 3, name: "더위사냥", sort_order: 3, is_current: true }),
      scene({ id: 4, name: "공지", sort_order: 4 }),
    ])
    expect(list.map((s) => s.name)).toEqual([
      "더위사냥",
      "기본 랭킹",
      "여름 이벤트",
      "공지",
    ])
  })

  it("partition: 현재 적용은 별도, 나머지는 sort_order", () => {
    const { current, rest } = partitionScenesForDisplay([
      scene({ id: 1, name: "A", sort_order: 1 }),
      scene({ id: 2, name: "B", sort_order: 2, is_current: true }),
      scene({ id: 3, name: "C", sort_order: 3 }),
    ])
    expect(current?.name).toBe("B")
    expect(rest.map((s) => s.name)).toEqual(["A", "C"])
  })

  it("비활성 Scene은 표시 목록에서 제외한다", () => {
    const list = sortScenesForDisplay([
      scene({ id: 1, name: "활성", sort_order: 1 }),
      scene({ id: 2, name: "비활성", sort_order: 2, is_active: false }),
    ])
    expect(list).toHaveLength(1)
    expect(list[0]?.name).toBe("활성")
  })

  it("검색은 이름 부분일치·대소문자 무시", () => {
    const source = [
      scene({ id: 1, name: "더위사냥" }),
      scene({ id: 2, name: "Summer Event" }),
      scene({ id: 3, name: "공지" }),
    ]
    expect(filterScenesByName(source, "더위").map((s) => s.id)).toEqual([1])
    expect(filterScenesByName(source, "summer").map((s) => s.id)).toEqual([2])
    expect(filterScenesByName(source, "  ").map((s) => s.id)).toEqual([1, 2, 3])
  })

  it("검색 결과가 없으면 빈 배열", () => {
    expect(
      filterScenesByName([scene({ id: 1, name: "공지" })], "없는이름"),
    ).toEqual([])
  })

  it("개수 요약", () => {
    expect(
      getSceneListCounts([
        scene({ id: 1, name: "A", is_current: true }),
        scene({ id: 2, name: "B" }),
        scene({ id: 3, name: "C", is_active: false }),
      ]),
    ).toEqual({ totalActive: 2, currentCount: 1 })
  })

  it("드래그 순서에서 sort_order 업데이트를 만든다", () => {
    expect(buildSortOrderUpdates([3, 1, 2])).toEqual([
      { id: 3, sort_order: 1 },
      { id: 1, sort_order: 2 },
      { id: 2, sort_order: 3 },
    ])
  })

  it("키보드 이동으로 id 순서를 바꾼다", () => {
    expect(moveSceneId([1, 2, 3], 0, 2)).toEqual([2, 3, 1])
    expect(moveSceneId([1, 2, 3], 2, 0)).toEqual([3, 1, 2])
    expect(moveSceneId([1, 2, 3], 1, 1)).toEqual([1, 2, 3])
  })

  it("pinned current의 DB 위치를 유지하며 rest만 병합한다", () => {
    // previous display order: current(2) first for UI, but DB order was 1,2,3
    expect(mergeReorderWithPinnedCurrent([1, 2, 3], 2, [3, 1])).toEqual([
      3, 2, 1,
    ])
    expect(mergeReorderWithPinnedCurrent([2, 1, 3], 2, [3, 1])).toEqual([
      2, 3, 1,
    ])
    expect(mergeReorderWithPinnedCurrent([1, 3], null, [3, 1])).toEqual([3, 1])
  })

  it("복제 이름은 (복사본) 접미사를 붙인다", () => {
    expect(formatDuplicatedSceneName("더위사냥")).toBe("더위사냥 (복사본)")
  })

  it("현재 Scene Highlight 대상은 is_current=true", () => {
    const list = sortScenesForDisplay([
      scene({ id: 1, name: "A", is_current: true }),
      scene({ id: 2, name: "B" }),
    ])
    expect(list[0]?.is_current).toBe(true)
    expect(list[1]?.is_current).toBe(false)
  })
})
