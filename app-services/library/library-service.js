import { createHash, randomUUID } from 'node:crypto'
import { basename, extname, join } from 'node:path'
import { copyFile, createReadStream } from 'node:fs'
import { readdir, rename, stat, unlink, writeFile } from 'node:fs/promises'
import { parseFile } from 'music-metadata'

const SUPPORTED_EXTENSIONS = new Set(['.mp3', '.wav', '.ogg', '.aac', '.flac', '.m4a', '.webm'])

function nowIso() {
  return new Date().toISOString()
}

function noop() {}

function isSupportedAudioPath(filePath) {
  return SUPPORTED_EXTENSIONS.has(extname(filePath).toLowerCase())
}

function createImportFailure(path, code, reason, retryable) {
  return {
    path,
    code,
    reason,
    retryable,
  }
}

function classifyFsFailure(error, fallbackCode) {
  const code = error?.code

  if (code === 'ENOENT') {
    return {
      code: 'path_missing',
      reason: 'Path does not exist',
      retryable: true,
    }
  }

  if (code === 'EACCES' || code === 'EPERM') {
    return {
      code: 'permission_denied',
      reason: 'Permission denied while reading the path',
      retryable: true,
    }
  }

  if (fallbackCode === 'directory_scan_failed') {
    return {
      code: 'directory_scan_failed',
      reason: error instanceof Error ? error.message : 'Could not scan directory',
      retryable: true,
    }
  }

  return {
    code: fallbackCode,
    reason: error instanceof Error ? error.message : 'Unknown import error',
    retryable: fallbackCode !== 'unsupported_type',
  }
}

async function walkDirectory(rootPath, results, failures) {
  let entries

  try {
    entries = await readdir(rootPath, { withFileTypes: true })
  } catch (error) {
    const failure = classifyFsFailure(error, 'directory_scan_failed')
    failures.push(createImportFailure(rootPath, failure.code, failure.reason, failure.retryable))
    return
  }

  for (const entry of entries) {
    const fullPath = join(rootPath, entry.name)

    if (entry.isDirectory()) {
      await walkDirectory(fullPath, results, failures)
      continue
    }

    if (entry.isFile() && isSupportedAudioPath(fullPath)) {
      results.push(fullPath)
    }
  }
}

async function collectImportableAudioFiles(inputPaths) {
  const results = []
  const failures = []
  let invalidPathCount = 0

  for (const inputPath of inputPaths) {
    if (!inputPath) {
      continue
    }

    try {
      const entry = await stat(inputPath)

      if (entry.isDirectory()) {
        await walkDirectory(inputPath, results, failures)
        continue
      }

      if (entry.isFile() && isSupportedAudioPath(inputPath)) {
        results.push(inputPath)
        continue
      }

      if (entry.isFile()) {
        failures.push(
          createImportFailure(
            inputPath,
            'unsupported_type',
            `Unsupported file type: ${extname(inputPath) || 'unknown'}`,
            false,
          ),
        )
      }
    } catch (error) {
      invalidPathCount += 1
      const failure = classifyFsFailure(error, 'path_missing')
      failures.push(createImportFailure(inputPath, failure.code, failure.reason, failure.retryable))
      continue
    }
  }

  return {
    supportedFiles: results,
    invalidPathCount,
    discoveryFailures: failures,
  }
}

export function hashFile(filePath) {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256')
    const stream = createReadStream(filePath)

    stream.on('data', (chunk) => {
      hash.update(chunk)
    })
    stream.on('error', reject)
    stream.on('end', () => {
      resolve(hash.digest('hex'))
    })
  })
}

function hashBuffer(buffer) {
  return createHash('sha256').update(buffer).digest('hex')
}

function copyFileAsync(source, target) {
  return new Promise((resolve, reject) => {
    copyFile(source, target, (error) => {
      if (error) {
        reject(error)
        return
      }

      resolve()
    })
  })
}

function getDisplayName(filePath) {
  return basename(filePath, extname(filePath))
}

function createToneWavBuffer({ durationMs, frequencyHz, volume = 0.45 }) {
  const sampleRate = 22050
  const channelCount = 1
  const bitsPerSample = 16
  const bytesPerSample = bitsPerSample / 8
  const sampleCount = Math.max(1, Math.round((sampleRate * durationMs) / 1000))
  const dataSize = sampleCount * channelCount * bytesPerSample
  const buffer = Buffer.alloc(44 + dataSize)

  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(36 + dataSize, 4)
  buffer.write('WAVE', 8)
  buffer.write('fmt ', 12)
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20)
  buffer.writeUInt16LE(channelCount, 22)
  buffer.writeUInt32LE(sampleRate, 24)
  buffer.writeUInt32LE(sampleRate * channelCount * bytesPerSample, 28)
  buffer.writeUInt16LE(channelCount * bytesPerSample, 32)
  buffer.writeUInt16LE(bitsPerSample, 34)
  buffer.write('data', 36)
  buffer.writeUInt32LE(dataSize, 40)

  for (let index = 0; index < sampleCount; index += 1) {
    const time = index / sampleRate
    const fade = Math.min(1, index / (sampleRate * 0.02), (sampleCount - index) / (sampleRate * 0.04))
    const sample =
      Math.sin(2 * Math.PI * frequencyHz * time) * Math.max(0, Math.min(1, fade)) * volume
    buffer.writeInt16LE(Math.round(sample * 32767), 44 + index * bytesPerSample)
  }

  return buffer
}

function deriveAutoTagColor(name) {
  let seed = 0

  for (const char of name) {
    seed = (seed * 31 + char.charCodeAt(0)) % 360
  }

  return `hsl(${seed} 72% 78%)`
}

function toTitleCase(value) {
  return value
    .toLowerCase()
    .replace(/(^|[\s\-_]+)(\p{L})/gu, (match, prefix, letter) => `${prefix}${letter.toUpperCase()}`)
}

function normalizeTagNames(tagNames) {
  return Array.from(
    new Set(
      tagNames
        .map((tag) => tag.trim())
        .filter(Boolean),
    ),
  )
}

