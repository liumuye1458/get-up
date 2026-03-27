import { app, BrowserWindow, dialog, globalShortcut, ipcMain } from 'electron'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { access, appendFile, mkdtemp, rm, unlink } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { tmpdir } from 'node:os'
import {
  BACKUP_MANIFEST_VERSION,
  CURRENT_SCHEMA_VERSION,
  DEFAULT_SETTINGS,
  applyShortcutRepair,
  batchDeleteTags,
  batchMergeTags,
  batchRenameTagsByRule,
  batchUpdateTagColor,
  buildBackupDiffSummary,
  bulkUpdateCueTags,
  cleanupUnusedLibraryEntries,
  collectShortcutDiagnostics,
  createBackupManifest,
  createCueTransferSnapshot,
  createHistoryEntry,
  createShortcutRepairPlan,
  createStarterPack,
  deleteCueCard,
  deleteTag,
  detectPortableDataRoot,
  ensureStorageDirectories,
  exportBackupBundle,
  extractBackupBundleToPaths,
  getBackupFileExtension,
  getInstalledDataRoot,
  getStoragePaths,
  importAudioPaths,
  inspectBackupManifest,
  inspectBackupPackage,
  insertCueTransferSnapshot,
  markHistoryEntryUndone,
  migrateLegacyManagedData,
  normalizeCueSortOrder,
  openAppDatabase,
  pruneHistoryEntries,
  readBoardSnapshot,
  readBootstrapSnapshot,
  readHistoryEntries,
  readHistoryEntryById,
  readLibraryCatalogSnapshot,
  readSettings,
  readShortcutEntries,
  renameTag,
  reorderCueCards,
  replaceCueCardTags,
  replaceManagedPayload,
  restoreBackupBundle,
  undoDeleteCue,
  undoImportAction,
  undoTagOperation,
  updateCueCard,
  updateTagColor,
  writeSettings,
} from '../app-services/index.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = join(__dirname, '..')
const devServerUrl = process.env.VITE_DEV_SERVER_URL

if (!detectPortableDataRoot({ isPackaged: app.isPackaged })) {
  app.setPath('userData', getInstalledDataRoot(app))
}

const startupTracePath = join(app.getPath('userData'), 'startup-trace.log')

// Win11 + some GPU driver combinations can leave Electron running without ever
// presenting a visible window. Prefer reliability for RC over GPU acceleration.
app.disableHardwareAcceleration()

/** @type {BrowserWindow | null} */
let mainWindow = null
/** @type {BrowserWindow | null} */
let floatingControlWindow = null
let db = null
let storagePaths = null

async function writeStartupTrace(message) {
  try {
    await appendFile(startupTracePath, `[${new Date().toISOString()}] ${message}\n`, 'utf-8')
  } catch {
    // Ignore logging failures during startup diagnostics.
  }
}

function registerGlobalShortcuts(sounds, settings = DEFAULT_SETTINGS) {
  globalShortcut.unregisterAll()

  if (!settings.globalShortcutsEnabled) {
    return { failed: [], duplicate: [] }
  }

  const failed = []
  const duplicate = []
  const seen = new Set()

  for (const sound of sounds) {
    if (!sound.hotkey) continue
    const normalizedHotkey = sound.hotkey.trim().toLowerCase()

    if (seen.has(normalizedHotkey)) {
      duplicate.push({ id: sound.id, hotkey: sound.hotkey })
      continue
    }
    seen.add(normalizedHotkey)

    const registered = globalShortcut.register(sound.hotkey, () => {
      mainWindow?.webContents.send('shortcut:trigger', sound.id)
    })

    if (!registered) {
      failed.push({ id: sound.id, hotkey: sound.hotkey })
    }
  }

  return { failed, duplicate }
}

function registerGlobalShortcutsFromDatabase() {
  if (!db) {
    return { failed: [], duplicate: [] }
  }

  return registerGlobalShortcuts(readShortcutEntries(db), readSettings(db))
}

