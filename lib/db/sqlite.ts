import Database from "better-sqlite3"
import { ensureDataDir, getStoreDbPath } from "@/lib/storage/data-paths"

let db: Database.Database | null = null

const DEFAULT_PLAN_TYPES = [
  { code: "morning_flat", name: "오전정액", sort_order: 1 },
  { code: "afternoon_flat", name: "오후정액", sort_order: 2 },
  { code: "night_flat", name: "야간정액", sort_order: 3 },
] as const

function getDbPath(): string {
  ensureDataDir()
  return getStoreDbPath()
}

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(getDbPath())
    db.pragma("journal_mode = WAL")
    db.pragma("foreign_keys = ON")
    initializeSchema(db)
  }
  return db
}

/** 테스트 전용: 열린 DB 연결을 닫아 임시 경로 교체를 가능하게 한다. */
export function closeDbForTests(): void {
  if (db) {
    db.close()
    db = null
  }
}

function seedPlanTypes(database: Database.Database): void {
  const insert = database.prepare(`
    INSERT INTO store_plan_types (code, name, sort_order, is_active)
    SELECT ?, ?, ?, 1
    WHERE NOT EXISTS (SELECT 1 FROM store_plan_types WHERE code = ?)
  `)

  for (const plan of DEFAULT_PLAN_TYPES) {
    insert.run(plan.code, plan.name, plan.sort_order, plan.code)
  }
}

