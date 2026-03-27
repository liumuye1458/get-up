import Database from 'better-sqlite3'
import { appendFileSync } from 'node:fs'
import { join } from 'node:path'

export const CURRENT_SCHEMA_VERSION = 3
export const HISTORY_POLICY = {
  maxEntries: 80,
  activeRetentionDays: 30,
  undoneRetentionDays: 7,
}

export const DEFAULT_SETTINGS = {
  language: 'zh-CN',
  globalVolume: 0.8,
  allowOverlap: false,
  stopOthersOnTrigger: true,
  selectedOutputDeviceId: '',
  warnOnMissingFiles: true,
  globalShortcutsEnabled: true,
  tagManagerSortMode: 'name',
  backupImportSelectionTemplates: [],
  hotkeySuggestionStrategy: {
    primaryModifier: 'Ctrl+Shift',
    includeAlternateModifiers: true,
    includeDigits: true,
    includeFunctionKeys: true,
    includeLetters: true,
    groupingMode: 'none',
  },
}

const databaseTracePath = process.env.APPDATA
  ? join(process.env.APPDATA, 'local-sfx-board', 'db-startup-trace.log')
  : null

function writeDatabaseTrace(message) {
  if (!databaseTracePath) {
    return
  }

  try {
    appendFileSync(databaseTracePath, `[${new Date().toISOString()}] ${message}\n`, 'utf-8')
  } catch {
    // Ignore diagnostic logging failures.
  }
}

function nowIso() {
  return new Date().toISOString()
}

function writeSettingStatement(db) {
  return db.prepare(`
    INSERT INTO settings (key, value)
    VALUES (@key, @value)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `)
}

function insertDefaultSettingStatement(db) {
  return db.prepare(`
    INSERT OR IGNORE INTO settings (key, value)
    VALUES (@key, @value)
  `)
}

function readStoredSchemaVersion(db) {
  const row = db.prepare(`
    SELECT value
    FROM app_meta
    WHERE key = 'schemaVersion'
  `).get()

  if (!row) {
    return 0
  }

  const parsed = Number(row.value)
  return Number.isFinite(parsed) ? parsed : 0
}

function writeStoredSchemaVersion(db, version) {
  db.prepare(`
    INSERT INTO app_meta (key, value)
    VALUES ('schemaVersion', @value)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run({ value: String(version) })
}

function hasColumn(db, tableName, columnName) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all()
  return columns.some((column) => column.name === columnName)
}

function ensureSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS app_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audio_resources (
      id TEXT PRIMARY KEY,
      sha256 TEXT NOT NULL UNIQUE,
      storage_filename TEXT NOT NULL,
      source_extension TEXT NOT NULL,
      original_filename TEXT NOT NULL,
      original_path TEXT,
      mime_type TEXT,
      duration_ms INTEGER,
      sample_rate INTEGER,
      channels INTEGER,
      size_bytes INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS cue_cards (
      id TEXT PRIMARY KEY,
      resource_id TEXT NOT NULL,
      name TEXT NOT NULL,
      hotkey TEXT NOT NULL DEFAULT '',
      playback_rate REAL NOT NULL DEFAULT 1.0,
      volume REAL NOT NULL DEFAULT 1.0,
      trim_start_ms INTEGER NOT NULL DEFAULT 0,
      trim_end_ms INTEGER,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(resource_id) REFERENCES audio_resources(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS tags (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      color TEXT,
      color_mode TEXT NOT NULL DEFAULT 'auto',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS cue_card_tags (
      cue_card_id TEXT NOT NULL,
      tag_id TEXT NOT NULL,
      PRIMARY KEY (cue_card_id, tag_id),
      FOREIGN KEY(cue_card_id) REFERENCES cue_cards(id) ON DELETE CASCADE,
      FOREIGN KEY(tag_id) REFERENCES tags(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS action_history (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      status TEXT NOT NULL,
      summary TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      undone_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_audio_resources_sha256
      ON audio_resources(sha256);

    CREATE INDEX IF NOT EXISTS idx_cue_cards_resource_id
      ON cue_cards(resource_id);

    CREATE INDEX IF NOT EXISTS idx_tags_name
      ON tags(name);
  `)
}