function getShortcutDiagnosticsFromDatabase() {
  const sounds = readShortcutEntries(db)
  const registration = registerGlobalShortcuts(sounds, readSettings(db))
  const analysis = collectShortcutDiagnostics(sounds)

  return {
    failedCueIds: registration.failed.map((entry) => entry.id),
    duplicateCueIds: analysis.duplicateCueIds,
    reservedCueIds: analysis.reservedCueIds,
    weakCueIds: analysis.weakCueIds,
  }
}

function createWindow() {
  void writeStartupTrace('createWindow:start')
  mainWindow = new BrowserWindow({
    width: 1480,
    height: 940,
    minWidth: 1180,
    minHeight: 760,
    backgroundColor: '#f4efe6',
    title: 'Code X Soundboard',
    show: false,
    webPreferences: {
      preload: join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  mainWindow.once('ready-to-show', () => {
    void writeStartupTrace('createWindow:ready-to-show')
    mainWindow?.show()
  })

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    void writeStartupTrace(
      `createWindow:did-fail-load code=${errorCode} reason=${errorDescription} url=${validatedURL}`,
    )
    dialog.showErrorBox(
      'Code X Soundboard Startup Error',
      `Failed to load application UI.\nCode: ${errorCode}\nReason: ${errorDescription}\nURL: ${validatedURL}`,
    )
  })

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    void writeStartupTrace(`createWindow:render-process-gone reason=${details.reason}`)
    dialog.showErrorBox(
      'Code X Soundboard Renderer Error',
      `The renderer process exited unexpectedly.\nReason: ${details.reason}`,
    )
  })

  if (devServerUrl) {
    void writeStartupTrace(`createWindow:loadURL ${devServerUrl}`)
    mainWindow.loadURL(devServerUrl)
  } else {
    const indexPath = join(projectRoot, 'dist', 'index.html')
    void writeStartupTrace(`createWindow:loadFile ${indexPath}`)
    mainWindow.loadFile(indexPath)
  }
}

function createFloatingControlWindow() {
  if (floatingControlWindow && !floatingControlWindow.isDestroyed()) {
    floatingControlWindow.show()
    floatingControlWindow.focus()
    return floatingControlWindow
  }

  floatingControlWindow = new BrowserWindow({
    width: 340,
    height: 220,
    minWidth: 300,
    minHeight: 180,
    maxWidth: 420,
    maxHeight: 320,
    backgroundColor: '#f4efe6',
    title: 'Code X Soundboard Control',
    show: false,
    alwaysOnTop: true,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  floatingControlWindow.once('ready-to-show', () => {
    floatingControlWindow?.show()
  })

  floatingControlWindow.on('closed', () => {
    floatingControlWindow = null
  })

  if (devServerUrl) {
    floatingControlWindow.loadURL(`${devServerUrl}#floating-control`)
  } else {
    const indexPath = join(projectRoot, 'dist', 'index.html')
    floatingControlWindow.loadFile(indexPath, { hash: 'floating-control' })
  }

  return floatingControlWindow
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
        // The file may already have been restored or deleted.
      }
    }
  }
}

async function runHistoryMaintenance() {
  if (!db) {
    return []
  }

  const prunedEntries = pruneHistoryEntries(db)
  await cleanupPrunedHistoryArtifacts(prunedEntries)
  return prunedEntries
}

async function appendHistoryEntry(entry) {
  createHistoryEntry(db, entry)
  await runHistoryMaintenance()
}

function emitImportProgress(target, payload) {
  target.send('library:importProgress', payload)
}

async function reopenManagedDatabase() {
  if (!storagePaths) {
    throw new Error('Storage paths are not ready')
  }

  await ensureStorageDirectories(storagePaths)
  db = openAppDatabase(storagePaths.databasePath)
  await runHistoryMaintenance()
  registerGlobalShortcutsFromDatabase()
}

function createTemporaryStoragePaths(rootPath) {
  return {
    mode: storagePaths?.mode ?? 'installed',
    dataRoot: rootPath,
    databasePath: join(rootPath, 'soundboard.db'),
    libraryDir: join(rootPath, 'library'),
    waveformsDir: join(rootPath, 'waveforms'),
    trashDir: join(rootPath, 'trash'),
  }
}