function createStoreMembersTable(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS store_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      nickname TEXT,
      phone TEXT,
      plan_type TEXT,
      plan_type_id INTEGER,
      expires_at TEXT,
      memo TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (plan_type_id) REFERENCES store_plan_types(id)
    );
  `)
}

function migrateStoreMembersIfNeeded(database: Database.Database): void {
  const columns = database
    .prepare("PRAGMA table_info(store_members)")
    .all() as { name: string }[]

  const hasPlanTypeId = columns.some((column) => column.name === "plan_type_id")
  if (hasPlanTypeId) return

  database.exec(`
    CREATE TABLE store_members_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      nickname TEXT,
      phone TEXT,
      plan_type TEXT,
      plan_type_id INTEGER,
      expires_at TEXT,
      memo TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (plan_type_id) REFERENCES store_plan_types(id)
    );

    INSERT INTO store_members_new (
      id, name, nickname, phone, plan_type, expires_at, memo, is_active, created_at, updated_at
    )
    SELECT id, name, nickname, phone, plan_type, expires_at, memo, is_active, created_at, updated_at
    FROM store_members;

    DROP TABLE store_members;
    ALTER TABLE store_members_new RENAME TO store_members;
  `)

  database.exec(`
    UPDATE store_members
    SET plan_type_id = (
      SELECT id FROM store_plan_types WHERE store_plan_types.code = store_members.plan_type
    )
    WHERE plan_type IS NOT NULL;
  `)
}

function migrateDisplaySettingsIfNeeded(database: Database.Database): void {
  const columns = database
    .prepare("PRAGMA table_info(display_settings)")
    .all() as { name: string }[]

  const hasMediaFields = columns.some(
    (column) => column.name === "media_full_file_id",
  )
  if (hasMediaFields) return

  database.exec(`
    CREATE TABLE display_settings_new (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      mode TEXT NOT NULL DEFAULT 'ranking'
        CHECK (mode IN ('ranking', 'notice', 'media_full', 'media_split')),
      active_notice_id INTEGER,
      media_full_file_id INTEGER,
      media_left_file_id INTEGER,
      media_right_file_id INTEGER,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (active_notice_id) REFERENCES display_notices(id),
      FOREIGN KEY (media_full_file_id) REFERENCES display_assets(id),
      FOREIGN KEY (media_left_file_id) REFERENCES display_assets(id),
      FOREIGN KEY (media_right_file_id) REFERENCES display_assets(id)
    );

    INSERT INTO display_settings_new (id, mode, active_notice_id, updated_at)
    SELECT id, mode, active_notice_id, updated_at FROM display_settings;

    DROP TABLE display_settings;
    ALTER TABLE display_settings_new RENAME TO display_settings;
  `)
}

function migrateDisplayScenesIfNeeded(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS display_scenes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      mode TEXT NOT NULL CHECK (mode IN ('ranking', 'notice', 'media_full', 'media_split')),
      notice_id INTEGER,
      media_full_file_id INTEGER,
      media_left_file_id INTEGER,
      media_right_file_id INTEGER,
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (notice_id) REFERENCES display_notices(id),
      FOREIGN KEY (media_full_file_id) REFERENCES display_assets(id),
      FOREIGN KEY (media_left_file_id) REFERENCES display_assets(id),
      FOREIGN KEY (media_right_file_id) REFERENCES display_assets(id)
    );
  `)

  const settingsColumns = database
    .prepare("PRAGMA table_info(display_settings)")
    .all() as { name: string }[]

  const hasCurrentSceneId = settingsColumns.some(
    (column) => column.name === "current_scene_id",
  )

  if (!hasCurrentSceneId) {
    database.exec(`
      ALTER TABLE display_settings ADD COLUMN current_scene_id INTEGER
        REFERENCES display_scenes(id);
    `)
  }

  const sceneCount = database
    .prepare("SELECT COUNT(*) AS count FROM display_scenes")
    .get() as { count: number }

  if (sceneCount.count > 0) return

  const settings = database
    .prepare(
      `SELECT mode, active_notice_id, media_full_file_id, media_left_file_id, media_right_file_id
       FROM display_settings WHERE id = 1`,
    )
    .get() as {
    mode: string
    active_notice_id: number | null
    media_full_file_id: number | null
    media_left_file_id: number | null
    media_right_file_id: number | null
  } | undefined

  const insertScene = database.prepare(`
    INSERT INTO display_scenes (
      name, mode, notice_id, media_full_file_id, media_left_file_id, media_right_file_id, sort_order, is_active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 1)
  `)

  const rankingResult = insertScene.run(
    "랭킹 화면",
    "ranking",
    null,
    null,
    null,
    null,
    1,
  )
  const rankingSceneId = Number(rankingResult.lastInsertRowid)
  let currentSceneId = rankingSceneId
  let sortOrder = 2

  if (settings?.mode === "notice" && settings.active_notice_id) {
    const result = insertScene.run(
      "공지사항 화면",
      "notice",
      settings.active_notice_id,
      null,
      null,
      null,
      sortOrder,
    )
    currentSceneId = Number(result.lastInsertRowid)
    sortOrder += 1
  } else if (settings?.mode === "media_full" && settings.media_full_file_id) {
    const result = insertScene.run(
      "가로 전체 화면",
      "media_full",
      null,
      settings.media_full_file_id,
      null,
      null,
      sortOrder,
    )
    currentSceneId = Number(result.lastInsertRowid)
    sortOrder += 1
  } else if (
    settings?.mode === "media_split" &&
    settings.media_left_file_id &&
    settings.media_right_file_id
  ) {
    const result = insertScene.run(
      "세로 2분할 화면",
      "media_split",
      null,
      null,
      settings.media_left_file_id,
      settings.media_right_file_id,
      sortOrder,
    )
    currentSceneId = Number(result.lastInsertRowid)
  }

  database
    .prepare("UPDATE display_settings SET current_scene_id = ? WHERE id = 1")
    .run(currentSceneId)
}

const DEFAULT_DISPLAY_UNITS = [
  { code: "display-1", name: "전광판 1", sort_order: 1 },
  { code: "display-2", name: "전광판 2", sort_order: 2 },
] as const

const DEFAULT_UNIT_SCENES = [
  { name: "랭킹 화면", mode: "ranking", sort_order: 1 },
  { name: "공지사항 화면", mode: "notice", sort_order: 2 },
  { name: "가로 전체 화면", mode: "media_full", sort_order: 3 },
  { name: "세로 2분할 화면", mode: "media_split", sort_order: 4 },
] as const