function migrateSchema(db) {
  let version = readStoredSchemaVersion(db)

  if (version < 1) {
    writeStoredSchemaVersion(db, 1)
    version = 1
  }

  if (version < 2) {
    if (!hasColumn(db, 'tags', 'color_mode')) {
      db.exec(`
        ALTER TABLE tags
        ADD COLUMN color_mode TEXT NOT NULL DEFAULT 'auto'
      `)
    }

    writeStoredSchemaVersion(db, 2)
    version = 2
  }

  if (version < 3) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS action_history (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        status TEXT NOT NULL,
        summary TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        undone_at TEXT
      )
    `)

    writeStoredSchemaVersion(db, 3)
    version = 3
  }

  return version
}

function seedDefaultSettings(db) {
  const insertDefault = insertDefaultSettingStatement(db)

  const transaction = db.transaction(() => {
    for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
      insertDefault.run({ key, value: JSON.stringify(value) })
    }
  })

  transaction()
}

export function openAppDatabase(databasePath) {
  writeDatabaseTrace(`openAppDatabase:start path=${databasePath}`)
  const db = new Database(databasePath)
  writeDatabaseTrace('openAppDatabase:constructor-ready')
  db.pragma('journal_mode = WAL')
  writeDatabaseTrace('openAppDatabase:journal-ready')
  db.pragma('foreign_keys = ON')
  writeDatabaseTrace('openAppDatabase:foreign-keys-ready')

  ensureSchema(db)
  writeDatabaseTrace('openAppDatabase:schema-ready')
  migrateSchema(db)
  writeDatabaseTrace('openAppDatabase:migration-ready')
  seedDefaultSettings(db)
  writeDatabaseTrace('openAppDatabase:seed-ready')

  return db
}

export function readSettings(db) {
  const rows = db.prepare('SELECT key, value FROM settings').all()
  const settings = { ...DEFAULT_SETTINGS }

  for (const row of rows) {
    if (!(row.key in settings)) {
      continue
    }

    const parsed = JSON.parse(row.value)
    settings[row.key] =
      row.key === 'hotkeySuggestionStrategy'
        ? {
            ...DEFAULT_SETTINGS.hotkeySuggestionStrategy,
            ...(parsed ?? {}),
          }
        : parsed
  }

  return settings
}

export function readLibraryStats(db) {
  const resourceCount =
    db.prepare('SELECT COUNT(*) AS count FROM audio_resources').get().count ?? 0
  const cueCount = db.prepare('SELECT COUNT(*) AS count FROM cue_cards').get().count ?? 0
  const tagCount = db.prepare('SELECT COUNT(*) AS count FROM tags').get().count ?? 0
  const orphanResourceCount =
    db.prepare(`
      SELECT COUNT(*) AS count
      FROM audio_resources ar
      WHERE NOT EXISTS (
        SELECT 1
        FROM cue_cards cc
        WHERE cc.resource_id = ar.id
      )
    `).get().count ?? 0

  return {
    resourceCount,
    cueCount,
    tagCount,
    orphanResourceCount,
  }
}

export function readLibraryCatalogSnapshot(db) {
  const cueNames = db
    .prepare(`
      SELECT name
      FROM cue_cards
      ORDER BY sort_order ASC, created_at ASC
    `)
    .all()
    .map((row) => row.name)

  const tagNames = db
    .prepare(`
      SELECT name
      FROM tags
      ORDER BY name COLLATE NOCASE ASC
    `)
    .all()
    .map((row) => row.name)

  const resourceNames = db
    .prepare(`
      SELECT original_filename AS originalFilename
      FROM audio_resources
      ORDER BY original_filename COLLATE NOCASE ASC, created_at ASC
    `)
    .all()
    .map((row) => row.originalFilename)

  return {
    cueNames,
    tagNames,
    resourceNames,
  }
}

export function readBoardSnapshot(db, storagePaths) {
  const cueRows = db.prepare(`
    SELECT
      cc.id,
      cc.resource_id AS resourceId,
      cc.name,
      cc.hotkey,
      cc.playback_rate AS playbackRate,
      cc.volume,
      cc.trim_start_ms AS trimStartMs,
      cc.trim_end_ms AS trimEndMs,
      cc.sort_order AS sortOrder,
      cc.created_at AS createdAt,
      cc.updated_at AS updatedAt,
      ar.original_filename AS originalFilename,
      ar.storage_filename AS storageFilename,
      ar.duration_ms AS durationMs
    FROM cue_cards cc
    INNER JOIN audio_resources ar ON ar.id = cc.resource_id
    ORDER BY cc.sort_order ASC, cc.created_at ASC
  `).all()

  const tagRows = db.prepare(`
    SELECT
      cct.cue_card_id AS cueCardId,
      t.id,
      t.name,
      t.color,
      t.color_mode AS colorMode,
      t.created_at AS createdAt,
      t.updated_at AS updatedAt
    FROM cue_card_tags cct
    INNER JOIN tags t ON t.id = cct.tag_id
    ORDER BY t.name COLLATE NOCASE ASC
  `).all()

  const tagsByCueId = new Map()

  for (const row of tagRows) {
    const list = tagsByCueId.get(row.cueCardId) ?? []
    list.push({
      id: row.id,
      name: row.name,
      color: row.color,
      colorMode: row.colorMode,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    })
    tagsByCueId.set(row.cueCardId, list)
  }

  return {
    cueCards: cueRows.map((row) => ({
      id: row.id,
      resourceId: row.resourceId,
      name: row.name,
      hotkey: row.hotkey,
      playbackRate: row.playbackRate,
      volume: row.volume,
      trimStartMs: row.trimStartMs,
      trimEndMs: row.trimEndMs,
      sortOrder: row.sortOrder,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      resource: {
        originalFilename: row.originalFilename,
        storageFilename: row.storageFilename,
        durationMs: row.durationMs,
        absolutePath: join(storagePaths.libraryDir, row.storageFilename),
      },
      tags: tagsByCueId.get(row.id) ?? [],
    })),
  }
}

export function readShortcutEntries(db, options = {}) {
  const includeEmpty = options.includeEmpty === true

  return db
    .prepare(`
      SELECT
        cc.id,
        cc.name,
        cc.hotkey,
        GROUP_CONCAT(t.name, '|||') AS tagNamesJoined
      FROM cue_cards cc
      LEFT JOIN cue_card_tags cct ON cct.cue_card_id = cc.id
      LEFT JOIN tags t ON t.id = cct.tag_id
      ${includeEmpty ? '' : "WHERE TRIM(cc.hotkey) <> ''"}
      GROUP BY cc.id, cc.name, cc.hotkey, cc.sort_order, cc.created_at
      ORDER BY cc.sort_order ASC, cc.created_at ASC
    `)
    .all()
    .map((row) => ({
      id: row.id,
      name: row.name,
      hotkey: row.hotkey,
      tagNames: row.tagNamesJoined
        ? row.tagNamesJoined
            .split('|||')
            .map((name) => name.trim())
            .filter(Boolean)
        : [],
    }))
}

export function writeSettings(db, patch) {
  const current = readSettings(db)
  const next = {
    ...current,
    ...patch,
    hotkeySuggestionStrategy: {
      ...current.hotkeySuggestionStrategy,
      ...(patch.hotkeySuggestionStrategy ?? {}),
    },
  }
  const upsert = writeSettingStatement(db)

  const transaction = db.transaction(() => {
    for (const [key, value] of Object.entries(next)) {
      upsert.run({ key, value: JSON.stringify(value) })
    }
  })

  transaction()
  return next
}

export function readBootstrapSnapshot(db, storagePaths) {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    generatedAt: nowIso(),
    storage: {
      mode: storagePaths.mode,
      dataRoot: storagePaths.dataRoot,
      libraryDir: storagePaths.libraryDir,
      waveformsDir: storagePaths.waveformsDir,
      trashDir: storagePaths.trashDir,
      databasePath: storagePaths.databasePath,
    },
    historyPolicy: HISTORY_POLICY,
    settings: readSettings(db),
    stats: readLibraryStats(db),
  }
}

export function createHistoryEntry(db, entry) {
  db.prepare(`
    INSERT INTO action_history (
      id,
      type,
      status,
      summary,
      payload_json,
      created_at,
      undone_at
    ) VALUES (
      @id,
      @type,
      @status,
      @summary,
      @payloadJson,
      @createdAt,
      NULL
    )
  `).run({
    id: entry.id,
    type: entry.type,
    status: entry.status,
    summary: entry.summary,
    payloadJson: JSON.stringify(entry.payload),
    createdAt: entry.createdAt,
  })
}

export function readHistoryEntries(db) {
  return db.prepare(`
    SELECT
      id,
      type,
      status,
      summary,
      created_at AS createdAt,
      undone_at AS undoneAt
    FROM action_history
    ORDER BY created_at DESC
    LIMIT ${HISTORY_POLICY.maxEntries}
  `).all()
}

function parseHistoryPayloadRow(row) {
  return {
    ...row,
    payload: JSON.parse(row.payloadJson),
  }
}

export function readHistoryEntryById(db, entryId) {
  const row = db.prepare(`
    SELECT
      id,
      type,
      status,
      summary,
      payload_json AS payloadJson,
      created_at AS createdAt,
      undone_at AS undoneAt
    FROM action_history
    WHERE id = ?
  `).get(entryId)

  if (!row) {
    return null
  }

  return parseHistoryPayloadRow(row)
}

export function markHistoryEntryUndone(db, entryId) {
  db.prepare(`
    UPDATE action_history
    SET
      status = 'undone',
      undone_at = @undoneAt
    WHERE id = @id
  `).run({
    id: entryId,
    undoneAt: nowIso(),
  })
}

function daysBetween(earlierIso, laterTime) {
  return (laterTime - new Date(earlierIso).getTime()) / (1000 * 60 * 60 * 24)
}

export function pruneHistoryEntries(db) {
  const rows = db.prepare(`
    SELECT
      id,
      type,
      status,
      summary,
      payload_json AS payloadJson,
      created_at AS createdAt,
      undone_at AS undoneAt
    FROM action_history
    ORDER BY created_at DESC
  `).all()

  const now = Date.now()
  const expiredIds = new Set()

  for (const row of rows) {
    const ageReference =
      row.status === 'undone' && row.undoneAt ? row.undoneAt : row.createdAt
    const retentionDays =
      row.status === 'undone'
        ? HISTORY_POLICY.undoneRetentionDays
        : HISTORY_POLICY.activeRetentionDays

    if (daysBetween(ageReference, now) > retentionDays) {
      expiredIds.add(row.id)
    }
  }

  const survivors = rows.filter((row) => !expiredIds.has(row.id))
  const overflowCount = Math.max(0, survivors.length - HISTORY_POLICY.maxEntries)

  if (overflowCount > 0) {
    const overflowRows = [...survivors]
      .sort((left, right) => {
        if (left.status !== right.status) {
          return left.status === 'undone' ? -1 : 1
        }

        return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
      })
      .slice(0, overflowCount)

    for (const row of overflowRows) {
      expiredIds.add(row.id)
    }
  }

  if (expiredIds.size === 0) {
    return []
  }

  const prunedRows = rows.filter((row) => expiredIds.has(row.id)).map(parseHistoryPayloadRow)
  const deleteEntries = db.prepare('DELETE FROM action_history WHERE id = ?')
  const transaction = db.transaction((entryIds) => {
    for (const id of entryIds) {
      deleteEntries.run(id)
    }
  })

  transaction(Array.from(expiredIds))

  return prunedRows
}