function normalizeBackupImportSelection(selection) {
  const normalizeBucket = (bucket = {}) => ({
    incomingOnly: Array.from(new Set((bucket.incomingOnly ?? []).filter(Boolean))),
    currentOnly: Array.from(new Set((bucket.currentOnly ?? []).filter(Boolean))),
    shared: Array.from(new Set((bucket.shared ?? []).filter(Boolean))),
  })

  return {
    cues: normalizeBucket(selection?.cues),
    tags: normalizeBucket(selection?.tags),
    resources: normalizeBucket(selection?.resources),
  }
}

function cueMatchesNameSet(cue, section, names) {
  if (section === 'cues') {
    return names.has(cue.name)
  }

  if (section === 'tags') {
    return cue.tags.some((tag) => names.has(tag.name))
  }

  return names.has(cue.resource.originalFilename)
}

async function applyBackupImportSelection(currentDb, currentPaths, backupDb, backupPaths, selection) {
  const normalizedSelection = normalizeBackupImportSelection(selection)
  const currentSnapshot = readBoardSnapshot(currentDb, currentPaths)
  const backupSnapshot = readBoardSnapshot(backupDb, backupPaths)

  const removeBackupCueNames = new Set(normalizedSelection.cues.incomingOnly)
  const insertCurrentCueNames = new Set(normalizedSelection.cues.currentOnly)
  const replaceWithCurrentCueNames = new Set(normalizedSelection.cues.shared)

  for (const section of ['tags', 'resources']) {
    const incomingSet = new Set(normalizedSelection[section].incomingOnly)
    const currentOnlySet = new Set(normalizedSelection[section].currentOnly)
    const sharedSet = new Set(normalizedSelection[section].shared)

    for (const cue of backupSnapshot.cueCards) {
      if (cueMatchesNameSet(cue, section, incomingSet)) {
        removeBackupCueNames.add(cue.name)
      }
      if (cueMatchesNameSet(cue, section, sharedSet)) {
        replaceWithCurrentCueNames.add(cue.name)
      }
    }

    for (const cue of currentSnapshot.cueCards) {
      if (cueMatchesNameSet(cue, section, currentOnlySet)) {
        insertCurrentCueNames.add(cue.name)
      }
      if (cueMatchesNameSet(cue, section, sharedSet)) {
        replaceWithCurrentCueNames.add(cue.name)
      }
    }
  }

  const namesToDeleteFromBackup = new Set([...removeBackupCueNames, ...replaceWithCurrentCueNames])

  for (const cue of backupSnapshot.cueCards) {
    if (!namesToDeleteFromBackup.has(cue.name)) {
      continue
    }

    backupDb.prepare('DELETE FROM cue_cards WHERE id = ?').run(cue.id)
  }

  await cleanupUnusedLibraryEntries(backupDb, backupPaths)

  const currentCueSnapshots = currentSnapshot.cueCards
    .filter((cue) => insertCurrentCueNames.has(cue.name) || replaceWithCurrentCueNames.has(cue.name))
    .map((cue) => createCueTransferSnapshot(currentDb, currentPaths, cue.id))
    .filter(Boolean)

  for (const cueSnapshot of currentCueSnapshots) {
    await insertCueTransferSnapshot(backupDb, backupPaths, cueSnapshot, {
      overwriteByName: true,
      preferTagMetadata: true,
    })
  }

  normalizeCueSortOrder(backupDb)
  await cleanupUnusedLibraryEntries(backupDb, backupPaths)
}