function seedDefaultScenesForUnit(
  database: Database.Database,
  unitId: number,
): number {
  const insertScene = database.prepare(`
    INSERT INTO display_scenes (
      display_unit_id, name, mode, notice_id, media_full_file_id,
      media_left_file_id, media_right_file_id, sort_order, is_active
    ) VALUES (?, ?, ?, NULL, NULL, NULL, NULL, ?, 1)
  `)

  let rankingSceneId = 0
  for (const scene of DEFAULT_UNIT_SCENES) {
    const result = insertScene.run(
      unitId,
      scene.name,
      scene.mode,
      scene.sort_order,
    )
    if (scene.mode === "ranking") {
      rankingSceneId = Number(result.lastInsertRowid)
    }
  }
  return rankingSceneId
}

function ensureUnitSettingsAndScenes(
  database: Database.Database,
  unitId: number,
  seedScenesIfEmpty: boolean,
): void {
  const settings = database
    .prepare("SELECT id FROM display_settings WHERE display_unit_id = ?")
    .get(unitId) as { id: number } | undefined

  const sceneCount = database
    .prepare(
      "SELECT COUNT(*) AS count FROM display_scenes WHERE display_unit_id = ?",
    )
    .get(unitId) as { count: number }

  let rankingSceneId: number | null = null
  if (seedScenesIfEmpty && sceneCount.count === 0) {
    rankingSceneId = seedDefaultScenesForUnit(database, unitId)
  } else {
    const ranking = database
      .prepare(
        `SELECT id FROM display_scenes
         WHERE display_unit_id = ? AND mode = 'ranking' AND is_active = 1
         ORDER BY sort_order ASC, id ASC LIMIT 1`,
      )
      .get(unitId) as { id: number } | undefined
    rankingSceneId = ranking?.id ?? null
  }

  if (!settings) {
    database
      .prepare(
        `INSERT INTO display_settings (
          display_unit_id, mode, current_scene_id, active_notice_id
        ) VALUES (?, 'ranking', ?, NULL)`,
      )
      .run(unitId, rankingSceneId)
    return
  }

  if (rankingSceneId) {
    const current = database
      .prepare(
        "SELECT current_scene_id FROM display_settings WHERE display_unit_id = ?",
      )
      .get(unitId) as { current_scene_id: number | null }

    if (!current.current_scene_id) {
      database
        .prepare(
          `UPDATE display_settings
           SET current_scene_id = ?, updated_at = datetime('now')
           WHERE display_unit_id = ?`,
        )
        .run(rankingSceneId, unitId)
    }
  }
}

