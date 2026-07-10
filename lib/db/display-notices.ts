import { getDb } from "./sqlite"
import type { NoticeTheme } from "@/lib/admin/constants"

export type DisplayNotice = {
  id: number
  title: string
  body: string
  theme: NoticeTheme
  is_active: boolean
  created_at: string
  updated_at: string
}

type NoticeRow = {
  id: number
  title: string
  body: string
  theme: NoticeTheme
  is_active: number
  created_at: string
  updated_at: string
}

function mapNotice(row: NoticeRow): DisplayNotice {
  return {
    ...row,
    is_active: row.is_active === 1,
  }
}

export function listNotices(): DisplayNotice[] {
  const rows = getDb()
    .prepare(
      `SELECT id, title, body, theme, is_active, created_at, updated_at
       FROM display_notices
       ORDER BY created_at DESC`,
    )
    .all() as NoticeRow[]

  return rows.map(mapNotice)
}

export function getNoticeById(id: number): DisplayNotice | null {
  const row = getDb()
    .prepare(
      `SELECT id, title, body, theme, is_active, created_at, updated_at
       FROM display_notices WHERE id = ?`,
    )
    .get(id) as NoticeRow | undefined

  return row ? mapNotice(row) : null
}

export function createNotice(input: {
  title: string
  body: string
  theme: NoticeTheme
  is_active: boolean
}): DisplayNotice {
  const result = getDb()
    .prepare(
      `INSERT INTO display_notices (title, body, theme, is_active)
       VALUES (?, ?, ?, ?)`,
    )
    .run(input.title, input.body, input.theme, input.is_active ? 1 : 0)

  const notice = getNoticeById(Number(result.lastInsertRowid))
  if (!notice) throw new Error("공지사항 생성 후 조회에 실패했습니다.")
  return notice
}

export function updateNotice(
  id: number,
  input: Partial<{
    title: string
    body: string
    theme: NoticeTheme
    is_active: boolean
  }>,
): DisplayNotice | null {
  const current = getNoticeById(id)
  if (!current) return null

  getDb()
    .prepare(
      `UPDATE display_notices
       SET title = ?, body = ?, theme = ?, is_active = ?, updated_at = datetime('now')
       WHERE id = ?`,
    )
    .run(
      input.title ?? current.title,
      input.body ?? current.body,
      input.theme ?? current.theme,
      (input.is_active ?? current.is_active) ? 1 : 0,
      id,
    )

  return getNoticeById(id)
}

export function deleteNotice(id: number): boolean {
  const result = getDb()
    .prepare("DELETE FROM display_notices WHERE id = ?")
    .run(id)

  if (result.changes > 0) {
    getDb()
      .prepare(
        "UPDATE display_settings SET active_notice_id = NULL WHERE active_notice_id = ?",
      )
      .run(id)
  }

  return result.changes > 0
}