function applyTagRenameRule(name, rule) {
  let nextName = typeof name === 'string' ? name : ''
  const normalizedRule = rule ?? {}

  if (normalizedRule.trimWhitespace !== false) {
    nextName = nextName.trim()
  }

  if (normalizedRule.collapseSpaces) {
    nextName = nextName.replace(/\s+/g, ' ')
  }

  if (normalizedRule.findText) {
    nextName = nextName.split(normalizedRule.findText).join(normalizedRule.replaceText ?? '')
  }

  if (normalizedRule.prefix) {
    nextName = `${normalizedRule.prefix}${nextName}`
  }

  if (normalizedRule.suffix) {
    nextName = `${nextName}${normalizedRule.suffix}`
  }

  if (normalizedRule.caseMode === 'lower') {
    nextName = nextName.toLowerCase()
  } else if (normalizedRule.caseMode === 'upper') {
    nextName = nextName.toUpperCase()
  } else if (normalizedRule.caseMode === 'title') {
    nextName = toTitleCase(nextName)
  }

  if (normalizedRule.trimWhitespace !== false) {
    nextName = nextName.trim()
  }

  if (normalizedRule.collapseSpaces) {
    nextName = nextName.replace(/\s+/g, ' ')
  }

  return nextName
}

function cleanupUnusedTags(db) {
  return (
    db.prepare(`
      DELETE FROM tags
      WHERE NOT EXISTS (
        SELECT 1
        FROM cue_card_tags cct
        WHERE cct.tag_id = tags.id
      )
    `).run().changes ?? 0
  )
}

function readTagRow(db, tagId) {
  return db.prepare(`
    SELECT
      id,
      name,
      color,
      color_mode AS colorMode,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM tags
    WHERE id = ?
  `).get(tagId)
}

function readTagBindingRows(db, tagIds) {
  const normalizedTagIds = Array.from(new Set((tagIds ?? []).filter(Boolean)))

  if (normalizedTagIds.length === 0) {
    return []
  }

  return db.prepare(`
    SELECT
      cue_card_id AS cueCardId,
      tag_id AS tagId
    FROM cue_card_tags
    WHERE tag_id IN (${normalizedTagIds.map(() => '?').join(', ')})
    ORDER BY cue_card_id ASC, tag_id ASC
  `).all(...normalizedTagIds)
}