function migrateDisplayUnitsIfNeeded(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS display_units (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      code TEXT NOT NULL UNIQUE,
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)

  const insertUnit = database.prepare(`
    INSERT INTO display_units (name, code, sort_order, is_active)
    SELECT ?, ?, ?, 1
    WHERE NOT EXISTS (SELECT 1 FROM display_units WHERE code = ?)
  `)

  for (const unit of DEFAULT_DISPLAY_UNITS) {
    insertUnit.run(unit.name, unit.code, unit.sort_order, unit.code)
  }

  const unit1 = database
    .prepare("SELECT id FROM display_units WHERE code = 'display-1'")
    .get() as { id: number }
  const unit2 = database
    .prepare("SELECT id FROM display_units WHERE code = 'display-2'")
    .get() as { id: number }

  const sceneColumns = database
    .prepare("PRAGMA table_info(display_scenes)")
    .all() as { name: string }[]
  const hasSceneUnitId = sceneColumns.some(
    (column) => column.name === "display_unit_id",
  )

  if (!hasSceneUnitId) {
    database.exec(`
      ALTER TABLE display_scenes ADD COLUMN display_unit_id INTEGER
        REFERENCES display_units(id);
    `)
  }

  database
    .prepare(
      "UPDATE display_scenes SET display_unit_id = ? WHERE display_unit_id IS NULL",
    )
    .run(unit1.id)

  const settingsColumns = database
    .prepare("PRAGMA table_info(display_settings)")
    .all() as { name: string }[]
  const hasSettingsUnitId = settingsColumns.some(
    (column) => column.name === "display_unit_id",
  )

  if (!hasSettingsUnitId) {
    database.exec(`
      CREATE TABLE display_settings_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        display_unit_id INTEGER NOT NULL UNIQUE,
        mode TEXT NOT NULL DEFAULT 'ranking'
          CHECK (mode IN ('ranking', 'notice', 'media_full', 'media_split')),
        current_scene_id INTEGER,
        active_notice_id INTEGER,
        media_full_file_id INTEGER,
        media_left_file_id INTEGER,
        media_right_file_id INTEGER,
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (display_unit_id) REFERENCES display_units(id),
        FOREIGN KEY (current_scene_id) REFERENCES display_scenes(id),
        FOREIGN KEY (active_notice_id) REFERENCES display_notices(id),
        FOREIGN KEY (media_full_file_id) REFERENCES display_assets(id),
        FOREIGN KEY (media_left_file_id) REFERENCES display_assets(id),
        FOREIGN KEY (media_right_file_id) REFERENCES display_assets(id)
      );

      INSERT INTO display_settings_new (
        id, display_unit_id, mode, current_scene_id, active_notice_id,
        media_full_file_id, media_left_file_id, media_right_file_id, updated_at
      )
      SELECT
        s.id,
        ${unit1.id},
        s.mode,
        s.current_scene_id,
        s.active_notice_id,
        s.media_full_file_id,
        s.media_left_file_id,
        s.media_right_file_id,
        s.updated_at
      FROM display_settings s;

      DROP TABLE display_settings;
      ALTER TABLE display_settings_new RENAME TO display_settings;
    `)
  }

  // Unit1: 기존 데이터 유지, settings만 보장
  ensureUnitSettingsAndScenes(database, unit1.id, false)
  // Unit2: 기본 scenes + settings 시드
  ensureUnitSettingsAndScenes(database, unit2.id, true)
}

function initializeSchema(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS display_notices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      theme TEXT NOT NULL DEFAULT 'default' CHECK (theme IN ('default', 'event', 'warning', 'promotion')),
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS display_assets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      file_url TEXT NOT NULL,
      file_type TEXT NOT NULL CHECK (file_type IN ('image', 'pdf')),
      original_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      layout_type TEXT NOT NULL CHECK (layout_type IN ('full', 'split_left', 'split_right')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS display_scenes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      mode TEXT NOT NULL CHECK (mode IN ('ranking', 'notice', 'media_full', 'media_split')),
      notice_id INTEGER,
      media_full_file_id INTEGER,
      media_left_file_id INTEGER,
      media_right_file_id INTEGER,
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (notice_id) REFERENCES display_notices(id),
      FOREIGN KEY (media_full_file_id) REFERENCES display_assets(id),
      FOREIGN KEY (media_left_file_id) REFERENCES display_assets(id),
      FOREIGN KEY (media_right_file_id) REFERENCES display_assets(id)
    );

    CREATE TABLE IF NOT EXISTS display_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      mode TEXT NOT NULL DEFAULT 'ranking'
        CHECK (mode IN ('ranking', 'notice', 'media_full', 'media_split')),
      current_scene_id INTEGER,
      active_notice_id INTEGER,
      media_full_file_id INTEGER,
      media_left_file_id INTEGER,
      media_right_file_id INTEGER,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (current_scene_id) REFERENCES display_scenes(id),
      FOREIGN KEY (active_notice_id) REFERENCES display_notices(id),
      FOREIGN KEY (media_full_file_id) REFERENCES display_assets(id),
      FOREIGN KEY (media_left_file_id) REFERENCES display_assets(id),
      FOREIGN KEY (media_right_file_id) REFERENCES display_assets(id)
    );

    CREATE TABLE IF NOT EXISTS store_plan_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      code TEXT NOT NULL UNIQUE,
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)

  seedPlanTypes(database)

  migrateDisplaySettingsIfNeeded(database)
  migrateDisplayScenesIfNeeded(database)

  const memberTable = database
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'store_members'",
    )
    .get()

  if (!memberTable) {
    createStoreMembersTable(database)
  } else {
    migrateStoreMembersIfNeeded(database)
  }

  migrateGoogleContactsIfNeeded(database)
  migrateStoreSmsIfNeeded(database)

  const existing = database
    .prepare("SELECT id FROM display_settings WHERE id = 1")
    .get()

  if (!existing) {
    database
      .prepare(
        "INSERT INTO display_settings (id, mode, active_notice_id) VALUES (1, 'ranking', NULL)",
      )
      .run()
  }

  // singleton seed 이후 Display Unit 이관 (idempotent)
  migrateDisplayUnitsIfNeeded(database)
}

