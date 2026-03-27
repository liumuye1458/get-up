export type AppSettings = {
  language: 'zh-CN' | 'en-US'
  globalVolume: number
  allowOverlap: boolean
  stopOthersOnTrigger: boolean
  selectedOutputDeviceId: string
  warnOnMissingFiles: boolean
  globalShortcutsEnabled: boolean
  tagManagerSortMode: 'name' | 'usage' | 'recent'
  backupImportSelectionTemplates: BackupImportSelectionTemplate[]
  hotkeySuggestionStrategy: {
    primaryModifier: 'Ctrl+Shift' | 'Ctrl+Alt' | 'Alt+Shift'
    includeAlternateModifiers: boolean
    includeDigits: boolean
    includeFunctionKeys: boolean
    includeLetters: boolean
    groupingMode: 'none' | 'tag'
  }
}

type FileStatusResult = {
  missing: string[]
}

export type ImportFailureCode =
  | 'path_missing'
  | 'permission_denied'
  | 'unsupported_type'
  | 'directory_scan_failed'
  | 'hash_failed'
  | 'metadata_read_failed'
  | 'library_copy_failed'
  | 'database_write_failed'
  | 'unknown'

export type ImportFailure = {
  path: string
  code: ImportFailureCode
  reason: string
  retryable: boolean
}

export type ImportProgress = {
  phase: 'scanning' | 'importing' | 'complete'
  completed: number
  total: number
  importedCueCount: number
  failedCount: number
  currentPath: string | null
}

export type BootstrapSnapshot = {
  schemaVersion: number
  generatedAt: string
  storage: {
    mode: 'installed' | 'portable'
    dataRoot: string
    libraryDir: string
    waveformsDir: string
    trashDir: string
    databasePath: string
  }
  historyPolicy: {
    maxEntries: number
    activeRetentionDays: number
    undoneRetentionDays: number
  }
  settings: AppSettings
  stats: {
    resourceCount: number
    cueCount: number
    tagCount: number
    orphanResourceCount: number
  }
}

export type LibraryTag = {
  id: string
  name: string
  color: string | null
  colorMode: 'auto' | 'manual'
  createdAt: string
  updatedAt: string
}

export type LibraryCueCard = {
  id: string
  resourceId: string
  name: string
  hotkey: string
  playbackRate: number
  volume: number
  trimStartMs: number
  trimEndMs: number | null
  sortOrder: number
  createdAt: string
  updatedAt: string
  resource: {
    originalFilename: string
    storageFilename: string
    durationMs: number | null
    absolutePath: string
  }
  tags: LibraryTag[]
}

export type LibrarySnapshot = {
  cueCards: LibraryCueCard[]
}

export type ShortcutDiagnostics = {
  failedCueIds: string[]
  duplicateCueIds: string[]
  reservedCueIds: string[]
  weakCueIds: string[]
}

export type HotkeyRepairScope = {
  duplicate: boolean
  failed: boolean
  reserved: boolean
  weak: boolean
}

export type HotkeyRepairMode = 'assign' | 'clear'

export type ImportResult = ShortcutDiagnostics & {
  invalidPathCount: number
  skippedDuplicateInputCount: number
  totalDiscovered: number
  importedCueCount: number
  importedResourceCount: number
  reusedResourceCount: number
  skippedCount: number
  failedImports: ImportFailure[]
  importedCueIds: string[]
  importedResourceIds: string[]
  suggestedHotkeys: HotkeyRepairAssignment[]
}

export type SettingsUpdateResult = ShortcutDiagnostics & {
  settings: AppSettings
}

export type CuePatch = Partial<{
  name: string
  hotkey: string
  playbackRate: number
  volume: number
  trimStartMs: number
  trimEndMs: number | null
  sortOrder: number
}>

export type BatchTagMode = 'add' | 'remove' | 'replace'
export type TagRenameRule = {
  findText: string
  replaceText: string
  prefix: string
  suffix: string
  trimWhitespace: boolean
  collapseSpaces: boolean
  caseMode: 'preserve' | 'lower' | 'upper' | 'title'
}

export type BackupImportSelection = {
  cues: {
    incomingOnly: string[]
    currentOnly: string[]
    shared: string[]
  }
  tags: {
    incomingOnly: string[]
    currentOnly: string[]
    shared: string[]
  }
  resources: {
    incomingOnly: string[]
    currentOnly: string[]
    shared: string[]
  }
}