function ensureTagIds(db, tagNames, timestamp) {
  const normalizedNames = normalizeTagNames(tagNames)
  const tagIds = []

  for (const name of normalizedNames) {
    let tag = db.prepare('SELECT id FROM tags WHERE name = ?').get(name)

    if (!tag) {
      const tagId = randomUUID()
      db.prepare(`
        INSERT INTO tags (
          id,
          name,
          color,
          color_mode,
          created_at,
          updated_at
        ) VALUES (
          @id,
          @name,
          @color,
          'auto',
          @createdAt,
          @updatedAt
        )
      `).run({
        id: tagId,
        name,
        color: deriveAutoTagColor(name),
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      tag = { id: tagId }
    }

    tagIds.push(tag.id)
  }

  return tagIds
}

function touchTagIds(db, tagIds, timestamp) {
  const normalizedTagIds = Array.from(new Set((tagIds ?? []).filter(Boolean)))

  if (normalizedTagIds.length === 0) {
    return
  }

  for (const tagId of normalizedTagIds) {
    db.prepare(`
      UPDATE tags
      SET updated_at = @updatedAt
      WHERE id = @id
    `).run({
      id: tagId,
      updatedAt: timestamp,
    })
  }
}

async function safeUnlink(filePath) {
  try {
    await unlink(filePath)
  } catch {
    return false
  }

  return true
}

async function moveToTrash(filePath, trashDir) {
  const trashName = `${randomUUID()}-${basename(filePath)}`
  const trashPath = join(trashDir, trashName)

  try {
    await rename(filePath, trashPath)
    return { moved: true, trashPath, trashName }
  } catch {
    return { moved: false, trashPath: null, trashName: null }
  }
}

async function restoreFromTrash(trashPath, targetPath) {
  try {
    await rename(trashPath, targetPath)
    return true
  } catch {
    return false
  }
}

export async function cleanupUnusedLibraryEntries(db, storagePaths) {
  const orphanResources = db.prepare(`
    SELECT
      ar.id,
      ar.storage_filename AS storageFilename
    FROM audio_resources ar
    WHERE NOT EXISTS (
      SELECT 1
      FROM cue_cards cc
      WHERE cc.resource_id = ar.id
    )
  `).all()

  let deletedResourceCount = 0

  for (const resource of orphanResources) {
    const deleted = await safeUnlink(join(storagePaths.libraryDir, resource.storageFilename))

    if (deleted) {
      deletedResourceCount += 1
    }

    db.prepare('DELETE FROM audio_resources WHERE id = ?').run(resource.id)
  }

  const deletedTagCount = cleanupUnusedTags(db)

  return {
    deletedResourceCount,
    deletedTagCount,
  }
}

function createDeleteSnapshot(db, cueId) {
  const cue = db.prepare(`
    SELECT
      id,
      resource_id AS resourceId,
      name,
      hotkey,
      playback_rate AS playbackRate,
      volume,
      trim_start_ms AS trimStartMs,
      trim_end_ms AS trimEndMs,
      sort_order AS sortOrder,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM cue_cards
    WHERE id = ?
  `).get(cueId)

  if (!cue) {
    return null
  }

  const resource = db.prepare(`
    SELECT
      id,
      sha256,
      storage_filename AS storageFilename,
      source_extension AS sourceExtension,
      original_filename AS originalFilename,
      original_path AS originalPath,
      mime_type AS mimeType,
      duration_ms AS durationMs,
      sample_rate AS sampleRate,
      channels,
      size_bytes AS sizeBytes,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM audio_resources
    WHERE id = ?
  `).get(cue.resourceId)

  const tags = db.prepare(`
    SELECT
      t.id,
      t.name,
      t.color,
      t.color_mode AS colorMode,
      t.created_at AS createdAt,
      t.updated_at AS updatedAt
    FROM cue_card_tags cct
    INNER JOIN tags t ON t.id = cct.tag_id
    WHERE cct.cue_card_id = ?
  `).all(cueId)

  const resourceReferenceCount =
    db.prepare('SELECT COUNT(*) AS count FROM cue_cards WHERE resource_id = ?').get(cue.resourceId).count ?? 0

  return {
    cue,
    resource,
    tags,
    resourceReferenceCount,
  }
}

export function createCueTransferSnapshot(db, storagePaths, cueId) {
  const snapshot = createDeleteSnapshot(db, cueId)

  if (!snapshot?.cue || !snapshot.resource) {
    return null
  }

  return {
    cue: snapshot.cue,
    resource: {
      ...snapshot.resource,
      absolutePath: join(storagePaths.libraryDir, snapshot.resource.storageFilename),
    },
    tags: snapshot.tags ?? [],
  }
}

export async function insertCueTransferSnapshot(db, storagePaths, snapshot, options = {}) {
  if (!snapshot?.cue || !snapshot?.resource) {
    throw new Error('Cue transfer snapshot is incomplete')
  }

  const timestamp = nowIso()
  const nextCueId = randomUUID()
  const desiredName = snapshot.cue.name
  const preferTagMetadata = options.preferTagMetadata === true
  const overwriteByName = options.overwriteByName === true

  if (overwriteByName) {
    const existingCues = db.prepare(`
      SELECT id
      FROM cue_cards
      WHERE name = ?
    `).all(desiredName)

    for (const existingCue of existingCues) {
      db.prepare('DELETE FROM cue_cards WHERE id = ?').run(existingCue.id)
    }
  }

  const existingResource = db.prepare(`
    SELECT id
    FROM audio_resources
    WHERE sha256 = ?
  `).get(snapshot.resource.sha256)

  let resourceId = existingResource?.id ?? null

  if (!resourceId) {
    const nextResourceId = randomUUID()
    const storageFilename = `${nextResourceId}${snapshot.resource.sourceExtension}`
    await copyFileAsync(snapshot.resource.absolutePath, join(storagePaths.libraryDir, storageFilename))

    db.prepare(`
      INSERT INTO audio_resources (
        id,
        sha256,
        storage_filename,
        source_extension,
        original_filename,
        original_path,
        mime_type,
        duration_ms,
        sample_rate,
        channels,
        size_bytes,
        created_at,
        updated_at
      ) VALUES (
        @id,
        @sha256,
        @storageFilename,
        @sourceExtension,
        @originalFilename,
        @originalPath,
        @mimeType,
        @durationMs,
        @sampleRate,
        @channels,
        @sizeBytes,
        @createdAt,
        @updatedAt
      )
    `).run({
      id: nextResourceId,
      sha256: snapshot.resource.sha256,
      storageFilename,
      sourceExtension: snapshot.resource.sourceExtension,
      originalFilename: snapshot.resource.originalFilename,
      originalPath: snapshot.resource.originalPath,
      mimeType: snapshot.resource.mimeType,
      durationMs: snapshot.resource.durationMs,
      sampleRate: snapshot.resource.sampleRate,
      channels: snapshot.resource.channels,
      sizeBytes: snapshot.resource.sizeBytes,
      createdAt: timestamp,
      updatedAt: timestamp,
    })

    resourceId = nextResourceId
  }

  const nextSortOrder =
    (db.prepare('SELECT COALESCE(MAX(sort_order), -1) AS value FROM cue_cards').get().value ?? -1) + 1

  db.prepare(`
    INSERT INTO cue_cards (
      id,
      resource_id,
      name,
      hotkey,
      playback_rate,
      volume,
      trim_start_ms,
      trim_end_ms,
      sort_order,
      created_at,
      updated_at
    ) VALUES (
      @id,
      @resourceId,
      @name,
      @hotkey,
      @playbackRate,
      @volume,
      @trimStartMs,
      @trimEndMs,
      @sortOrder,
      @createdAt,
      @updatedAt
    )
  `).run({
    id: nextCueId,
    resourceId,
    name: desiredName,
    hotkey: snapshot.cue.hotkey,
    playbackRate: snapshot.cue.playbackRate,
    volume: snapshot.cue.volume,
    trimStartMs: snapshot.cue.trimStartMs,
    trimEndMs: snapshot.cue.trimEndMs,
    sortOrder: nextSortOrder,
    createdAt: timestamp,
    updatedAt: timestamp,
  })

  const tagIds = []

  for (const tag of snapshot.tags ?? []) {
    const existingTag = db.prepare(`
      SELECT id
      FROM tags
      WHERE name = ?
    `).get(tag.name)

    if (existingTag?.id) {
      tagIds.push(existingTag.id)

      if (preferTagMetadata) {
        db.prepare(`
          UPDATE tags
          SET
            color = @color,
            color_mode = @colorMode,
            updated_at = @updatedAt
          WHERE id = @id
        `).run({
          id: existingTag.id,
          color: tag.color,
          colorMode: tag.colorMode,
          updatedAt: timestamp,
        })
      }

      continue
    }

    db.prepare(`
      INSERT INTO tags (
        id,
        name,
        color,
        color_mode,
        created_at,
        updated_at
      ) VALUES (
        @id,
        @name,
        @color,
        @colorMode,
        @createdAt,
        @updatedAt
      )
    `).run({
      id: randomUUID(),
      name: tag.name,
      color: tag.color,
      colorMode: tag.colorMode,
      createdAt: timestamp,
      updatedAt: timestamp,
    })

    const insertedTag = db.prepare(`
      SELECT id
      FROM tags
      WHERE name = ?
    `).get(tag.name)
    tagIds.push(insertedTag.id)
  }

  for (const tagId of tagIds) {
    db.prepare(`
      INSERT INTO cue_card_tags (cue_card_id, tag_id)
      VALUES (?, ?)
    `).run(nextCueId, tagId)
  }

  touchTagIds(db, tagIds, timestamp)

  return nextCueId
}

export function normalizeCueSortOrder(db) {
  const cueRows = db.prepare(`
    SELECT id
    FROM cue_cards
    ORDER BY sort_order ASC, created_at ASC
  `).all()
  const timestamp = nowIso()

  cueRows.forEach((cue, index) => {
    db.prepare(`
      UPDATE cue_cards
      SET
        sort_order = @sortOrder,
        updated_at = @updatedAt
      WHERE id = @id
    `).run({
      id: cue.id,
      sortOrder: index,
      updatedAt: timestamp,
    })
  })
}

export async function importAudioPaths(db, storagePaths, inputPaths, options = {}) {
  const onProgress = options.onProgress ?? noop
  onProgress({
    phase: 'scanning',
    completed: 0,
    total: 0,
    importedCueCount: 0,
    failedCount: 0,
    currentPath: null,
  })

  const { supportedFiles, invalidPathCount, discoveryFailures } = await collectImportableAudioFiles(inputPaths)
  const discoveredFiles = Array.from(new Set(supportedFiles))
  const skippedDuplicateInputCount = supportedFiles.length - discoveredFiles.length
  const failedImports = [...discoveryFailures]

  onProgress({
    phase: 'importing',
    completed: 0,
    total: discoveredFiles.length,
    importedCueCount: 0,
    failedCount: failedImports.length,
    currentPath: null,
  })

  if (discoveredFiles.length === 0) {
    return {
      invalidPathCount,
      skippedDuplicateInputCount,
      totalDiscovered: 0,
      importedCueCount: 0,
      importedResourceCount: 0,
      reusedResourceCount: 0,
      skippedCount: 0,
      failedImports,
    }
  }

  let nextSortOrder =
    (db.prepare('SELECT COALESCE(MAX(sort_order), -1) AS value FROM cue_cards').get().value ?? -1) +
    1
  let importedCueCount = 0
  let importedResourceCount = 0
  let reusedResourceCount = 0
  const importedCueIds = []
  const importedResourceIds = []

  for (const filePath of discoveredFiles) {
    let sha256

    try {
      sha256 = await hashFile(filePath)
    } catch (error) {
      const failure = classifyFsFailure(error, 'hash_failed')
      failedImports.push(createImportFailure(filePath, failure.code, failure.reason, failure.retryable))
      onProgress({
        phase: 'importing',
        completed: importedCueCount + failedImports.length - discoveryFailures.length,
        total: discoveredFiles.length,
        importedCueCount,
        failedCount: failedImports.length,
        currentPath: filePath,
      })
      continue
    }

    const existingResource = db
      .prepare('SELECT id FROM audio_resources WHERE sha256 = ?')
      .get(sha256)

    let resourceId = existingResource?.id ?? null
    let createdResource = null

    if (!resourceId) {
      let resourceEntry
      let metadata
      let extension
      const resourceUuid = randomUUID()
      const timestamp = nowIso()

      try {
        resourceEntry = await stat(filePath)
        metadata = await parseFile(filePath, { duration: true })
        extension = extname(filePath).toLowerCase()
      } catch (error) {
        const failure = classifyFsFailure(error, 'metadata_read_failed')
        failedImports.push(createImportFailure(filePath, failure.code, failure.reason, failure.retryable))
        onProgress({
          phase: 'importing',
          completed: importedCueCount + failedImports.length - discoveryFailures.length,
          total: discoveredFiles.length,
          importedCueCount,
          failedCount: failedImports.length,
          currentPath: filePath,
        })
        continue
      }

      const storageFilename = `${resourceUuid}${extension}`

      try {
        await copyFileAsync(filePath, join(storagePaths.libraryDir, storageFilename))
      } catch (error) {
        const failure = classifyFsFailure(error, 'library_copy_failed')
        failedImports.push(createImportFailure(filePath, failure.code, failure.reason, failure.retryable))
        onProgress({
          phase: 'importing',
          completed: importedCueCount + failedImports.length - discoveryFailures.length,
          total: discoveredFiles.length,
          importedCueCount,
          failedCount: failedImports.length,
          currentPath: filePath,
        })
        continue
      }

      try {
        db.prepare(`
          INSERT INTO audio_resources (
            id,
            sha256,
            storage_filename,
            source_extension,
            original_filename,
            original_path,
            mime_type,
            duration_ms,
            sample_rate,
            channels,
            size_bytes,
            created_at,
            updated_at
          ) VALUES (
            @id,
            @sha256,
            @storageFilename,
            @sourceExtension,
            @originalFilename,
            @originalPath,
            @mimeType,
            @durationMs,
            @sampleRate,
            @channels,
            @sizeBytes,
            @createdAt,
            @updatedAt
          )
        `).run({
          id: resourceUuid,
          sha256,
          storageFilename,
          sourceExtension: extension,
          originalFilename: basename(filePath),
          originalPath: filePath,
          mimeType: null,
          durationMs: metadata.format.duration ? Math.round(metadata.format.duration * 1000) : null,
          sampleRate: metadata.format.sampleRate ?? null,
          channels: metadata.format.numberOfChannels ?? null,
          sizeBytes: resourceEntry.size,
          createdAt: timestamp,
          updatedAt: timestamp,
        })
      } catch (error) {
        await safeUnlink(join(storagePaths.libraryDir, storageFilename))
        const failure = classifyFsFailure(error, 'database_write_failed')
        failedImports.push(createImportFailure(filePath, failure.code, failure.reason, failure.retryable))
        onProgress({
          phase: 'importing',
          completed: importedCueCount + failedImports.length - discoveryFailures.length,
          total: discoveredFiles.length,
          importedCueCount,
          failedCount: failedImports.length,
          currentPath: filePath,
        })
        continue
      }

      resourceId = resourceUuid
      createdResource = {
        id: resourceUuid,
        storageFilename,
      }
      importedResourceCount += 1
      importedResourceIds.push(resourceUuid)
    } else {
      reusedResourceCount += 1
    }

    const cueId = randomUUID()
    const timestamp = nowIso()

    try {
      db.prepare(`
        INSERT INTO cue_cards (
          id,
          resource_id,
          name,
          hotkey,
          playback_rate,
          volume,
          trim_start_ms,
          trim_end_ms,
          sort_order,
          created_at,
          updated_at
        ) VALUES (
          @id,
          @resourceId,
          @name,
          '',
          1,
          1,
          0,
          NULL,
          @sortOrder,
          @createdAt,
          @updatedAt
        )
      `).run({
        id: cueId,
        resourceId,
        name: getDisplayName(filePath),
        sortOrder: nextSortOrder,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
    } catch (error) {
      if (createdResource) {
        db.prepare('DELETE FROM audio_resources WHERE id = ?').run(createdResource.id)
        await safeUnlink(join(storagePaths.libraryDir, createdResource.storageFilename))
        importedResourceCount = Math.max(0, importedResourceCount - 1)
        const resourceIndex = importedResourceIds.indexOf(createdResource.id)
        if (resourceIndex >= 0) {
          importedResourceIds.splice(resourceIndex, 1)
        }
      }

      const failure = classifyFsFailure(error, 'database_write_failed')
      failedImports.push(createImportFailure(filePath, failure.code, failure.reason, failure.retryable))
      onProgress({
        phase: 'importing',
        completed: importedCueCount + failedImports.length - discoveryFailures.length,
        total: discoveredFiles.length,
        importedCueCount,
        failedCount: failedImports.length,
        currentPath: filePath,
      })
      continue
    }

    importedCueCount += 1
    importedCueIds.push(cueId)
    nextSortOrder += 1
    onProgress({
      phase: 'importing',
      completed: importedCueCount + failedImports.length - discoveryFailures.length,
      total: discoveredFiles.length,
      importedCueCount,
      failedCount: failedImports.length,
      currentPath: filePath,
    })
  }

  onProgress({
    phase: 'complete',
    completed: discoveredFiles.length,
    total: discoveredFiles.length,
    importedCueCount,
    failedCount: failedImports.length,
    currentPath: null,
  })

  return {
    invalidPathCount,
    skippedDuplicateInputCount,
    totalDiscovered: discoveredFiles.length,
    importedCueCount,
    importedResourceCount,
    reusedResourceCount,
    skippedCount: failedImports.length,
    failedImports,
    importedCueIds,
    importedResourceIds,
  }
}

export async function createStarterPack(db, storagePaths, options = {}) {
  const language = options.language ?? 'zh-CN'
  const starterDefinitions =
    language === 'zh-CN'
      ? [
          {
            filename: 'starter-intro-sting.wav',
            name: '开场短音',
            frequencyHz: 660,
            durationMs: 620,
            tags: ['样例', '开场'],
            trimEndMs: 540,
          },
          {
            filename: 'starter-hype-hit.wav',
            name: '带动点',
            frequencyHz: 880,
            durationMs: 420,
            tags: ['样例', '气氛'],
            trimEndMs: 360,
          },
          {
            filename: 'starter-outro-fall.wav',
            name: '收尾落音',
            frequencyHz: 330,
            durationMs: 900,
            tags: ['样例', '收尾'],
            trimEndMs: 820,
          },
        ]
      : [
          {
            filename: 'starter-intro-sting.wav',
            name: 'Intro Sting',
            frequencyHz: 660,
            durationMs: 620,
            tags: ['demo', 'intro'],
            trimEndMs: 540,
          },
          {
            filename: 'starter-hype-hit.wav',
            name: 'Hype Hit',
            frequencyHz: 880,
            durationMs: 420,
            tags: ['demo', 'hype'],
            trimEndMs: 360,
          },
          {
            filename: 'starter-outro-fall.wav',
            name: 'Outro Fall',
            frequencyHz: 330,
            durationMs: 900,
            tags: ['demo', 'outro'],
            trimEndMs: 820,
          },
        ]

  let nextSortOrder =
    (db.prepare('SELECT COALESCE(MAX(sort_order), -1) AS value FROM cue_cards').get().value ?? -1) +
    1
  const createdCueIds = []
  const createdResourceIds = []

  for (const starter of starterDefinitions) {
    const cueId = randomUUID()
    const timestamp = nowIso()
    const wavBuffer = createToneWavBuffer({
      durationMs: starter.durationMs,
      frequencyHz: starter.frequencyHz,
    })
    const sha256 = hashBuffer(wavBuffer)
    const existingResource = db
      .prepare('SELECT id, storage_filename AS storageFilename FROM audio_resources WHERE sha256 = ?')
      .get(sha256)
    let resourceId = existingResource?.id ?? null

    if (!resourceId) {
      resourceId = randomUUID()
      const storageFilename = `${resourceId}.wav`

      await writeFile(join(storagePaths.libraryDir, storageFilename), wavBuffer)

      db.prepare(`
        INSERT INTO audio_resources (
          id,
          sha256,
          storage_filename,
          source_extension,
          original_filename,
          original_path,
          mime_type,
          duration_ms,
          sample_rate,
          channels,
          size_bytes,
          created_at,
          updated_at
        ) VALUES (
          @id,
          @sha256,
          @storageFilename,
          '.wav',
          @originalFilename,
          NULL,
          'audio/wav',
          @durationMs,
          22050,
          1,
          @sizeBytes,
          @createdAt,
          @updatedAt
        )
      `).run({
        id: resourceId,
        sha256,
        storageFilename,
        originalFilename: starter.filename,
        durationMs: starter.durationMs,
        sizeBytes: wavBuffer.length,
        createdAt: timestamp,
        updatedAt: timestamp,
      })

      createdResourceIds.push(resourceId)
    }

    db.prepare(`
      INSERT INTO cue_cards (
        id,
        resource_id,
        name,
        hotkey,
        playback_rate,
        volume,
        trim_start_ms,
        trim_end_ms,
        sort_order,
        created_at,
        updated_at
      ) VALUES (
        @id,
        @resourceId,
        @name,
        '',
        1,
        1,
        0,
        @trimEndMs,
        @sortOrder,
        @createdAt,
        @updatedAt
      )
    `).run({
      id: cueId,
      resourceId,
      name: starter.name,
      trimEndMs: starter.trimEndMs,
      sortOrder: nextSortOrder,
      createdAt: timestamp,
      updatedAt: timestamp,
    })

    const tagIds = ensureTagIds(db, starter.tags, timestamp)
    for (const tagId of tagIds) {
      db.prepare(`
        INSERT INTO cue_card_tags (cue_card_id, tag_id)
        VALUES (?, ?)
      `).run(cueId, tagId)
    }

    touchTagIds(db, tagIds, timestamp)

    createdCueIds.push(cueId)
    nextSortOrder += 1
  }

  return {
    createdCueIds,
    createdResourceIds,
    createdCueCount: createdCueIds.length,
  }
}

export function updateCueCard(db, cueId, patch) {
  const current = db
    .prepare(`
      SELECT
        id,
        name,
        hotkey,
        playback_rate AS playbackRate,
        volume,
        trim_start_ms AS trimStartMs,
        trim_end_ms AS trimEndMs,
        sort_order AS sortOrder
      FROM cue_cards
      WHERE id = ?
    `)
    .get(cueId)

  if (!current) {
    throw new Error(`Cue card not found: ${cueId}`)
  }

  const next = {
    ...current,
    ...patch,
    updatedAt: nowIso(),
  }

  db.prepare(`
    UPDATE cue_cards
    SET
      name = @name,
      hotkey = @hotkey,
      playback_rate = @playbackRate,
      volume = @volume,
      trim_start_ms = @trimStartMs,
      trim_end_ms = @trimEndMs,
      sort_order = @sortOrder,
      updated_at = @updatedAt
    WHERE id = @id
  `).run({
    id: cueId,
    name: next.name,
    hotkey: next.hotkey,
    playbackRate: next.playbackRate,
    volume: next.volume,
    trimStartMs: next.trimStartMs,
    trimEndMs: next.trimEndMs,
    sortOrder: next.sortOrder,
    updatedAt: next.updatedAt,
  })
}

export function replaceCueCardTags(db, cueId, tagNames) {
  const timestamp = nowIso()

  const transaction = db.transaction(() => {
    const currentTagIds = db
      .prepare(`
        SELECT tag_id AS tagId
        FROM cue_card_tags
        WHERE cue_card_id = ?
      `)
      .all(cueId)
      .map((row) => row.tagId)

    db.prepare('DELETE FROM cue_card_tags WHERE cue_card_id = ?').run(cueId)
    const tagIds = ensureTagIds(db, tagNames, timestamp)

    for (const tagId of tagIds) {
      db.prepare(`
        INSERT INTO cue_card_tags (cue_card_id, tag_id)
        VALUES (?, ?)
      `).run(cueId, tagId)
    }

    touchTagIds(db, [...currentTagIds, ...tagIds], timestamp)
    cleanupUnusedTags(db)
  })

  transaction()
}

export function bulkUpdateCueTags(db, cueIds, tagNames, mode) {
  const normalizedCueIds = Array.from(new Set(cueIds.filter(Boolean)))
  const normalizedNames = normalizeTagNames(tagNames)
  const timestamp = nowIso()

  const transaction = db.transaction(() => {
    const ensuredTagIds =
      mode === 'remove' ? [] : ensureTagIds(db, normalizedNames, timestamp)

    for (const cueId of normalizedCueIds) {
      const currentTagIds = db
        .prepare(`
          SELECT tag_id AS tagId
          FROM cue_card_tags
          WHERE cue_card_id = ?
        `)
        .all(cueId)
        .map((row) => row.tagId)

      let nextTagIds = currentTagIds

      if (mode === 'replace') {
        nextTagIds = ensuredTagIds
      } else if (mode === 'add') {
        nextTagIds = Array.from(new Set([...currentTagIds, ...ensuredTagIds]))
      } else if (mode === 'remove') {
        const removableTagIds =
          normalizedNames.length === 0
            ? []
            : db
                .prepare(`
                  SELECT id
                  FROM tags
                  WHERE name IN (${normalizedNames.map(() => '?').join(', ')})
                `)
                .all(...normalizedNames)
                .map((row) => row.id)

        nextTagIds = currentTagIds.filter((tagId) => !removableTagIds.includes(tagId))
      }

      db.prepare('DELETE FROM cue_card_tags WHERE cue_card_id = ?').run(cueId)

      for (const tagId of nextTagIds) {
        db.prepare(`
          INSERT INTO cue_card_tags (cue_card_id, tag_id)
          VALUES (?, ?)
        `).run(cueId, tagId)
      }

      touchTagIds(db, [...currentTagIds, ...nextTagIds], timestamp)
    }

    cleanupUnusedTags(db)
  })

  transaction()
}

export function reorderCueCards(db, orderedCueIds) {
  const normalizedCueIds = Array.from(new Set(orderedCueIds.filter(Boolean)))

  const transaction = db.transaction(() => {
    normalizedCueIds.forEach((cueId, index) => {
      db.prepare(`
        UPDATE cue_cards
        SET
          sort_order = @sortOrder,
          updated_at = @updatedAt
        WHERE id = @id
      `).run({
        id: cueId,
        sortOrder: index,
        updatedAt: nowIso(),
      })
    })
  })

  transaction()
}

export function updateTagColor(db, tagId, color) {
  db.prepare(`
    UPDATE tags
    SET
      color = @color,
      color_mode = @colorMode,
      updated_at = @updatedAt
    WHERE id = @id
  `).run({
    id: tagId,
    color,
    colorMode: color ? 'manual' : 'auto',
    updatedAt: nowIso(),
  })
}

export function batchUpdateTagColor(db, tagIds, color) {
  const normalizedTagIds = Array.from(new Set((tagIds ?? []).filter(Boolean)))

  if (normalizedTagIds.length === 0) {
    throw new Error('Select at least one tag to recolor')
  }

  const updatedAt = nowIso()
  const transaction = db.transaction(() => {
    for (const tagId of normalizedTagIds) {
      db.prepare(`
        UPDATE tags
        SET
          color = @color,
          color_mode = @colorMode,
          updated_at = @updatedAt
        WHERE id = @id
      `).run({
        id: tagId,
        color,
        colorMode: color ? 'manual' : 'auto',
        updatedAt,
      })
    }
  })

  transaction()

  return {
    updatedCount: normalizedTagIds.length,
  }
}

export function renameTag(db, tagId, nextName) {
  const normalizedName = typeof nextName === 'string' ? nextName.trim() : ''

  if (!normalizedName) {
    throw new Error('Tag name cannot be empty')
  }

  const currentTag = db.prepare(`
    SELECT id, name
    FROM tags
    WHERE id = ?
  `).get(tagId)

  if (!currentTag) {
    throw new Error('Tag does not exist')
  }

  if (currentTag.name === normalizedName) {
    return {
      action: 'noop',
      history: null,
    }
  }

  const timestamp = nowIso()
  const existingTag = db.prepare(`
    SELECT id
    FROM tags
    WHERE name = ?
      AND id <> ?
  `).get(normalizedName, tagId)
  const trackedTagIds = [tagId, existingTag?.id].filter(Boolean)
  const history = {
    action: existingTag ? 'merge' : 'rename',
    sourceTagBefore: readTagRow(db, tagId),
    targetTagBefore: existingTag ? readTagRow(db, existingTag.id) : null,
    bindingsBefore: readTagBindingRows(db, trackedTagIds),
    nextName: normalizedName,
  }

  const transaction = db.transaction(() => {
    if (existingTag) {
      const cueRows = db.prepare(`
        SELECT cue_card_id AS cueCardId
        FROM cue_card_tags
        WHERE tag_id = ?
      `).all(tagId)

      for (const row of cueRows) {
        db.prepare(`
          INSERT OR IGNORE INTO cue_card_tags (cue_card_id, tag_id)
          VALUES (?, ?)
        `).run(row.cueCardId, existingTag.id)
      }

      db.prepare('DELETE FROM cue_card_tags WHERE tag_id = ?').run(tagId)
      touchTagIds(db, [existingTag.id], timestamp)
      db.prepare('DELETE FROM tags WHERE id = ?').run(tagId)
      cleanupUnusedTags(db)
      return
    }

    db.prepare(`
      UPDATE tags
      SET
        name = @name,
        updated_at = @updatedAt
      WHERE id = @id
    `).run({
      id: tagId,
      name: normalizedName,
      updatedAt: timestamp,
    })
  })

  transaction()

  return {
    action: history.action,
    history,
  }
}

export function deleteTag(db, tagId) {
  const tagBefore = readTagRow(db, tagId)

  if (!tagBefore) {
    throw new Error('Tag does not exist')
  }

  const history = {
    action: 'delete',
    sourceTagBefore: tagBefore,
    targetTagBefore: null,
    bindingsBefore: readTagBindingRows(db, [tagId]),
    nextName: null,
  }

  const transaction = db.transaction(() => {
    db.prepare('DELETE FROM cue_card_tags WHERE tag_id = ?').run(tagId)
    db.prepare('DELETE FROM tags WHERE id = ?').run(tagId)
    cleanupUnusedTags(db)
  })

  transaction()

  return {
    action: 'delete',
    history,
  }
}

export function batchDeleteTags(db, tagIds) {
  const normalizedTagIds = Array.from(new Set((tagIds ?? []).filter(Boolean)))

  if (normalizedTagIds.length === 0) {
    throw new Error('Select at least one tag to delete')
  }

  const operations = []

  for (const tagId of normalizedTagIds) {
    const result = deleteTag(db, tagId)
    if (result?.history) {
      operations.push(result.history)
    }
  }

  return {
    deletedCount: operations.length,
    operations,
  }
}

export function batchMergeTags(db, tagIds, targetName) {
  const normalizedTargetName = typeof targetName === 'string' ? targetName.trim() : ''

  if (!normalizedTargetName) {
    throw new Error('Target tag name cannot be empty')
  }

  const normalizedTagIds = Array.from(new Set((tagIds ?? []).filter(Boolean)))

  if (normalizedTagIds.length === 0) {
    throw new Error('Select at least one tag to merge')
  }

  const selectedTags = db.prepare(`
    SELECT id, name
    FROM tags
    WHERE id IN (${normalizedTagIds.map(() => '?').join(', ')})
    ORDER BY name COLLATE NOCASE ASC
  `).all(...normalizedTagIds)

  if (selectedTags.length === 0) {
    throw new Error('Selected tags do not exist')
  }

  const selectedById = new Map(selectedTags.map((tag) => [tag.id, tag]))
  const operations = []

  let activeTargetTag = selectedTags.find((tag) => tag.name === normalizedTargetName) ?? null
  let seedTagId = activeTargetTag?.id ?? selectedTags[0].id

  if (!activeTargetTag) {
    const renameResult = renameTag(db, seedTagId, normalizedTargetName)
    if (renameResult?.history) {
      operations.push(renameResult.history)
    }
    activeTargetTag = db.prepare(`
      SELECT id, name
      FROM tags
      WHERE name = ?
    `).get(normalizedTargetName)
    seedTagId = activeTargetTag?.id ?? seedTagId
  }

  for (const tag of selectedTags) {
    if (!selectedById.has(tag.id) || tag.id === seedTagId) {
      continue
    }

    const mergeResult = renameTag(db, tag.id, normalizedTargetName)
    if (mergeResult?.history) {
      operations.push(mergeResult.history)
    }
  }

  return {
    selectedCount: selectedTags.length,
    mergedCount: operations.filter((entry) => entry.action === 'merge').length,
    operations,
    targetName: normalizedTargetName,
  }
}

export function batchRenameTagsByRule(db, tagIds, rule) {
  const normalizedTagIds = Array.from(new Set((tagIds ?? []).filter(Boolean)))

  if (normalizedTagIds.length === 0) {
    throw new Error('Select at least one tag to rename')
  }

  const selectedTags = db.prepare(`
    SELECT id, name
    FROM tags
    WHERE id IN (${normalizedTagIds.map(() => '?').join(', ')})
    ORDER BY name COLLATE NOCASE ASC
  `).all(...normalizedTagIds)

  if (selectedTags.length === 0) {
    throw new Error('Selected tags do not exist')
  }

  const preview = selectedTags.map((tag) => ({
    tagId: tag.id,
    previousName: tag.name,
    nextName: applyTagRenameRule(tag.name, rule),
  }))

  const actionable = preview.filter((entry) => entry.nextName && entry.nextName !== entry.previousName)
  const operations = []

  for (const entry of actionable) {
    const result = renameTag(db, entry.tagId, entry.nextName)
    if (result?.history) {
      operations.push(result.history)
    }
  }

  return {
    renamedCount: operations.length,
    preview,
    operations,
  }
}

export async function deleteCueCard(db, storagePaths, cueId) {
  const snapshot = createDeleteSnapshot(db, cueId)
  db.prepare('DELETE FROM cue_cards WHERE id = ?').run(cueId)

  const deletedResourceBackups = []
  const orphanResources = db.prepare(`
    SELECT
      ar.id,
      ar.storage_filename AS storageFilename
    FROM audio_resources ar
    WHERE NOT EXISTS (
      SELECT 1
      FROM cue_cards cc
      WHERE cc.resource_id = ar.id
    )
  `).all()

  let deletedResourceCount = 0

  for (const resource of orphanResources) {
    const sourcePath = join(storagePaths.libraryDir, resource.storageFilename)
    const moveResult = await moveToTrash(sourcePath, storagePaths.trashDir)

    if (moveResult.moved) {
      deletedResourceCount += 1
      deletedResourceBackups.push({
        resourceId: resource.id,
        trashPath: moveResult.trashPath,
      })
    } else {
      const deleted = await safeUnlink(sourcePath)
      if (deleted) {
        deletedResourceCount += 1
      }
    }

    db.prepare('DELETE FROM audio_resources WHERE id = ?').run(resource.id)
  }

  const deletedTagCount = cleanupUnusedTags(db)

  return {
    cleanup: {
      deletedResourceCount,
      deletedTagCount,
    },
    snapshot,
    deletedResourceBackups,
  }
}

export async function undoDeleteCue(db, storagePaths, payload) {
  const { snapshot, deletedResourceBackups } = payload

  if (!snapshot?.cue || !snapshot.resource) {
    throw new Error('Delete history payload is incomplete')
  }

  const resourceExists = db.prepare('SELECT 1 FROM audio_resources WHERE id = ?').get(snapshot.resource.id)

  if (!resourceExists) {
    const backup = deletedResourceBackups.find((entry) => entry.resourceId === snapshot.resource.id)

    if (backup?.trashPath) {
      await restoreFromTrash(backup.trashPath, join(storagePaths.libraryDir, snapshot.resource.storageFilename))
    }

    db.prepare(`
      INSERT INTO audio_resources (
        id,
        sha256,
        storage_filename,
        source_extension,
        original_filename,
        original_path,
        mime_type,
        duration_ms,
        sample_rate,
        channels,
        size_bytes,
        created_at,
        updated_at
      ) VALUES (
        @id,
        @sha256,
        @storageFilename,
        @sourceExtension,
        @originalFilename,
        @originalPath,
        @mimeType,
        @durationMs,
        @sampleRate,
        @channels,
        @sizeBytes,
        @createdAt,
        @updatedAt
      )
    `).run(snapshot.resource)
  }

  db.prepare(`
    INSERT INTO cue_cards (
      id,
      resource_id,
      name,
      hotkey,
      playback_rate,
      volume,
      trim_start_ms,
      trim_end_ms,
      sort_order,
      created_at,
      updated_at
    ) VALUES (
      @id,
      @resourceId,
      @name,
      @hotkey,
      @playbackRate,
      @volume,
      @trimStartMs,
      @trimEndMs,
      @sortOrder,
      @createdAt,
      @updatedAt
    )
  `).run(snapshot.cue)

  for (const tag of snapshot.tags ?? []) {
    db.prepare(`
      INSERT INTO tags (
        id,
        name,
        color,
        color_mode,
        created_at,
        updated_at
      ) VALUES (
        @id,
        @name,
        @color,
        @colorMode,
        @createdAt,
        @updatedAt
      )
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        color = excluded.color,
        color_mode = excluded.color_mode,
        updated_at = excluded.updated_at
    `).run(tag)

    db.prepare(`
      INSERT OR IGNORE INTO cue_card_tags (cue_card_id, tag_id)
      VALUES (?, ?)
    `).run(snapshot.cue.id, tag.id)
  }
}

export async function undoImportAction(db, storagePaths, payload) {
  const cueIds = payload?.importedCueIds ?? []

  for (const cueId of cueIds) {
    db.prepare('DELETE FROM cue_cards WHERE id = ?').run(cueId)
  }

  return cleanupUnusedLibraryEntries(db, storagePaths)
}

export function undoTagOperation(db, payload) {
  if (Array.isArray(payload?.operations)) {
    for (const operation of [...payload.operations].reverse()) {
      undoTagOperation(db, operation)
    }
    return
  }

  const sourceTagBefore = payload?.sourceTagBefore

  if (!sourceTagBefore?.id) {
    throw new Error('Tag history payload is incomplete')
  }

  const targetTagBefore = payload?.targetTagBefore ?? null
  const trackedTagIds = [sourceTagBefore.id, targetTagBefore?.id].filter(Boolean)
  const trackedCueIds = Array.from(
    new Set((payload?.bindingsBefore ?? []).map((row) => row.cueCardId).filter(Boolean)),
  )

  const transaction = db.transaction(() => {
    db.prepare(`
      INSERT INTO tags (
        id,
        name,
        color,
        color_mode,
        created_at,
        updated_at
      ) VALUES (
        @id,
        @name,
        @color,
        @colorMode,
        @createdAt,
        @updatedAt
      )
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        color = excluded.color,
        color_mode = excluded.color_mode,
        updated_at = excluded.updated_at
    `).run(sourceTagBefore)

    if (targetTagBefore?.id) {
      db.prepare(`
        INSERT INTO tags (
          id,
          name,
          color,
          color_mode,
          created_at,
          updated_at
        ) VALUES (
          @id,
          @name,
          @color,
          @colorMode,
          @createdAt,
          @updatedAt
        )
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          color = excluded.color,
          color_mode = excluded.color_mode,
          updated_at = excluded.updated_at
      `).run(targetTagBefore)
    }

    if (trackedCueIds.length > 0 && trackedTagIds.length > 0) {
      db.prepare(`
        DELETE FROM cue_card_tags
        WHERE cue_card_id IN (${trackedCueIds.map(() => '?').join(', ')})
          AND tag_id IN (${trackedTagIds.map(() => '?').join(', ')})
      `).run(...trackedCueIds, ...trackedTagIds)
    }

    for (const row of payload?.bindingsBefore ?? []) {
      db.prepare(`
        INSERT OR IGNORE INTO cue_card_tags (cue_card_id, tag_id)
        VALUES (?, ?)
      `).run(row.cueCardId, row.tagId)
    }

    cleanupUnusedTags(db)
  })

  transaction()
}
