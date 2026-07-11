import { RankedPlayer } from "@/lib/sg-ranking/ranking-generator"
import { getDb } from "./sqlite"

export type SnapshotStatus = "FINAL" | "RECOVERED"

export type PersistedRankingSnapshot = {
  monthKey: string
  year: number
  month: number
  startDate: string
  endDate: string
  top5: RankedPlayer[]
  ranking: RankedPlayer[]
  sourceCount: number
  validCount: number
  generatedAt: string
  finalizedAt: string | null
  status: SnapshotStatus
}

type SnapshotRow = {
  month_key: string
  year: number
  month: number
  start_date: string
  end_date: string
  ranking_json: string
  top5_json: string
  source_count: number
  valid_count: number
  generated_at: string
  finalized_at: string | null
  status: SnapshotStatus
}

function mapRow(row: SnapshotRow): PersistedRankingSnapshot {
  return {
    monthKey: row.month_key,
    year: row.year,
    month: row.month,
    startDate: row.start_date,
    endDate: row.end_date,
    top5: JSON.parse(row.top5_json) as RankedPlayer[],
    ranking: JSON.parse(row.ranking_json) as RankedPlayer[],
    sourceCount: row.source_count,
    validCount: row.valid_count,
    generatedAt: row.generated_at,
    finalizedAt: row.finalized_at,
    status: row.status,
  }
}