export type BackupImportSelectionTemplate = {
  id: string
  name: string
  selection: BackupImportSelection
  createdAt: string
  updatedAt: string
}

export type TagRenamePreviewEntry = {
  tagId: string
  previousName: string
  nextName: string
}

export type BatchTagRenameResult = {
  renamedCount: number
  preview: TagRenamePreviewEntry[]
  snapshot: LibrarySnapshot
}

export type DeleteCueResult = ShortcutDiagnostics & {
  cleanup: {
    deletedResourceCount: number
    deletedTagCount: number
  }
  snapshot: LibrarySnapshot
}

export type CleanupUnusedResult = {
  cleanup: {
    deletedResourceCount: number
    deletedTagCount: number
  }
  snapshot: LibrarySnapshot
}

export type HistoryEntry = {
  id: string
  type: 'import' | 'delete' | 'tag'
  status: 'active' | 'undone'
  summary: string
  createdAt: string
  undoneAt: string | null
}

export type UndoHistoryResult = {
  history: HistoryEntry[]
  snapshot: LibrarySnapshot
  bootstrap: BootstrapSnapshot
  diagnostics: ShortcutDiagnostics
}

export type StarterPackResult = {
  snapshot: LibrarySnapshot
  bootstrap: BootstrapSnapshot
  history: HistoryEntry[]
  diagnostics: ShortcutDiagnostics
}

export type HotkeyRepairAssignment = {
  cueId: string
  name: string
  hotkey: string
  groupLabel: string | null
}

export type BackupCatalog = {
  cueNames: string[]
  tagNames: string[]
  resourceNames: string[]
}

export type BackupDiffGroup = {
  currentCount: number
  backupCount: number
  sharedCount: number
  incomingOnlyCount: number
  currentOnlyCount: number
  sharedItems: string[]
  incomingItems: string[]
  currentOnlyItems: string[]
  incomingSamples: string[]
  currentOnlySamples: string[]
}

export type LibraryTagManagerEntry = LibraryTag & {
  cueCount: number
}

export type BackupDiffSummary = {
  available: boolean
  basis: 'name'
  cues: BackupDiffGroup | null
  tags: BackupDiffGroup | null
  resources: BackupDiffGroup | null
}

export type HotkeyRepairResult = {
  updatedCount: number
  assignments: HotkeyRepairAssignment[]
  snapshot: LibrarySnapshot
  diagnostics: ShortcutDiagnostics
}

export type BackupManifest = {
  format: string
  version: number
  createdAt: string
  schemaVersion: number
  storageMode: BootstrapSnapshot['storage']['mode']
  stats: BootstrapSnapshot['stats']
  catalog?: BackupCatalog | null
  appVersion: string | null
  compression?: string
  integrity?: {
    databaseSha256: string
    libraryFilesSha256: string
    waveformFilesSha256: string
    trashFilesSha256: string
  } | null
  encryption?: {
    enabled: boolean
    kdf?: string
    cipher?: string
    saltHex?: string
    ivHex?: string
    authTagHex?: string
  }
  signature?: {
    algorithm: string
    valueHex: string
  } | null
}

export type BackupCompatibilityReasonCode =
  | 'backup_format_too_new'
  | 'backup_format_legacy'
  | 'schema_too_new'
  | 'schema_legacy'
  | 'storage_mode_changed'

export type BackupIntegrityReasonCode =
  | 'package_corrupt'
  | 'database_checksum_mismatch'
  | 'library_checksum_mismatch'
  | 'waveform_checksum_mismatch'
  | 'trash_checksum_mismatch'
  | 'password_required'
  | 'password_or_signature_invalid'
  | 'encrypted_payload_corrupt'

export type BackupCompatibility = {
  level: 'ok' | 'warning' | 'blocked'
  blocked: boolean
  reasons: Array<{
    code: BackupCompatibilityReasonCode
    detail: string
  }>
}

export type BackupIntegrity = {
  level: 'ok' | 'warning' | 'blocked'
  valid: boolean
  reasons: Array<{
    code: BackupIntegrityReasonCode
    detail: string
  }>
}

