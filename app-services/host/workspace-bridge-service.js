import { randomUUID } from 'node:crypto'
import { unlink } from 'node:fs/promises'
import {
  applyShortcutRepair,
  batchDeleteTags,
  batchMergeTags,
  batchRenameTagsByRule,
  batchUpdateTagColor,
  bulkUpdateCueTags,
  cleanupUnusedLibraryEntries,
  collectShortcutDiagnostics,
  createHistoryEntry,
  createShortcutRepairPlan,
  createStarterPack,
  createStoragePaths,
  deleteCueCard,
  deleteTag,
  ensureStorageDirectories,
  importAudioPaths,
  markHistoryEntryUndone,
  openAppDatabase,
  pruneHistoryEntries,
  readBoardSnapshot,
  readBootstrapSnapshot,
  readHistoryEntries,
  readHistoryEntryById,
  readSettings,
  readShortcutEntries,
  renameTag,
  reorderCueCards,
  replaceCueCardTags,
  undoDeleteCue,
  undoImportAction,
  undoTagOperation,
  updateCueCard,
  updateTagColor,
  writeSettings,
} from '../index.js'

function normalizeStorageContext(context = {}) {
  if (!context.dataRoot || typeof context.dataRoot !== 'string') {
    throw new Error('Bridge storage context requires a dataRoot')
  }

  return createStoragePaths({
    dataRoot: context.dataRoot,
    mode: context.mode === 'portable' ? 'portable' : 'installed',
  })
}

function buildShortcutDiagnostics(db) {
  const entries = readShortcutEntries(db, { includeEmpty: true })
  const analysis = collectShortcutDiagnostics(entries)

  return {
    failedCueIds: [],
    duplicateCueIds: analysis.duplicateCueIds,
    reservedCueIds: analysis.reservedCueIds,
    weakCueIds: analysis.weakCueIds,
  }
}

async function cleanupPrunedHistoryArtifacts(entries) {
  for (const entry of entries) {
    if (entry.type !== 'delete') {
      continue
    }

    for (const backup of entry.payload?.deletedResourceBackups ?? []) {
      if (!backup?.trashPath) {
        continue
      }

      try {
        await unlink(backup.trashPath)
      } catch {
        // Ignore already-restored or already-deleted backups.
      }
    }
  }
}

async function runHistoryMaintenance(db) {
  const prunedEntries = pruneHistoryEntries(db)
  await cleanupPrunedHistoryArtifacts(prunedEntries)
  return prunedEntries
}

async function appendHistoryEntry(db, entry) {
  createHistoryEntry(db, entry)
  await runHistoryMaintenance(db)
}

async function withDatabase(context, callback) {
  const storagePaths = normalizeStorageContext(context)
  await ensureStorageDirectories(storagePaths)
  const db = openAppDatabase(storagePaths.databasePath)
  await runHistoryMaintenance(db)

  try {
    return await callback({ db, storagePaths })
  } finally {
    db.close()
  }
}

async function handleImportCommand(db, storagePaths, payload = {}, emitEvent = null) {
  if (payload.createStarterPack) {
    const result = await createStarterPack(db, storagePaths, {
      language: readSettings(db).language,
    })

    if (result.createdCueCount > 0) {
      await appendHistoryEntry(db, {
        id: randomUUID(),
        type: 'import',
        status: 'active',
        summary: `Created starter pack (${result.createdCueCount} cue(s))`,
        payload: {
          importedCueIds: result.createdCueIds,
          importedResourceIds: result.createdResourceIds,
        },
        createdAt: new Date().toISOString(),
      })
    }

    return {
      snapshot: readBoardSnapshot(db, storagePaths),
      bootstrap: readBootstrapSnapshot(db, storagePaths),
      history: readHistoryEntries(db),
      diagnostics: buildShortcutDiagnostics(db),
    }
  }

  const paths = Array.isArray(payload.paths) ? payload.paths.filter(Boolean) : []
  const result = await importAudioPaths(db, storagePaths, paths, {
    onProgress: (progress) => {
      emitEvent?.('workspace.import.progress', progress)
    },
  })
  const shortcutDiagnostics = buildShortcutDiagnostics(db)
  const suggestedHotkeys =
    result.importedCueIds.length > 1
      ? createShortcutRepairPlan(readShortcutEntries(db, { includeEmpty: true }), shortcutDiagnostics, {
          mode: 'assign',
          targetCueIds: result.importedCueIds,
          strategy: readSettings(db).hotkeySuggestionStrategy,
        })
      : []

  if (result.importedCueIds.length > 0) {
    await appendHistoryEntry(db, {
      id: randomUUID(),
      type: 'import',
      status: 'active',
      summary: `Imported ${result.importedCueCount} cue(s)`,
      payload: {
        importedCueIds: result.importedCueIds,
        importedResourceIds: result.importedResourceIds,
      },
      createdAt: new Date().toISOString(),
    })
  }

  return {
    ...result,
    suggestedHotkeys,
    ...shortcutDiagnostics,
  }
}