function ensureRankingSnapshotTable(): void {
  const db = getDb()
  db.exec(`
    CREATE TABLE IF NOT EXISTS monthly_ranking_snapshots (
      month_key TEXT PRIMARY KEY,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL,
      start_date TEXT NOT NULL DEFAULT '',
      end_date TEXT NOT NULL DEFAULT '',
      ranking_json TEXT NOT NULL DEFAULT '[]',
      top5_json TEXT NOT NULL,
      source_count INTEGER NOT NULL DEFAULT 0,
      valid_count INTEGER NOT NULL DEFAULT 0,
      generated_at TEXT NOT NULL,
      finalized_at TEXT,
      status TEXT NOT NULL DEFAULT 'RECOVERED'
        CHECK (status IN ('FINAL', 'RECOVERED')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)

  migrateRankingSnapshotColumns(db)
}

function migrateRankingSnapshotColumns(db: ReturnType<typeof getDb>): void {
  const columns = db
    .prepare("PRAGMA table_info(monthly_ranking_snapshots)")
    .all() as Array<{ name: string }>
  const names = new Set(columns.map((column) => column.name))

  if (!names.has("start_date")) {
    db.exec(
      "ALTER TABLE monthly_ranking_snapshots ADD COLUMN start_date TEXT NOT NULL DEFAULT ''",
    )
  }
  if (!names.has("end_date")) {
    db.exec(
      "ALTER TABLE monthly_ranking_snapshots ADD COLUMN end_date TEXT NOT NULL DEFAULT ''",
    )
  }
  if (!names.has("ranking_json")) {
    db.exec(
      "ALTER TABLE monthly_ranking_snapshots ADD COLUMN ranking_json TEXT NOT NULL DEFAULT '[]'",
    )
  }
  if (!names.has("source_count")) {
    db.exec(
      "ALTER TABLE monthly_ranking_snapshots ADD COLUMN source_count INTEGER NOT NULL DEFAULT 0",
    )
  }
  if (!names.has("valid_count")) {
    db.exec(
      "ALTER TABLE monthly_ranking_snapshots ADD COLUMN valid_count INTEGER NOT NULL DEFAULT 0",
    )
  }
  if (!names.has("generated_at")) {
    db.exec(
      "ALTER TABLE monthly_ranking_snapshots ADD COLUMN generated_at TEXT NOT NULL DEFAULT ''",
    )
  }
  if (!names.has("finalized_at")) {
    db.exec("ALTER TABLE monthly_ranking_snapshots ADD COLUMN finalized_at TEXT")
  }
  if (!names.has("status")) {
    db.exec(
      "ALTER TABLE monthly_ranking_snapshots ADD COLUMN status TEXT NOT NULL DEFAULT 'RECOVERED'",
    )
  }

  if (names.has("fixed_at")) {
    db.exec(`
      UPDATE monthly_ranking_snapshots
      SET generated_at = COALESCE(NULLIF(generated_at, ''), fixed_at, datetime('now'))
      WHERE generated_at IS NULL OR generated_at = '';
    `)
  } else {
    db.exec(`
      UPDATE monthly_ranking_snapshots
      SET generated_at = COALESCE(NULLIF(generated_at, ''), datetime('now'))
      WHERE generated_at IS NULL OR generated_at = '';
    `)
  }

  db.exec(`
    UPDATE monthly_ranking_snapshots
    SET ranking_json = COALESCE(NULLIF(ranking_json, ''), top5_json)
    WHERE ranking_json IS NULL OR ranking_json = '' OR ranking_json = '[]';
  `)

  db.exec(`
    UPDATE monthly_ranking_snapshots
    SET status = 'RECOVERED'
    WHERE status IS NULL OR status = '';
  `)
}

export function loadAllRankingSnapshotsFromDb(): PersistedRankingSnapshot[] {
  ensureRankingSnapshotTable()
  const db = getDb()

  const rows = db
    .prepare(
      `SELECT month_key, year, month, start_date, end_date, ranking_json, top5_json,
              source_count, valid_count, generated_at, finalized_at, status
       FROM monthly_ranking_snapshots
       ORDER BY month_key ASC`,
    )
    .all() as SnapshotRow[]

  return rows.map(mapRow)
}

export function getRankingSnapshotFromDb(
  monthKey: string,
): PersistedRankingSnapshot | null {
  ensureRankingSnapshotTable()
  const db = getDb()

  const row = db
    .prepare(
      `SELECT month_key, year, month, start_date, end_date, ranking_json, top5_json,
              source_count, valid_count, generated_at, finalized_at, status
       FROM monthly_ranking_snapshots
       WHERE month_key = ?`,
    )
    .get(monthKey) as SnapshotRow | undefined

  return row ? mapRow(row) : null
}

export function hasFinalRankingSnapshot(monthKey: string): boolean {
  const snapshot = getRankingSnapshotFromDb(monthKey)
  return snapshot?.status === "FINAL" && snapshot.top5.length > 0
}

export function saveRankingSnapshotToDb(
  snapshot: PersistedRankingSnapshot,
): { saved: boolean; reason?: string } {
  if (snapshot.top5.length === 0) {
    console.warn(
      `[ranking-snapshots] 빈 TOP5 저장 거부 (${snapshot.monthKey})`,
    )
    return { saved: false, reason: "empty-top5" }
  }

  ensureRankingSnapshotTable()
  const db = getDb()
  const existing = getRankingSnapshotFromDb(snapshot.monthKey)

  if (existing?.status === "FINAL" && existing.top5.length > 0) {
    console.log(
      `[ranking-snapshots] FINAL 스냅샷 유지 (${snapshot.monthKey}), cachePreserved reason=final-immutable`,
    )
    return { saved: false, reason: "final-immutable" }
  }

  try {
    db.prepare(
      `INSERT INTO monthly_ranking_snapshots (
        month_key, year, month, start_date, end_date, ranking_json, top5_json,
        source_count, valid_count, generated_at, finalized_at, status, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(month_key) DO UPDATE SET
        year = excluded.year,
        month = excluded.month,
        start_date = excluded.start_date,
        end_date = excluded.end_date,
        ranking_json = excluded.ranking_json,
        top5_json = excluded.top5_json,
        source_count = excluded.source_count,
        valid_count = excluded.valid_count,
        generated_at = excluded.generated_at,
        finalized_at = excluded.finalized_at,
        status = excluded.status,
        updated_at = datetime('now')
      WHERE monthly_ranking_snapshots.status != 'FINAL'`,
    ).run(
      snapshot.monthKey,
      snapshot.year,
      snapshot.month,
      snapshot.startDate,
      snapshot.endDate,
      JSON.stringify(snapshot.ranking),
      JSON.stringify(snapshot.top5),
      snapshot.sourceCount,
      snapshot.validCount,
      snapshot.generatedAt,
      snapshot.finalizedAt,
      snapshot.status,
    )

    return { saved: true }
  } catch (error) {
    console.error(
      `[ranking-snapshots] DB 저장 실패 (${snapshot.monthKey}), cachePreserved:`,
      error,
    )
    return { saved: false, reason: "db-write-failed" }
  }
}