app
  .whenReady()
  .then(async () => {
    await writeStartupTrace('app:whenReady')
    storagePaths = getStoragePaths(app)
    await writeStartupTrace(`app:storage mode=${storagePaths.mode} root=${storagePaths.dataRoot}`)
    await migrateLegacyManagedData(app, storagePaths)
    await writeStartupTrace('app:legacy-managed-data-migrated')
    await ensureStorageDirectories(storagePaths)
    await writeStartupTrace('app:storage-directories-ready')
    db = openAppDatabase(storagePaths.databasePath)
    await writeStartupTrace(`app:database-open ${storagePaths.databasePath}`)
    await runHistoryMaintenance()
    await writeStartupTrace('app:history-maintenance-ready')

    createWindow()
    registerGlobalShortcutsFromDatabase()
    await writeStartupTrace('app:window-created')

    app.on('activate', () => {
      void writeStartupTrace(`app:activate windows=${BrowserWindow.getAllWindows().length}`)
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
      } else {
        BrowserWindow.getAllWindows()[0]?.show()
      }
    })
  })
  .catch((error) => {
    void writeStartupTrace(
      `app:startup-error ${error instanceof Error ? error.stack ?? error.message : String(error)}`,
    )
    dialog.showErrorBox(
      'Code X Soundboard Startup Error',
      error instanceof Error ? error.stack ?? error.message : String(error),
    )
    app.exit(1)
  })

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

ipcMain.handle('app:bootstrap', async () => {
  if (!db || !storagePaths) {
    throw new Error('Database is not ready')
  }

  return readBootstrapSnapshot(db, storagePaths)
})

ipcMain.handle('library:snapshot', async () => {
  if (!db || !storagePaths) {
    throw new Error('Database is not ready')
  }

  return readBoardSnapshot(db, storagePaths)
})

ipcMain.handle('window:openFloatingControl', async () => {
  createFloatingControlWindow()
})

ipcMain.handle('window:focusMain', async () => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow()
    return
  }

  mainWindow.show()
  mainWindow.focus()
})