function migrateGoogleContactsIfNeeded(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS google_contacts_connections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      google_account_email TEXT,
      access_token_encrypted TEXT,
      refresh_token_encrypted TEXT NOT NULL,
      token_expires_at TEXT,
      scope TEXT NOT NULL,
      token_type TEXT,
      connected_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_synced_at TEXT,
      last_sync_status TEXT,
      last_sync_message TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS google_contacts_sync_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      started_at TEXT NOT NULL,
      completed_at TEXT,
      group_name TEXT NOT NULL,
      group_resource_name TEXT,
      google_contact_count INTEGER NOT NULL DEFAULT 0,
      created_count INTEGER NOT NULL DEFAULT 0,
      updated_count INTEGER NOT NULL DEFAULT 0,
      unchanged_count INTEGER NOT NULL DEFAULT 0,
      skipped_count INTEGER NOT NULL DEFAULT 0,
      failed_count INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL CHECK (status IN ('success', 'partial', 'failed')),
      message TEXT,
      details_json TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)

  const columns = database
    .prepare("PRAGMA table_info(store_members)")
    .all() as { name: string }[]
  const names = new Set(columns.map((c) => c.name))

  const additions: Array<{ name: string; sql: string }> = [
    {
      name: "google_resource_name",
      sql: "ALTER TABLE store_members ADD COLUMN google_resource_name TEXT",
    },
    {
      name: "google_contact_etag",
      sql: "ALTER TABLE store_members ADD COLUMN google_contact_etag TEXT",
    },
    {
      name: "google_synced_at",
      sql: "ALTER TABLE store_members ADD COLUMN google_synced_at TEXT",
    },
    {
      name: "google_sync_status",
      sql: "ALTER TABLE store_members ADD COLUMN google_sync_status TEXT",
    },
    {
      name: "normalized_phone",
      sql: "ALTER TABLE store_members ADD COLUMN normalized_phone TEXT",
    },
  ]

  for (const column of additions) {
    if (!names.has(column.name)) {
      database.exec(column.sql)
    }
  }

  database.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_store_members_google_resource_name
      ON store_members(google_resource_name)
      WHERE google_resource_name IS NOT NULL;

    CREATE INDEX IF NOT EXISTS idx_store_members_normalized_phone
      ON store_members(normalized_phone)
      WHERE normalized_phone IS NOT NULL;

    CREATE TABLE IF NOT EXISTS store_google_contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      google_resource_name TEXT NOT NULL UNIQUE,
      google_contact_etag TEXT,
      name TEXT NOT NULL,
      nickname TEXT,
      phone TEXT NOT NULL,
      normalized_phone TEXT NOT NULL,
      google_group_name TEXT NOT NULL,
      google_sync_status TEXT NOT NULL DEFAULT 'linked',
      is_active INTEGER NOT NULL DEFAULT 1,
      memo TEXT,
      sms_opt_out INTEGER NOT NULL DEFAULT 0,
      last_synced_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_store_google_contacts_normalized_phone
      ON store_google_contacts(normalized_phone);

    CREATE INDEX IF NOT EXISTS idx_store_google_contacts_sync_status
      ON store_google_contacts(google_sync_status);
  `)
}

function migrateStoreSmsIfNeeded(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS store_sms_campaigns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      send_mode TEXT NOT NULL CHECK (send_mode IN ('immediate', 'scheduled')),
      scheduled_at TEXT,
      timezone TEXT NOT NULL DEFAULT 'Asia/Seoul',
      status TEXT NOT NULL CHECK (
        status IN (
          'draft', 'scheduled', 'processing', 'completed',
          'partial', 'failed', 'cancelled'
        )
      ),
      target_type TEXT NOT NULL CHECK (target_type IN ('selected', 'filtered_all')),
      target_filter_json TEXT,
      total_recipients INTEGER NOT NULL DEFAULT 0,
      sendable_recipients INTEGER NOT NULL DEFAULT 0,
      excluded_recipients INTEGER NOT NULL DEFAULT 0,
      sent_count INTEGER NOT NULL DEFAULT 0,
      success_count INTEGER NOT NULL DEFAULT 0,
      failed_count INTEGER NOT NULL DEFAULT 0,
      cancelled_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      started_at TEXT,
      completed_at TEXT,
      cancelled_at TEXT
    );

    CREATE TABLE IF NOT EXISTS store_sms_campaign_recipients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER NOT NULL,
      google_contact_id INTEGER,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      normalized_phone TEXT NOT NULL,
      status TEXT NOT NULL CHECK (
        status IN (
          'pending', 'excluded', 'processing', 'success', 'failed', 'cancelled'
        )
      ),
      exclusion_reason TEXT,
      provider_message_id TEXT,
      error_message TEXT,
      sent_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (campaign_id) REFERENCES store_sms_campaigns(id)
    );

    CREATE TABLE IF NOT EXISTS store_sms_dispatch_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER NOT NULL,
      recipient_id INTEGER,
      provider TEXT NOT NULL,
      dry_run INTEGER NOT NULL DEFAULT 1,
      request_summary_json TEXT NOT NULL,
      response_summary_json TEXT,
      status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'dry_run')),
      error_code TEXT,
      error_message TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (campaign_id) REFERENCES store_sms_campaigns(id)
    );

    CREATE TABLE IF NOT EXISTS store_sms_drafts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      target_type TEXT NOT NULL CHECK (target_type IN ('selected', 'filtered_all')),
      contact_ids_json TEXT,
      filter_json TEXT,
      summary_json TEXT,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_store_sms_campaigns_status_scheduled
      ON store_sms_campaigns(status, scheduled_at);

    CREATE INDEX IF NOT EXISTS idx_store_sms_recipients_campaign_status
      ON store_sms_campaign_recipients(campaign_id, status);

    CREATE TABLE IF NOT EXISTS store_sms_contact_carts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cart_key TEXT NOT NULL UNIQUE,
      name TEXT,
      status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'converted', 'expired')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at TEXT
    );

    CREATE TABLE IF NOT EXISTS store_sms_contact_cart_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cart_id INTEGER NOT NULL,
      google_contact_id INTEGER NOT NULL,
      added_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (cart_id, google_contact_id),
      FOREIGN KEY (cart_id) REFERENCES store_sms_contact_carts(id)
    );

    CREATE TABLE IF NOT EXISTS store_sms_contact_groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      member_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS store_sms_contact_group_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id INTEGER NOT NULL,
      google_contact_id INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (group_id, google_contact_id),
      FOREIGN KEY (group_id) REFERENCES store_sms_contact_groups(id)
    );

    CREATE TABLE IF NOT EXISTS store_sms_draft_recipients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      draft_id INTEGER NOT NULL,
      google_contact_id INTEGER,
      name TEXT NOT NULL,
      nickname TEXT,
      phone TEXT NOT NULL,
      normalized_phone TEXT NOT NULL,
      eligibility_status TEXT NOT NULL
        CHECK (eligibility_status IN ('sendable', 'excluded')),
      exclusion_reason TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (draft_id) REFERENCES store_sms_drafts(id)
    );

    CREATE INDEX IF NOT EXISTS idx_store_sms_cart_items_cart
      ON store_sms_contact_cart_items(cart_id);

    CREATE INDEX IF NOT EXISTS idx_store_sms_group_members_group
      ON store_sms_contact_group_members(group_id);

    CREATE INDEX IF NOT EXISTS idx_store_sms_draft_recipients_draft
      ON store_sms_draft_recipients(draft_id, eligibility_status);
  `)
}
