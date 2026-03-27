import test from 'node:test'
import assert from 'node:assert/strict'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { access, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'

import {
  BACKUP_MANIFEST_VERSION,
  applyShortcutRepair,
  batchDeleteTags,
  batchMergeTags,
  batchRenameTagsByRule,
  batchUpdateTagColor,
  buildBackupDiffSummary,
  collectShortcutDiagnostics,
  createBackupManifest,
  createShortcutRepairPlan,
  createStarterPack,
  deleteCueCard,
  deleteTag,
  detectPortableDataRoot,
  ensureStorageDirectories,
  exportBackupBundle,
  importAudioPaths,
  inspectBackupManifest,
  inspectBackupPackage,
  openAppDatabase,
  readBackupManifest,
  readBoardSnapshot,
  readBootstrapSnapshot,
  readLibraryCatalogSnapshot,
  readSettings,
  renameTag,
  replaceCueCardTags,
  restoreBackupBundle,
  undoDeleteCue,
  undoTagOperation,
  updateCueCard,
  updateTagColor,
  writeSettings,
} from '../app-services/index.js'

function writeSilentWavBuffer(durationMs = 200) {
  const sampleRate = 8000
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

  return buffer
}

async function createHarness() {
  const root = await mkdtemp(join(tmpdir(), 'local-sfx-board-'))
  const storagePaths = {
    mode: 'installed',
    dataRoot: root,
    databasePath: join(root, 'soundboard.db'),
    libraryDir: join(root, 'library'),
    waveformsDir: join(root, 'waveforms'),
    trashDir: join(root, 'trash'),
  }

  await ensureStorageDirectories(storagePaths)

  return {
    root,
    storagePaths,
    db: openAppDatabase(storagePaths.databasePath),
  }
}

test('settings persist after database reopen', async (t) => {
  const harness = await createHarness()

  t.after(async () => {
    harness.db.close()
    await rm(harness.root, { recursive: true, force: true })
  })

  const expectedSettings = {
    language: 'en-US',
    globalVolume: 0.42,
    allowOverlap: true,
    stopOthersOnTrigger: false,
    selectedOutputDeviceId: 'virtual-output-1',
    warnOnMissingFiles: false,
    globalShortcutsEnabled: false,
    tagManagerSortMode: 'recent',
    backupImportSelectionTemplates: [
      {
        id: 'template-keep-live',
        name: 'Keep live-only tags',
        selection: {
          cues: { incomingOnly: ['Backup cue'], currentOnly: [], shared: [] },
          tags: { incomingOnly: [], currentOnly: ['live'], shared: ['intro'] },
          resources: { incomingOnly: [], currentOnly: [], shared: [] },
        },
        createdAt: '2026-03-26T00:00:00.000Z',
        updatedAt: '2026-03-26T00:00:00.000Z',
      },
    ],
    hotkeySuggestionStrategy: {
      primaryModifier: 'Alt+Shift',
      includeAlternateModifiers: false,
      includeDigits: true,
      includeFunctionKeys: false,
      includeLetters: true,
      groupingMode: 'none',
    },
  }

  writeSettings(harness.db, expectedSettings)
  assert.deepEqual(readSettings(harness.db), expectedSettings)

  harness.db.close()
  harness.db = openAppDatabase(harness.storagePaths.databasePath)

  assert.deepEqual(readSettings(harness.db), expectedSettings)

  const bootstrap = readBootstrapSnapshot(harness.db, harness.storagePaths)
  assert.deepEqual(bootstrap.settings, expectedSettings)
  assert.equal(bootstrap.historyPolicy.maxEntries > 0, true)
})

test('portable storage detection falls back to packaged portable executable path', () => {
  const portableRoot = detectPortableDataRoot({
    env: {},
    execPath: 'C:\\Apps\\Code X Soundboard-Portable-0.0.0-x64.exe',
    isPackaged: true,
  })
  const installedRoot = detectPortableDataRoot({
    env: {},
    execPath: 'C:\\Program Files\\Code X Soundboard\\Code X Soundboard.exe',
    isPackaged: true,
  })

  assert.equal(portableRoot, 'C:\\Apps\\data')
  assert.equal(installedRoot, null)
})

test('delete and undo restore cue, tags, and managed resource file', async (t) => {
  const harness = await createHarness()

  t.after(async () => {
    harness.db.close()
    await rm(harness.root, { recursive: true, force: true })
  })

  const inputDir = join(harness.root, 'inputs')
  const sourcePath = join(inputDir, 'intro.wav')
  await mkdir(inputDir, { recursive: true })
  await writeFile(sourcePath, writeSilentWavBuffer())

  const importResult = await importAudioPaths(harness.db, harness.storagePaths, [sourcePath])
  assert.equal(importResult.importedCueCount, 1)
  assert.equal(importResult.failedImports.length, 0)

  let snapshot = readBoardSnapshot(harness.db, harness.storagePaths)
  assert.equal(snapshot.cueCards.length, 1)

  const [importedCue] = snapshot.cueCards
  replaceCueCardTags(harness.db, importedCue.id, ['intro', 'stinger'])
  updateCueCard(harness.db, importedCue.id, {
    hotkey: 'Ctrl+1',
    playbackRate: 1.25,
    volume: 0.9,
  })

  snapshot = readBoardSnapshot(harness.db, harness.storagePaths)
  const cueBeforeDelete = snapshot.cueCards[0]

  const deletion = await deleteCueCard(harness.db, harness.storagePaths, cueBeforeDelete.id)
  assert.equal(readBoardSnapshot(harness.db, harness.storagePaths).cueCards.length, 0)
  assert.equal(deletion.snapshot.cue.id, cueBeforeDelete.id)
  assert.equal(deletion.cleanup.deletedResourceCount, 1)
  assert.equal(deletion.deletedResourceBackups.length, 1)
  assert.equal(deletion.snapshot.tags.length, 2)

  await assert.rejects(access(cueBeforeDelete.resource.absolutePath))
  await access(deletion.deletedResourceBackups[0].trashPath)

  await undoDeleteCue(harness.db, harness.storagePaths, deletion)

  const restoredSnapshot = readBoardSnapshot(harness.db, harness.storagePaths)
  assert.equal(restoredSnapshot.cueCards.length, 1)

  const restoredCue = restoredSnapshot.cueCards[0]
  assert.equal(restoredCue.id, cueBeforeDelete.id)
  assert.equal(restoredCue.name, cueBeforeDelete.name)
  assert.equal(restoredCue.hotkey, 'Ctrl+1')
  assert.equal(restoredCue.playbackRate, 1.25)
  assert.equal(restoredCue.volume, 0.9)
  assert.deepEqual(
    restoredCue.tags.map((tag) => tag.name).sort(),
    ['intro', 'stinger'],
  )
  await access(restoredCue.resource.absolutePath)
})

test('starter pack creates reusable demo cues for an empty library', async (t) => {
  const harness = await createHarness()

  t.after(async () => {
    harness.db.close()
    await rm(harness.root, { recursive: true, force: true })
  })

  const firstRun = await createStarterPack(harness.db, harness.storagePaths, { language: 'en-US' })
  assert.equal(firstRun.createdCueCount, 3)

  const firstSnapshot = readBoardSnapshot(harness.db, harness.storagePaths)
  assert.equal(firstSnapshot.cueCards.length, 3)
  assert.deepEqual(
    firstSnapshot.cueCards.map((cue) => cue.name),
    ['Intro Sting', 'Hype Hit', 'Outro Fall'],
  )

  const secondRun = await createStarterPack(harness.db, harness.storagePaths, { language: 'en-US' })
  assert.equal(secondRun.createdCueCount, 3)
  assert.equal(secondRun.createdResourceIds.length, 0)

  const secondSnapshot = readBoardSnapshot(harness.db, harness.storagePaths)
  assert.equal(secondSnapshot.cueCards.length, 6)
})

test('backup export and restore round-trip preserves settings and managed files', async (t) => {
  const harness = await createHarness()

  t.after(async () => {
    harness.db.close()
    await rm(harness.root, { recursive: true, force: true })
  })

  const inputDir = join(harness.root, 'inputs')
  const sourcePath = join(inputDir, 'theme.wav')
  const backupRoot = await mkdtemp(join(tmpdir(), 'local-sfx-board-export-'))
  const backupFilePath = join(backupRoot, 'soundboard-backup.cxsb')
  await mkdir(inputDir, { recursive: true })
  await writeFile(sourcePath, writeSilentWavBuffer(320))

  await importAudioPaths(harness.db, harness.storagePaths, [sourcePath])

  let snapshot = readBoardSnapshot(harness.db, harness.storagePaths)
  assert.equal(snapshot.cueCards.length, 1)

  const cueId = snapshot.cueCards[0].id
  updateCueCard(harness.db, cueId, {
    hotkey: 'Ctrl+Shift+1',
    playbackRate: 1.5,
    trimStartMs: 40,
    trimEndMs: 220,
  })
  replaceCueCardTags(harness.db, cueId, ['backup', 'restore'])
  writeSettings(harness.db, {
    language: 'en-US',
    selectedOutputDeviceId: 'virtual-device',
    hotkeySuggestionStrategy: {
      primaryModifier: 'Ctrl+Alt',
      includeAlternateModifiers: true,
      includeDigits: true,
      includeFunctionKeys: true,
      includeLetters: false,
    },
  })

  const bootstrap = readBootstrapSnapshot(harness.db, harness.storagePaths)
  const manifest = createBackupManifest(bootstrap, { appVersion: 'test-build' })
  const exportResult = await exportBackupBundle(harness.db, harness.storagePaths, backupFilePath, manifest)
  const exportedManifest = await readBackupManifest(exportResult.targetPath)

  assert.equal(exportedManifest.appVersion, 'test-build')
  assert.equal(exportedManifest.stats.cueCount, 1)

  await rm(harness.storagePaths.libraryDir, { recursive: true, force: true })
  await mkdir(harness.storagePaths.libraryDir, { recursive: true })
  writeSettings(harness.db, {
    language: 'zh-CN',
    selectedOutputDeviceId: '',
    hotkeySuggestionStrategy: {
      primaryModifier: 'Ctrl+Shift',
      includeAlternateModifiers: true,
      includeDigits: true,
      includeFunctionKeys: true,
      includeLetters: true,
    },
  })
  snapshot = readBoardSnapshot(harness.db, harness.storagePaths)
  updateCueCard(harness.db, snapshot.cueCards[0].id, {
    hotkey: 'Alt+F4',
    playbackRate: 0.75,
  })

  harness.db.close()
  await restoreBackupBundle(harness.storagePaths, exportResult.targetPath)
  harness.db = openAppDatabase(harness.storagePaths.databasePath)

  const restoredSettings = readSettings(harness.db)
  assert.equal(restoredSettings.language, 'en-US')
  assert.equal(restoredSettings.selectedOutputDeviceId, 'virtual-device')
  assert.deepEqual(restoredSettings.hotkeySuggestionStrategy, {
    primaryModifier: 'Ctrl+Alt',
    includeAlternateModifiers: true,
    includeDigits: true,
    includeFunctionKeys: true,
    includeLetters: false,
    groupingMode: 'none',
  })

  const restoredSnapshot = readBoardSnapshot(harness.db, harness.storagePaths)
  assert.equal(restoredSnapshot.cueCards.length, 1)
  assert.equal(restoredSnapshot.cueCards[0].hotkey, 'Ctrl+Shift+1')
  assert.equal(restoredSnapshot.cueCards[0].playbackRate, 1.5)
  assert.deepEqual(
    restoredSnapshot.cueCards[0].tags.map((tag) => tag.name).sort(),
    ['backup', 'restore'],
  )
  await access(restoredSnapshot.cueCards[0].resource.absolutePath)
  await rm(backupRoot, { recursive: true, force: true })
})

test('bulk hotkey repair assigns safe replacements for duplicate and reserved shortcuts', async (t) => {
  const harness = await createHarness()

  t.after(async () => {
    harness.db.close()
    await rm(harness.root, { recursive: true, force: true })
  })

  const inputDir = join(harness.root, 'inputs')
  await mkdir(inputDir, { recursive: true })

  const paths = ['a.wav', 'b.wav', 'c.wav'].map((name) => join(inputDir, name))

  for (const filePath of paths) {
    await writeFile(filePath, writeSilentWavBuffer())
  }

  await importAudioPaths(harness.db, harness.storagePaths, paths)

  const snapshot = readBoardSnapshot(harness.db, harness.storagePaths)
  updateCueCard(harness.db, snapshot.cueCards[0].id, { hotkey: 'Ctrl+1' })
  updateCueCard(harness.db, snapshot.cueCards[1].id, { hotkey: 'Ctrl+1' })
  updateCueCard(harness.db, snapshot.cueCards[2].id, { hotkey: 'Alt+F4' })

  const entriesBeforeRepair = harness.db
    .prepare(
      `
        SELECT id, name, hotkey
        FROM cue_cards
        WHERE TRIM(hotkey) <> ''
        ORDER BY sort_order ASC, created_at ASC
      `,
    )
    .all()
  const diagnosticsBeforeRepair = {
    failedCueIds: [],
    ...collectShortcutDiagnostics(entriesBeforeRepair),
  }
  const repairPlan = createShortcutRepairPlan(entriesBeforeRepair, diagnosticsBeforeRepair, {
    mode: 'assign',
    scopes: {
      duplicate: true,
      failed: false,
      reserved: true,
      weak: false,
    },
  })

  assert.equal(repairPlan.length, 2)
  assert.ok(repairPlan.every((entry) => entry.hotkey.includes('+')))

  const updatedCount = applyShortcutRepair(harness.db, repairPlan)
  assert.equal(updatedCount, 2)

  const entriesAfterRepair = harness.db
    .prepare(
      `
        SELECT id, name, hotkey
        FROM cue_cards
        WHERE TRIM(hotkey) <> ''
        ORDER BY sort_order ASC, created_at ASC
      `,
    )
    .all()
  const diagnosticsAfterRepair = collectShortcutDiagnostics(entriesAfterRepair)

  assert.deepEqual(diagnosticsAfterRepair.duplicateCueIds, [])
  assert.deepEqual(diagnosticsAfterRepair.reservedCueIds, [])
})

test('backup compatibility warns on legacy schema and blocks newer schema', async (t) => {
  const harness = await createHarness()

  t.after(async () => {
    harness.db.close()
    await rm(harness.root, { recursive: true, force: true })
  })

  const bootstrap = readBootstrapSnapshot(harness.db, harness.storagePaths)
  const manifest = createBackupManifest(bootstrap, { appVersion: 'test-build' })

  const legacyCompatibility = inspectBackupManifest(
    { ...manifest, schemaVersion: Math.max(1, manifest.schemaVersion - 1) },
    {
      supportedBackupVersion: BACKUP_MANIFEST_VERSION,
      currentSchemaVersion: manifest.schemaVersion,
      currentStorageMode: harness.storagePaths.mode,
    },
  )
  assert.equal(legacyCompatibility.level, 'warning')
  assert.equal(legacyCompatibility.blocked, false)

  const newerCompatibility = inspectBackupManifest(
    { ...manifest, schemaVersion: manifest.schemaVersion + 1 },
    {
      supportedBackupVersion: BACKUP_MANIFEST_VERSION,
      currentSchemaVersion: manifest.schemaVersion,
      currentStorageMode: harness.storagePaths.mode,
    },
  )
  assert.equal(newerCompatibility.level, 'blocked')
  assert.equal(newerCompatibility.blocked, true)
})

test('backup diff preview summarizes incoming and removed names', async (t) => {
  const harness = await createHarness()

  t.after(async () => {
    harness.db.close()
    await rm(harness.root, { recursive: true, force: true })
  })

  const inputDir = join(harness.root, 'inputs')
  await mkdir(inputDir, { recursive: true })

  const currentPath = join(inputDir, 'current.wav')
  const sharedPath = join(inputDir, 'shared.wav')
  await writeFile(currentPath, writeSilentWavBuffer(240))
  await writeFile(sharedPath, writeSilentWavBuffer(260))

  await importAudioPaths(harness.db, harness.storagePaths, [currentPath, sharedPath])

  let snapshot = readBoardSnapshot(harness.db, harness.storagePaths)
  updateCueCard(harness.db, snapshot.cueCards[0].id, { name: 'Current Only' })
  updateCueCard(harness.db, snapshot.cueCards[1].id, { name: 'Shared Cue' })
  replaceCueCardTags(harness.db, snapshot.cueCards[0].id, ['alpha'])
  replaceCueCardTags(harness.db, snapshot.cueCards[1].id, ['shared-tag'])

  const manifest = createBackupManifest(readBootstrapSnapshot(harness.db, harness.storagePaths), {
    appVersion: 'test-build',
    catalog: {
      cueNames: ['Shared Cue', 'Backup Only'],
      tagNames: ['shared-tag', 'backup-tag'],
      resourceNames: ['shared.wav', 'backup-only.wav'],
    },
  })

  const diff = buildBackupDiffSummary(manifest, readLibraryCatalogSnapshot(harness.db))
  assert.equal(diff.available, true)
  assert.equal(diff.cues?.sharedCount, 1)
  assert.equal(diff.cues?.incomingOnlyCount, 1)
  assert.equal(diff.cues?.currentOnlyCount, 1)
  assert.deepEqual(diff.cues?.sharedItems, ['Shared Cue'])
  assert.deepEqual(diff.tags?.sharedItems, ['shared-tag'])
  assert.deepEqual(diff.cues?.incomingSamples, ['Backup Only'])
  assert.deepEqual(diff.cues?.currentOnlySamples, ['Current Only'])
  assert.deepEqual(diff.resources?.incomingItems, ['backup-only.wav'])
  assert.deepEqual(diff.tags?.incomingSamples, ['backup-tag'])
  assert.deepEqual(diff.resources?.currentOnlySamples, ['current.wav'])
})

test('tag rename can merge and delete removes tag bindings across cues', async (t) => {
  const harness = await createHarness()

  t.after(async () => {
    harness.db.close()
    await rm(harness.root, { recursive: true, force: true })
  })

  const inputDir = join(harness.root, 'inputs')
  await mkdir(inputDir, { recursive: true })

  const alphaPath = join(inputDir, 'alpha.wav')
  const betaPath = join(inputDir, 'beta.wav')
  await writeFile(alphaPath, writeSilentWavBuffer(220))
  await writeFile(betaPath, writeSilentWavBuffer(240))

  await importAudioPaths(harness.db, harness.storagePaths, [alphaPath, betaPath])
  let snapshot = readBoardSnapshot(harness.db, harness.storagePaths)

  replaceCueCardTags(harness.db, snapshot.cueCards[0].id, ['alpha', 'shared'])
  replaceCueCardTags(harness.db, snapshot.cueCards[1].id, ['beta'])

  snapshot = readBoardSnapshot(harness.db, harness.storagePaths)
  const alphaTag = snapshot.cueCards[0].tags.find((tag) => tag.name === 'alpha')
  const betaTag = snapshot.cueCards[1].tags.find((tag) => tag.name === 'beta')

  assert.ok(alphaTag)
  assert.ok(betaTag)

  updateTagColor(harness.db, alphaTag.id, '#ffb86b')
  renameTag(harness.db, alphaTag.id, 'beta')

  snapshot = readBoardSnapshot(harness.db, harness.storagePaths)
  assert.deepEqual(snapshot.cueCards[0].tags.map((tag) => tag.name).sort(), ['beta', 'shared'])
  assert.deepEqual(snapshot.cueCards[1].tags.map((tag) => tag.name).sort(), ['beta'])

  const mergedBetaTag = snapshot.cueCards[0].tags.find((tag) => tag.name === 'beta')
  assert.ok(mergedBetaTag)

  deleteTag(harness.db, mergedBetaTag.id)

  snapshot = readBoardSnapshot(harness.db, harness.storagePaths)
  assert.deepEqual(snapshot.cueCards[0].tags.map((tag) => tag.name), ['shared'])
  assert.deepEqual(snapshot.cueCards[1].tags.map((tag) => tag.name), [])
})

test('tag merge and delete history payloads can be undone safely', async (t) => {
  const harness = await createHarness()

  t.after(async () => {
    harness.db.close()
    await rm(harness.root, { recursive: true, force: true })
  })

  const inputDir = join(harness.root, 'inputs')
  await mkdir(inputDir, { recursive: true })

  const leftPath = join(inputDir, 'left.wav')
  const rightPath = join(inputDir, 'right.wav')
  await writeFile(leftPath, writeSilentWavBuffer(200))
  await writeFile(rightPath, writeSilentWavBuffer(260))

  await importAudioPaths(harness.db, harness.storagePaths, [leftPath, rightPath])
  let snapshot = readBoardSnapshot(harness.db, harness.storagePaths)

  replaceCueCardTags(harness.db, snapshot.cueCards[0].id, ['intro'])
  replaceCueCardTags(harness.db, snapshot.cueCards[1].id, ['hype'])
  snapshot = readBoardSnapshot(harness.db, harness.storagePaths)

  const introTag = snapshot.cueCards[0].tags.find((tag) => tag.name === 'intro')
  assert.ok(introTag)

  const mergeResult = renameTag(harness.db, introTag.id, 'hype')
  snapshot = readBoardSnapshot(harness.db, harness.storagePaths)
  assert.deepEqual(snapshot.cueCards[0].tags.map((tag) => tag.name), ['hype'])
  assert.deepEqual(snapshot.cueCards[1].tags.map((tag) => tag.name), ['hype'])

  undoTagOperation(harness.db, mergeResult.history)
  snapshot = readBoardSnapshot(harness.db, harness.storagePaths)
  assert.deepEqual(snapshot.cueCards[0].tags.map((tag) => tag.name), ['intro'])
  assert.deepEqual(snapshot.cueCards[1].tags.map((tag) => tag.name), ['hype'])

  const restoredIntroTag = snapshot.cueCards[0].tags.find((tag) => tag.name === 'intro')
  assert.ok(restoredIntroTag)

  const deleteResult = deleteTag(harness.db, restoredIntroTag.id)
  snapshot = readBoardSnapshot(harness.db, harness.storagePaths)
  assert.deepEqual(snapshot.cueCards[0].tags.map((tag) => tag.name), [])

  undoTagOperation(harness.db, deleteResult.history)
  snapshot = readBoardSnapshot(harness.db, harness.storagePaths)
  assert.deepEqual(snapshot.cueCards[0].tags.map((tag) => tag.name), ['intro'])
})

test('batch tag merge consolidates selected tags and can be undone', async (t) => {
  const harness = await createHarness()

  t.after(async () => {
    harness.db.close()
    await rm(harness.root, { recursive: true, force: true })
  })

  const inputDir = join(harness.root, 'inputs')
  await mkdir(inputDir, { recursive: true })

  const onePath = join(inputDir, 'one.wav')
  const twoPath = join(inputDir, 'two.wav')
  const threePath = join(inputDir, 'three.wav')
  await writeFile(onePath, writeSilentWavBuffer(220))
  await writeFile(twoPath, writeSilentWavBuffer(240))
  await writeFile(threePath, writeSilentWavBuffer(260))

  await importAudioPaths(harness.db, harness.storagePaths, [onePath, twoPath, threePath])
  let snapshot = readBoardSnapshot(harness.db, harness.storagePaths)

  replaceCueCardTags(harness.db, snapshot.cueCards[0].id, ['intro'])
  replaceCueCardTags(harness.db, snapshot.cueCards[1].id, ['hype'])
  replaceCueCardTags(harness.db, snapshot.cueCards[2].id, ['sting'])
  snapshot = readBoardSnapshot(harness.db, harness.storagePaths)

  const selectedTagIds = snapshot.cueCards.map((cue) => cue.tags[0].id)
  const mergeResult = batchMergeTags(harness.db, selectedTagIds, 'fx')

  snapshot = readBoardSnapshot(harness.db, harness.storagePaths)
  assert.deepEqual(snapshot.cueCards.map((cue) => cue.tags.map((tag) => tag.name)), [['fx'], ['fx'], ['fx']])
  assert.equal(mergeResult.operations.length, 3)

  undoTagOperation(harness.db, {
    action: 'batch-merge',
    targetName: 'fx',
    operations: mergeResult.operations,
  })

  snapshot = readBoardSnapshot(harness.db, harness.storagePaths)
  assert.deepEqual(snapshot.cueCards.map((cue) => cue.tags.map((tag) => tag.name)), [['intro'], ['hype'], ['sting']])
})

test('batch tag delete and recolor operate on selected tags', async (t) => {
  const harness = await createHarness()

  t.after(async () => {
    harness.db.close()
    await rm(harness.root, { recursive: true, force: true })
  })

  const inputDir = join(harness.root, 'inputs')
  await mkdir(inputDir, { recursive: true })

  const leftPath = join(inputDir, 'left.wav')
  const middlePath = join(inputDir, 'middle.wav')
  const rightPath = join(inputDir, 'right.wav')
  await writeFile(leftPath, writeSilentWavBuffer(180))
  await writeFile(middlePath, writeSilentWavBuffer(200))
  await writeFile(rightPath, writeSilentWavBuffer(220))

  await importAudioPaths(harness.db, harness.storagePaths, [leftPath, middlePath, rightPath])
  let snapshot = readBoardSnapshot(harness.db, harness.storagePaths)

  replaceCueCardTags(harness.db, snapshot.cueCards[0].id, ['intro'])
  replaceCueCardTags(harness.db, snapshot.cueCards[1].id, ['hype'])
  replaceCueCardTags(harness.db, snapshot.cueCards[2].id, ['outro'])
  snapshot = readBoardSnapshot(harness.db, harness.storagePaths)

  const tagIds = snapshot.cueCards.map((cue) => cue.tags[0].id)
  const recolorResult = batchUpdateTagColor(harness.db, tagIds.slice(0, 2), '#ffb86b')
  assert.equal(recolorResult.updatedCount, 2)

  snapshot = readBoardSnapshot(harness.db, harness.storagePaths)
  assert.equal(snapshot.cueCards[0].tags[0].color, '#ffb86b')
  assert.equal(snapshot.cueCards[1].tags[0].color, '#ffb86b')
  assert.notEqual(snapshot.cueCards[2].tags[0].color, '#ffb86b')

  const deleteResult = batchDeleteTags(harness.db, tagIds.slice(0, 2))
  assert.equal(deleteResult.deletedCount, 2)

  snapshot = readBoardSnapshot(harness.db, harness.storagePaths)
  assert.deepEqual(snapshot.cueCards[0].tags, [])
  assert.deepEqual(snapshot.cueCards[1].tags, [])
  assert.deepEqual(snapshot.cueCards[2].tags.map((tag) => tag.name), ['outro'])

  undoTagOperation(harness.db, {
    action: 'batch-delete',
    operations: deleteResult.operations,
  })

  snapshot = readBoardSnapshot(harness.db, harness.storagePaths)
  assert.deepEqual(snapshot.cueCards[0].tags.map((tag) => tag.name), ['intro'])
  assert.deepEqual(snapshot.cueCards[1].tags.map((tag) => tag.name), ['hype'])
  assert.deepEqual(snapshot.cueCards[2].tags.map((tag) => tag.name), ['outro'])
})

test('batch tag rename rule can normalize selected tag names', async (t) => {
  const harness = await createHarness()

  t.after(async () => {
    harness.db.close()
    await rm(harness.root, { recursive: true, force: true })
  })

  const inputDir = join(harness.root, 'inputs')
  await mkdir(inputDir, { recursive: true })

  const firstPath = join(inputDir, 'rename-one.wav')
  const secondPath = join(inputDir, 'rename-two.wav')
  await writeFile(firstPath, writeSilentWavBuffer(180))
  await writeFile(secondPath, writeSilentWavBuffer(180))

  await importAudioPaths(harness.db, harness.storagePaths, [firstPath, secondPath])
  let snapshot = readBoardSnapshot(harness.db, harness.storagePaths)

  replaceCueCardTags(harness.db, snapshot.cueCards[0].id, ['  intro  cue  '])
  replaceCueCardTags(harness.db, snapshot.cueCards[1].id, ['hype cue'])
  snapshot = readBoardSnapshot(harness.db, harness.storagePaths)

  const selectedTagIds = snapshot.cueCards.map((cue) => cue.tags[0].id)
  const result = batchRenameTagsByRule(harness.db, selectedTagIds, {
    findText: 'cue',
    replaceText: 'tag',
    prefix: 'live-',
    suffix: '',
    trimWhitespace: true,
    collapseSpaces: true,
    caseMode: 'title',
  })

  assert.equal(result.renamedCount, 2)
  assert.deepEqual(
    result.preview.map((entry) => entry.nextName).sort(),
    ['Live-Intro Tag', 'Live-Hype Tag'].sort(),
  )

  snapshot = readBoardSnapshot(harness.db, harness.storagePaths)
  assert.deepEqual(snapshot.cueCards[0].tags.map((tag) => tag.name), ['Live-Intro Tag'])
  assert.deepEqual(snapshot.cueCards[1].tags.map((tag) => tag.name), ['Live-Hype Tag'])
})

test('corrupted backup package is flagged by integrity inspection', async (t) => {
  const harness = await createHarness()

  t.after(async () => {
    harness.db.close()
    await rm(harness.root, { recursive: true, force: true })
  })

  const backupRoot = await mkdtemp(join(tmpdir(), 'local-sfx-board-export-'))
  const backupFilePath = join(backupRoot, 'corrupt-check.cxsb')
  const manifest = createBackupManifest(readBootstrapSnapshot(harness.db, harness.storagePaths), {
    appVersion: 'test-build',
  })

  const exportResult = await exportBackupBundle(harness.db, harness.storagePaths, backupFilePath, manifest)
  const raw = await readFile(exportResult.targetPath)
  const truncated = raw.subarray(0, Math.max(16, raw.length - 24))
  await writeFile(exportResult.targetPath, truncated)

  const inspection = await inspectBackupPackage(exportResult.targetPath)
  assert.equal(inspection.integrity.valid, false)
  assert.equal(inspection.integrity.level, 'blocked')
  assert.equal(inspection.integrity.reasons[0].code, 'package_corrupt')

  await assert.rejects(() => restoreBackupBundle(harness.storagePaths, exportResult.targetPath))
  await rm(backupRoot, { recursive: true, force: true })
})

test('password-protected backup requires password and restores with the correct password', async (t) => {
  const harness = await createHarness()

  t.after(async () => {
    harness.db.close()
    await rm(harness.root, { recursive: true, force: true })
  })

  const inputDir = join(harness.root, 'inputs')
  const sourcePath = join(inputDir, 'protected.wav')
  const backupRoot = await mkdtemp(join(tmpdir(), 'local-sfx-board-export-'))
  const backupFilePath = join(backupRoot, 'protected.cxsb')
  await mkdir(inputDir, { recursive: true })
  await writeFile(sourcePath, writeSilentWavBuffer(260))

  await importAudioPaths(harness.db, harness.storagePaths, [sourcePath])
  const manifest = createBackupManifest(readBootstrapSnapshot(harness.db, harness.storagePaths), {
    appVersion: 'test-build',
  })
  const exportResult = await exportBackupBundle(harness.db, harness.storagePaths, backupFilePath, manifest, {
    password: 'stream-pass',
  })

  const noPasswordInspection = await inspectBackupPackage(exportResult.targetPath)
  assert.equal(noPasswordInspection.integrity.level, 'warning')
  assert.equal(noPasswordInspection.integrity.reasons[0].code, 'password_required')

  const wrongPasswordInspection = await inspectBackupPackage(exportResult.targetPath, 'wrong-pass')
  assert.equal(wrongPasswordInspection.integrity.level, 'blocked')
  assert.equal(wrongPasswordInspection.integrity.reasons[0].code, 'password_or_signature_invalid')

  harness.db.close()
  await restoreBackupBundle(harness.storagePaths, exportResult.targetPath, 'stream-pass')
  harness.db = openAppDatabase(harness.storagePaths.databasePath)

  const restoredSnapshot = readBoardSnapshot(harness.db, harness.storagePaths)
  assert.equal(restoredSnapshot.cueCards.length, 1)
  await access(restoredSnapshot.cueCards[0].resource.absolutePath)
  await rm(backupRoot, { recursive: true, force: true })
})

test('imported cues without hotkeys receive non-conflicting hotkey suggestions', async (t) => {
  const harness = await createHarness()

  t.after(async () => {
    harness.db.close()
    await rm(harness.root, { recursive: true, force: true })
  })

  const inputDir = join(harness.root, 'inputs')
  await mkdir(inputDir, { recursive: true })

  const paths = ['intro.wav', 'hype.wav', 'end.wav'].map((name) => join(inputDir, name))

  for (const filePath of paths) {
    await writeFile(filePath, writeSilentWavBuffer())
  }

  const importResult = await importAudioPaths(harness.db, harness.storagePaths, paths)
  const allEntries = harness.db
    .prepare(
      `
        SELECT id, name, hotkey
        FROM cue_cards
        ORDER BY sort_order ASC, created_at ASC
      `,
    )
    .all()

  const suggestions = createShortcutRepairPlan(
    allEntries,
    {
      failedCueIds: [],
      duplicateCueIds: [],
      reservedCueIds: [],
      weakCueIds: [],
    },
    {
      mode: 'assign',
      targetCueIds: importResult.importedCueIds,
      strategy: {
        primaryModifier: 'Alt+Shift',
        includeAlternateModifiers: false,
        includeDigits: true,
        includeFunctionKeys: false,
        includeLetters: false,
      },
    },
  )

  assert.equal(suggestions.length, importResult.importedCueIds.length)
  assert.equal(new Set(suggestions.map((entry) => entry.hotkey)).size, suggestions.length)
  assert.ok(suggestions.every((entry) => /^Alt\+Shift\+\d$/.test(entry.hotkey)))
})

test('hotkey suggestions can be grouped by first tag', () => {
  const suggestions = createShortcutRepairPlan(
    [
      { id: 'cue-b', name: 'B', hotkey: '', tagNames: ['crowd'] },
      { id: 'cue-a', name: 'A', hotkey: '', tagNames: ['intro'] },
      { id: 'cue-c', name: 'C', hotkey: '', tagNames: [] },
    ],
    {
      failedCueIds: [],
      duplicateCueIds: [],
      reservedCueIds: [],
      weakCueIds: [],
    },
    {
      mode: 'assign',
      targetCueIds: ['cue-b', 'cue-a', 'cue-c'],
      strategy: {
        primaryModifier: 'Ctrl+Shift',
        includeAlternateModifiers: false,
        includeDigits: true,
        includeFunctionKeys: false,
        includeLetters: false,
        groupingMode: 'tag',
      },
    },
  )

  assert.deepEqual(
    suggestions.map((entry) => entry.groupLabel),
    ['crowd', 'intro', 'Untagged'],
  )
  assert.deepEqual(
    suggestions.map((entry) => entry.cueId),
    ['cue-b', 'cue-a', 'cue-c'],
  )
})

test('tag snapshots carry updated timestamps and recent tag usage touches them', async (t) => {
  const harness = await createHarness()

  t.after(async () => {
    harness.db.close()
    await rm(harness.root, { recursive: true, force: true })
  })

  const inputDir = join(harness.root, 'inputs')
  const sourcePath = join(inputDir, 'recent-tag.wav')

  await mkdir(inputDir, { recursive: true })
  await writeFile(sourcePath, writeSilentWavBuffer())
  await importAudioPaths(harness.db, harness.storagePaths, [sourcePath])

  let snapshot = readBoardSnapshot(harness.db, harness.storagePaths)
  const cueId = snapshot.cueCards[0].id

  replaceCueCardTags(harness.db, cueId, ['intro'])
  snapshot = readBoardSnapshot(harness.db, harness.storagePaths)
  const beforeTouch = snapshot.cueCards[0].tags.find((tag) => tag.name === 'intro')

  assert.ok(beforeTouch)
  assert.match(beforeTouch.createdAt, /^\d{4}-\d{2}-\d{2}T/)
  assert.match(beforeTouch.updatedAt, /^\d{4}-\d{2}-\d{2}T/)

  await new Promise((resolve) => setTimeout(resolve, 15))
  replaceCueCardTags(harness.db, cueId, ['intro', 'stinger'])

  snapshot = readBoardSnapshot(harness.db, harness.storagePaths)
  const afterTouch = snapshot.cueCards[0].tags.find((tag) => tag.name === 'intro')

  assert.ok(afterTouch)
  assert.ok(new Date(afterTouch.updatedAt).getTime() >= new Date(beforeTouch.updatedAt).getTime())
})