ipcMain.handle('library:import', async (event, paths) => {
  if (!db || !storagePaths) {
    throw new Error('Database is not ready')
  }

  const result = await importAudioPaths(db, storagePaths, paths, {
    onProgress: (progress) => emitImportProgress(event.sender, progress),
  })
  const shortcutResult = getShortcutDiagnosticsFromDatabase()
  const suggestedHotkeys =
    result.importedCueIds.length > 1
      ? createShortcutRepairPlan(readShortcutEntries(db, { includeEmpty: true }), shortcutResult, {
          mode: 'assign',
          targetCueIds: result.importedCueIds,
          strategy: readSettings(db).hotkeySuggestionStrategy,
        })
      : []

  if (result.importedCueIds.length > 0) {
    await appendHistoryEntry({
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
    ...shortcutResult,
  }
})

ipcMain.handle('library:createStarterPack', async () => {
  if (!db || !storagePaths) {
    throw new Error('Database is not ready')
  }

  const result = await createStarterPack(db, storagePaths, {
    language: readSettings(db).language,
  })

  if (result.createdCueCount > 0) {
    await appendHistoryEntry({
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
    diagnostics: getShortcutDiagnosticsFromDatabase(),
  }
})

ipcMain.handle('settings:update', async (_, patch) => {
  if (!db) {
    throw new Error('Database is not ready')
  }

  const settings = writeSettings(db, patch)
  const shortcutResult = getShortcutDiagnosticsFromDatabase()

  return {
    settings,
    ...shortcutResult,
  }
})

ipcMain.handle('cue:update', async (_, cueId, patch) => {
  if (!db) {
    throw new Error('Database is not ready')
  }

  updateCueCard(db, cueId, patch)
  const shortcutResult = getShortcutDiagnosticsFromDatabase()

  return shortcutResult
})

ipcMain.handle('cue:setTags', async (_, cueId, tagNames) => {
  if (!db) {
    throw new Error('Database is not ready')
  }

  replaceCueCardTags(db, cueId, tagNames)
  return readBoardSnapshot(db, storagePaths)
})

ipcMain.handle('cue:batchTags', async (_, cueIds, tagNames, mode) => {
  if (!db || !storagePaths) {
    throw new Error('Database is not ready')
  }

  bulkUpdateCueTags(db, cueIds, tagNames, mode)
  return readBoardSnapshot(db, storagePaths)
})

ipcMain.handle('cue:reorder', async (_, orderedCueIds) => {
  if (!db || !storagePaths) {
    throw new Error('Database is not ready')
  }

  reorderCueCards(db, orderedCueIds)
  return readBoardSnapshot(db, storagePaths)
})

ipcMain.handle('cue:delete', async (_, cueId) => {
  if (!db || !storagePaths) {
    throw new Error('Database is not ready')
  }

  const cleanup = await deleteCueCard(db, storagePaths, cueId)
  const shortcutResult = getShortcutDiagnosticsFromDatabase()

  if (cleanup.snapshot) {
    await appendHistoryEntry({
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
    ...shortcutResult,
  }
})

ipcMain.handle('tag:updateColor', async (_, tagId, color) => {
  if (!db || !storagePaths) {
    throw new Error('Database is not ready')
  }

  updateTagColor(db, tagId, color)
  return readBoardSnapshot(db, storagePaths)
})

ipcMain.handle('tag:batchColor', async (_, tagIds, color) => {
  if (!db || !storagePaths) {
    throw new Error('Database is not ready')
  }

  batchUpdateTagColor(db, tagIds, color)
  return readBoardSnapshot(db, storagePaths)
})

ipcMain.handle('tag:rename', async (_, tagId, nextName) => {
  if (!db || !storagePaths) {
    throw new Error('Database is not ready')
  }

  const result = renameTag(db, tagId, nextName)

  if (result?.history) {
    const fromName = result.history.sourceTagBefore?.name ?? 'Unknown'
    const summary =
      result.action === 'merge'
        ? `Merged tag "${fromName}" into "${nextName.trim()}"`
        : `Renamed tag "${fromName}" to "${nextName.trim()}"`

    await appendHistoryEntry({
      id: randomUUID(),
      type: 'tag',
      status: 'active',
      summary,
      payload: result.history,
      createdAt: new Date().toISOString(),
    })
  }

  return readBoardSnapshot(db, storagePaths)
})

ipcMain.handle('tag:delete', async (_, tagId) => {
  if (!db || !storagePaths) {
    throw new Error('Database is not ready')
  }

  const result = deleteTag(db, tagId)

  await appendHistoryEntry({
    id: randomUUID(),
    type: 'tag',
    status: 'active',
    summary: `Deleted tag "${result.history.sourceTagBefore.name}"`,
    payload: result.history,
    createdAt: new Date().toISOString(),
  })

  return readBoardSnapshot(db, storagePaths)
})

ipcMain.handle('tag:batchDelete', async (_, tagIds) => {
  if (!db || !storagePaths) {
    throw new Error('Database is not ready')
  }

  const result = batchDeleteTags(db, tagIds)

  if (result.operations.length > 0) {
    await appendHistoryEntry({
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
})

ipcMain.handle('tag:batchMerge', async (_, tagIds, targetName) => {
  if (!db || !storagePaths) {
    throw new Error('Database is not ready')
  }

  const result = batchMergeTags(db, tagIds, targetName)

  if (result.operations.length > 0) {
    await appendHistoryEntry({
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
})

ipcMain.handle('tag:batchRenameRule', async (_, tagIds, rule) => {
  if (!db || !storagePaths) {
    throw new Error('Database is not ready')
  }

  const result = batchRenameTagsByRule(db, tagIds, rule)

  if (result.operations.length > 0) {
    await appendHistoryEntry({
      id: randomUUID(),
      type: 'tag',
      status: 'active',
      summary: `Renamed ${result.renamedCount} tag(s) with a rule`,
      payload: {
        action: 'batch-rename-rule',
        rule,
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
})

ipcMain.handle('library:cleanupUnused', async () => {
  if (!db || !storagePaths) {
    throw new Error('Database is not ready')
  }

  const cleanup = await cleanupUnusedLibraryEntries(db, storagePaths)

  return {
    cleanup,
    snapshot: readBoardSnapshot(db, storagePaths),
  }
})

ipcMain.handle('history:list', async () => {
  if (!db) {
    throw new Error('Database is not ready')
  }

  return readHistoryEntries(db)
})

ipcMain.handle('history:undo', async (_, entryId) => {
  if (!db || !storagePaths) {
    throw new Error('Database is not ready')
  }

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
  await runHistoryMaintenance()

  return {
    history: readHistoryEntries(db),
    snapshot: readBoardSnapshot(db, storagePaths),
    bootstrap: readBootstrapSnapshot(db, storagePaths),
    diagnostics: getShortcutDiagnosticsFromDatabase(),
  }
})

ipcMain.handle('shortcut:diagnostics', async () => {
  if (!db) {
    throw new Error('Database is not ready')
  }

  return getShortcutDiagnosticsFromDatabase()
})

ipcMain.handle('shortcut:bulkRepair', async (_, options) => {
  if (!db || !storagePaths) {
    throw new Error('Database is not ready')
  }

  const currentDiagnostics = getShortcutDiagnosticsFromDatabase()
  const assignments = createShortcutRepairPlan(readShortcutEntries(db, { includeEmpty: true }), currentDiagnostics, {
    ...options,
    strategy: readSettings(db).hotkeySuggestionStrategy,
  })
  const updatedCount = applyShortcutRepair(db, assignments)
  const diagnostics = getShortcutDiagnosticsFromDatabase()

  return {
    updatedCount,
    assignments,
    snapshot: readBoardSnapshot(db, storagePaths),
    diagnostics,
  }
})

ipcMain.handle('shortcut:applyAssignments', async (_, assignments) => {
  if (!db || !storagePaths) {
    throw new Error('Database is not ready')
  }

  const updatedCount = applyShortcutRepair(db, assignments)
  const diagnostics = getShortcutDiagnosticsFromDatabase()

  return {
    updatedCount,
    assignments,
    snapshot: readBoardSnapshot(db, storagePaths),
    diagnostics,
  }
})

ipcMain.handle('library:exportBackup', async (_, password) => {
  if (!db || !storagePaths) {
    throw new Error('Database is not ready')
  }

  const extension = getBackupFileExtension().replace('.', '')
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Export backup package',
    defaultPath: `code-x-soundboard-backup${getBackupFileExtension()}`,
    filters: [
      {
        name: 'Code X Soundboard Backup',
        extensions: [extension],
      },
    ],
  })

  if (result.canceled || !result.filePath) {
    return {
      cancelled: true,
      targetPath: null,
      manifest: null,
    }
  }

  const manifest = createBackupManifest(readBootstrapSnapshot(db, storagePaths), {
    appVersion: app.getVersion(),
    catalog: readLibraryCatalogSnapshot(db),
  })
  const exportResult = await exportBackupBundle(db, storagePaths, result.filePath, manifest, {
    password,
  })

  return {
    cancelled: false,
    ...exportResult,
  }
})

ipcMain.handle('library:previewBackupImport', async () => {
  if (!db || !storagePaths) {
    throw new Error('Database is not ready')
  }

  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Choose backup package',
    properties: ['openFile'],
    filters: [
      {
        name: 'Code X Soundboard Backup',
        extensions: [getBackupFileExtension().replace('.', '')],
      },
    ],
  })

  if (result.canceled || result.filePaths.length === 0) {
    return {
      cancelled: true,
      sourcePath: null,
      manifest: null,
      compatibility: null,
      integrity: null,
      diffSummary: null,
    }
  }

  const sourcePath = result.filePaths[0]
  const inspection = await inspectBackupPackage(sourcePath)
  const manifest = inspection.manifest

  if (!manifest) {
    return {
      cancelled: false,
      sourcePath,
      manifest: null,
      compatibility: null,
      integrity: inspection.integrity,
      diffSummary: null,
    }
  }

  const compatibility = inspectBackupManifest(manifest, {
    supportedBackupVersion: BACKUP_MANIFEST_VERSION,
    currentSchemaVersion: CURRENT_SCHEMA_VERSION,
    currentStorageMode: storagePaths.mode,
  })
  const diffSummary = buildBackupDiffSummary(manifest, readLibraryCatalogSnapshot(db))

  return {
    cancelled: false,
    sourcePath,
    manifest,
    compatibility,
    integrity: inspection.integrity,
    diffSummary,
  }
})

ipcMain.handle('library:exportBackupDiffReport', async (_, payload) => {
  const format = payload?.format ?? 'txt'
  const content = payload?.content ?? ''
  const extension = format === 'json' ? 'json' : format === 'csv' ? 'csv' : 'txt'
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Export backup diff report',
    defaultPath: `code-x-soundboard-backup-diff.${extension}`,
    filters: [
      {
        name: format === 'json' ? 'JSON' : format === 'csv' ? 'CSV' : 'Text',
        extensions: [extension],
      },
    ],
  })

  if (result.canceled || !result.filePath) {
    return {
      cancelled: true,
      targetPath: null,
    }
  }

  await writeFile(result.filePath, content, 'utf-8')

  return {
    cancelled: false,
    targetPath: result.filePath,
  }
})

ipcMain.handle('library:importBackup', async (_, sourcePath, password, selection) => {
  if (!db || !storagePaths) {
    throw new Error('Database is not ready')
  }

  if (!sourcePath) {
    throw new Error('Backup source path is required')
  }

  const inspection = await inspectBackupPackage(sourcePath, password)
  const manifest = inspection.manifest

  if (!inspection.integrity.valid) {
    throw new Error('Backup package integrity check failed')
  }

  if (!manifest) {
    throw new Error('Backup package is unreadable')
  }

  const compatibility = inspectBackupManifest(manifest, {
    supportedBackupVersion: BACKUP_MANIFEST_VERSION,
    currentSchemaVersion: CURRENT_SCHEMA_VERSION,
    currentStorageMode: storagePaths.mode,
  })
  const diffSummary = buildBackupDiffSummary(manifest, readLibraryCatalogSnapshot(db))

  if (compatibility.blocked) {
    throw new Error('Backup is not compatible with the current application version')
  }

  const normalizedSelection = normalizeBackupImportSelection(selection)
  const hasSelectiveRestore = ['cues', 'tags', 'resources'].some((section) =>
    ['incomingOnly', 'currentOnly', 'shared'].some(
      (bucket) => normalizedSelection[section][bucket].length > 0,
    ),
  )

  if (hasSelectiveRestore) {
    const tempRoot = await mkdtemp(join(tmpdir(), 'local-sfx-board-selective-'))
    const tempPaths = createTemporaryStoragePaths(tempRoot)
    let tempDb = null

    try {
      await ensureStorageDirectories(tempPaths)
      await extractBackupBundleToPaths(tempPaths, sourcePath, password)
      tempDb = openAppDatabase(tempPaths.databasePath)
      await applyBackupImportSelection(db, storagePaths, tempDb, tempPaths, normalizedSelection)
      tempDb.close()
      tempDb = null

      globalShortcut.unregisterAll()
      db.exec('PRAGMA wal_checkpoint(FULL)')
      db.close()
      db = null

      try {
        await replaceManagedPayload(storagePaths, tempPaths)
      } finally {
        await reopenManagedDatabase()
      }
    } finally {
      if (tempDb) {
        tempDb.close()
      }
      await rm(tempRoot, { recursive: true, force: true })
    }
  } else {
    globalShortcut.unregisterAll()
    db.exec('PRAGMA wal_checkpoint(FULL)')
    db.close()
    db = null

    try {
      await restoreBackupBundle(storagePaths, sourcePath, password)
    } finally {
      await reopenManagedDatabase()
    }
  }

  return {
    cancelled: false,
    sourcePath,
    manifest,
    compatibility,
    integrity: inspection.integrity,
    diffSummary,
    snapshot: readBoardSnapshot(db, storagePaths),
    bootstrap: readBootstrapSnapshot(db, storagePaths),
    history: readHistoryEntries(db),
    diagnostics: getShortcutDiagnosticsFromDatabase(),
  }
})

ipcMain.handle('files:pickAudio', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Import audio files',
    properties: ['openFile', 'openDirectory', 'multiSelections'],
    filters: [
      {
        name: 'Audio',
        extensions: ['mp3', 'wav', 'ogg', 'aac', 'flac', 'm4a', 'webm'],
      },
    ],
  })

  return result.canceled ? [] : result.filePaths
})

ipcMain.handle('files:checkExist', async (_, paths) => {
  const missing = []

  for (const filePath of paths) {
    try {
      await access(filePath)
    } catch {
      missing.push(filePath)
    }
  }

  return { missing }
})