async function handleHistoryUndo(db, storagePaths, payload = {}) {
  const entryId = payload.entryId
  const entry = readHistoryEntryById(db, entryId)

  if (!entry || entry.status !== 'active') {
    throw new Error('History entry is not undoable')
  }

  if (entry.type === 'import') {
    await undoImportAction(db, storagePaths, entry.payload)
  } else if (entry.type === 'delete') {
    await undoDeleteCue(db, storagePaths, entry.payload)
  } else if (entry.type === 'tag') {
    undoTagOperation(db, entry.payload)
  } else {
    throw new Error(`Unsupported history type: ${entry.type}`)
  }

  markHistoryEntryUndone(db, entryId)
  await runHistoryMaintenance(db)

  return {
    history: readHistoryEntries(db),
    snapshot: readBoardSnapshot(db, storagePaths),
    bootstrap: readBootstrapSnapshot(db, storagePaths),
    diagnostics: buildShortcutDiagnostics(db),
  }
}

export async function handleWorkspaceBridgeCommand({ command, payload, context, emitEvent = null }) {
  return withDatabase(context, async ({ db, storagePaths }) => {
    if (command === 'workspace.bootstrap.read') {
      return readBootstrapSnapshot(db, storagePaths)
    }

    if (command === 'workspace.library.read') {
      return readBoardSnapshot(db, storagePaths)
    }

    if (command === 'workspace.library.import') {
      return handleImportCommand(db, storagePaths, payload, emitEvent)
    }

    if (command === 'workspace.settings.update') {
      const nextSettings = writeSettings(db, payload?.patch ?? {})
      return {
        settings: nextSettings ?? readSettings(db),
        ...buildShortcutDiagnostics(db),
      }
    }

    if (command === 'workspace.cue.update') {
      updateCueCard(db, payload?.cueId, payload?.patch ?? {})
      return buildShortcutDiagnostics(db)
    }

    if (command === 'workspace.cue.tags.replace') {
      replaceCueCardTags(db, payload?.cueId, payload?.tagNames ?? [])
      return readBoardSnapshot(db, storagePaths)
    }

    if (command === 'workspace.cue.tags.batch') {
      bulkUpdateCueTags(db, payload?.cueIds ?? [], payload?.tagNames ?? [], payload?.mode)
      return readBoardSnapshot(db, storagePaths)
    }

    if (command === 'workspace.cue.reorder') {
      reorderCueCards(db, payload?.orderedCueIds ?? [])
      return readBoardSnapshot(db, storagePaths)
    }

    if (command === 'workspace.cue.delete') {
      const cleanup = await deleteCueCard(db, storagePaths, payload?.cueId)
      const shortcutDiagnostics = buildShortcutDiagnostics(db)

      if (cleanup.snapshot) {
        await appendHistoryEntry(db, {
          id: randomUUID(),
          type: 'delete',
          status: 'active',
          summary: `Deleted cue "${cleanup.snapshot.cue.name}"`,
          payload: cleanup,
          createdAt: new Date().toISOString(),
        })
      }

      return {
        cleanup: cleanup.cleanup,
        snapshot: readBoardSnapshot(db, storagePaths),
        ...shortcutDiagnostics,
      }
    }

    if (command === 'workspace.library.cleanup') {
      const cleanup = await cleanupUnusedLibraryEntries(db, storagePaths)
      return {
        cleanup,
        snapshot: readBoardSnapshot(db, storagePaths),
      }
    }

    if (command === 'workspace.tag.color.update') {
      updateTagColor(db, payload?.tagId, payload?.color ?? null)
      return readBoardSnapshot(db, storagePaths)
    }

    if (command === 'workspace.tag.color.batch') {
      batchUpdateTagColor(db, payload?.tagIds ?? [], payload?.color ?? null)
      return readBoardSnapshot(db, storagePaths)
    }

    if (command === 'workspace.tag.rename') {
      const result = renameTag(db, payload?.tagId, payload?.nextName)

      if (result?.history) {
        const fromName = result.history.sourceTagBefore?.name ?? 'Unknown'
        const targetName = String(payload?.nextName ?? '').trim()
        const summary =
          result.action === 'merge'
            ? `Merged tag "${fromName}" into "${targetName}"`
            : `Renamed tag "${fromName}" to "${targetName}"`

        await appendHistoryEntry(db, {
          id: randomUUID(),
          type: 'tag',
          status: 'active',
          summary,
          payload: result.history,
          createdAt: new Date().toISOString(),
        })
      }

      return readBoardSnapshot(db, storagePaths)
    }

    if (command === 'workspace.tag.delete') {
      const result = deleteTag(db, payload?.tagId)
      await appendHistoryEntry(db, {
        id: randomUUID(),
        type: 'tag',
        status: 'active',
        summary: `Deleted tag "${result.history.sourceTagBefore.name}"`,
        payload: result.history,
        createdAt: new Date().toISOString(),
      })

      return readBoardSnapshot(db, storagePaths)
    }

    if (command === 'workspace.tag.merge') {
      const result = batchMergeTags(db, payload?.tagIds ?? [], payload?.targetName)

      if (result.operations.length > 0) {
        await appendHistoryEntry(db, {
          id: randomUUID(),
          type: 'tag',
          status: 'active',
          summary: `Merged ${result.selectedCount} tag(s) into "${result.targetName}"`,
          payload: {
            action: 'batch-merge',
            targetName: result.targetName,
            operations: result.operations,
          },
          createdAt: new Date().toISOString(),
        })
      }

      return readBoardSnapshot(db, storagePaths)
    }

    if (command === 'workspace.tag.delete.batch') {
      const result = batchDeleteTags(db, payload?.tagIds ?? [])

      if (result.operations.length > 0) {
        await appendHistoryEntry(db, {
          id: randomUUID(),
          type: 'tag',
          status: 'active',
          summary: `Deleted ${result.deletedCount} tag(s)`,
          payload: {
            action: 'batch-delete',
            operations: result.operations,
          },
          createdAt: new Date().toISOString(),
        })
      }

      return readBoardSnapshot(db, storagePaths)
    }

    if (command === 'workspace.tag.rename.rule') {
      const result = batchRenameTagsByRule(db, payload?.tagIds ?? [], payload?.rule ?? {})

      if (result.operations.length > 0) {
        await appendHistoryEntry(db, {
          id: randomUUID(),
          type: 'tag',
          status: 'active',
          summary: `Renamed ${result.renamedCount} tag(s) with a rule`,
          payload: {
            action: 'batch-rename-rule',
            rule: payload?.rule ?? {},
            operations: result.operations,
          },
          createdAt: new Date().toISOString(),
        })
      }

      return {
        renamedCount: result.renamedCount,
        preview: result.preview,
        snapshot: readBoardSnapshot(db, storagePaths),
      }
    }

    if (command === 'workspace.history.list') {
      return readHistoryEntries(db)
    }

    if (command === 'workspace.history.undo') {
      return handleHistoryUndo(db, storagePaths, payload)
    }

    if (command === 'workspace.diagnostics.read') {
      return buildShortcutDiagnostics(db)
    }

    if (command === 'workspace.shortcuts.repair') {
      const currentDiagnostics = buildShortcutDiagnostics(db)
      const assignments = createShortcutRepairPlan(
        readShortcutEntries(db, { includeEmpty: true }),
        currentDiagnostics,
        {
          mode: payload?.mode,
          scopes: payload?.scopes,
          strategy: readSettings(db).hotkeySuggestionStrategy,
        },
      )
      const updatedCount = applyShortcutRepair(db, assignments)
      const diagnostics = buildShortcutDiagnostics(db)

      return {
        updatedCount,
        assignments,
        snapshot: readBoardSnapshot(db, storagePaths),
        diagnostics,
      }
    }

    if (command === 'workspace.shortcuts.assign') {
      const assignments = Array.isArray(payload?.assignments) ? payload.assignments : []
      const updatedCount = applyShortcutRepair(db, assignments)
      const diagnostics = buildShortcutDiagnostics(db)

      return {
        updatedCount,
        assignments,
        snapshot: readBoardSnapshot(db, storagePaths),
        diagnostics,
      }
    }

    throw new Error(`Unsupported workspace bridge command: ${command}`)
  })
}