export type BackupExportResult = {
  cancelled: boolean
  targetPath: string | null
  manifest: BackupManifest | null
}

export type BackupImportResult = {
  cancelled: boolean
  sourcePath: string | null
  manifest: BackupManifest | null
  compatibility: BackupCompatibility | null
  integrity: BackupIntegrity | null
  diffSummary?: BackupDiffSummary | null
  snapshot?: LibrarySnapshot
  bootstrap?: BootstrapSnapshot
  history?: HistoryEntry[]
  diagnostics?: ShortcutDiagnostics
}

export type TextExportResult = {
  cancelled: boolean
  targetPath: string | null
}

export type BackupDiffExportFormat = 'txt' | 'csv' | 'json'

export type WorkspaceHostApi = {
  getBootstrapSnapshot: () => Promise<BootstrapSnapshot>
  getLibrarySnapshot: () => Promise<LibrarySnapshot>
  importAudioPaths: (paths: string[]) => Promise<ImportResult>
  createStarterPack: () => Promise<StarterPackResult>
  updateSettings: (patch: Partial<AppSettings>) => Promise<SettingsUpdateResult>
  updateCue: (cueId: string, patch: CuePatch) => Promise<ShortcutDiagnostics>
  setCueTags: (cueId: string, tagNames: string[]) => Promise<LibrarySnapshot>
  batchCueTags: (cueIds: string[], tagNames: string[], mode: BatchTagMode) => Promise<LibrarySnapshot>
  reorderCues: (orderedCueIds: string[]) => Promise<LibrarySnapshot>
  deleteCue: (cueId: string) => Promise<DeleteCueResult>
  updateTagColor: (tagId: string, color: string | null) => Promise<LibrarySnapshot>
  batchUpdateTagColor: (tagIds: string[], color: string | null) => Promise<LibrarySnapshot>
  renameTag: (tagId: string, nextName: string) => Promise<LibrarySnapshot>
  deleteTag: (tagId: string) => Promise<LibrarySnapshot>
  batchDeleteTags: (tagIds: string[]) => Promise<LibrarySnapshot>
  batchMergeTags: (tagIds: string[], targetName: string) => Promise<LibrarySnapshot>
  batchRenameTagsByRule: (tagIds: string[], rule: TagRenameRule) => Promise<BatchTagRenameResult>
  cleanupUnusedLibrary: () => Promise<CleanupUnusedResult>
  listHistory: () => Promise<HistoryEntry[]>
  undoHistoryEntry: (entryId: string) => Promise<UndoHistoryResult>
  getShortcutDiagnostics: () => Promise<ShortcutDiagnostics>
  repairShortcutConflicts: (
    options: { mode: HotkeyRepairMode; scopes: HotkeyRepairScope },
  ) => Promise<HotkeyRepairResult>
  applyShortcutAssignments: (assignments: HotkeyRepairAssignment[]) => Promise<HotkeyRepairResult>
  exportLibraryBackup: (password?: string) => Promise<BackupExportResult>
  previewLibraryBackupImport: () => Promise<BackupImportResult>
  importLibraryBackup: (
    sourcePath: string,
    password?: string,
    selection?: BackupImportSelection,
  ) => Promise<BackupImportResult>
  exportBackupDiffReport: (
    payload: { format: BackupDiffExportFormat; content: string },
  ) => Promise<TextExportResult>
  openFloatingControlWindow: () => Promise<void>
  focusMainWindow: () => Promise<void>
  pickAudioFiles: () => Promise<string[]>
  checkFilesExist: (paths: string[]) => Promise<FileStatusResult>
  getPathForFile: (file: File) => string
  onImportProgress: (callback: (progress: ImportProgress) => void) => () => void
  onShortcutTriggered: (callback: (soundId: string) => void) => () => void
}

declare global {
  interface ChromeWebView {
    postMessage: (message: string) => void
    addEventListener: (type: 'message', listener: (event: { data: string }) => void) => void
    removeEventListener: (type: 'message', listener: (event: { data: string }) => void) => void
  }

  interface Window {
    chrome?: {
      webview?: ChromeWebView
    }
  }

  interface Window {
    desktopApi: WorkspaceHostApi
    __CODEX_WORKSPACE_HOST__?: WorkspaceHostApi
  }
}

export {}
