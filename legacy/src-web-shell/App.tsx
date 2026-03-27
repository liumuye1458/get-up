import {
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import './App.css'
import i18n from './i18n'
import { isHostedByNativeWorkspaceShell, workspaceHost } from './workspace-host'
import {
  buildAdminWorkspaceViewProps,
  buildLibraryWorkspaceContentProps,
  buildWorkspaceChromeProps,
} from './workspace-web/assemblers'
import {
  CueEditorDrawer,
  FloatingControlView,
  WorkspaceDialogs,
} from './workspace-web/overlays'
import { publishWorkspaceShellState } from './workspace-web/shell-sync'
import { subscribeWorkspaceHostCommands } from './workspace-web/host-commands'
import {
  WorkspaceDock,
  WorkspaceDropOverlay,
  WorkspaceSidebar,
  WorkspaceTopbar,
} from './workspace-web/WorkspaceChrome'
import {
  AdminWorkspaceView,
} from './workspace-web/pages/admin'
import { LibraryWorkspaceContent } from './workspace-web/pages/library'
import type { WorkspaceSection } from './workspace-web/types'
import { useCopy } from './use-copy'
import type {
  AppSettings,
  BackupCompatibility,
  BackupCompatibilityReasonCode,
  BackupDiffExportFormat,
  BackupDiffGroup,
  BackupImportSelection,
  BackupImportSelectionTemplate,
  BackupIntegrityReasonCode,
  BackupImportResult,
  BatchTagRenameResult,
  HotkeyRepairMode,
  HotkeyRepairScope,
  BatchTagMode,
  BootstrapSnapshot,
  CuePatch,
  HistoryEntry,
  ImportFailure,
  ImportFailureCode,
  ImportProgress,
  ImportResult,
  LibraryCueCard,
  LibraryTag,
  LibraryTagManagerEntry,
  LibrarySnapshot,
  ShortcutDiagnostics,
  TagRenamePreviewEntry,
  TagRenameRule,
} from './electron'

type ActivePlayback = {
  id: string
  name: string
  startedAt: number
  paused: boolean
}

type OutputDeviceOption = {
  deviceId: string
  label: string
}

type CopySet = ReturnType<typeof useCopy>
type CardViewMode = 'paged' | 'virtual'
type TagManagerSortMode = 'name' | 'usage' | 'recent'
type RuntimeDiagnostics = {
  outputFallbackCount: number
  unsupportedOutputCount: number
  playbackFailureCount: number
  lastPlaybackFailure: string | null
}
type GridMetrics = {
  width: number
  height: number
  scrollTop: number
}
type SelectedTagSummary = {
  name: string
  color: string | null
  count: number
}
type BackupDiffSectionView = {
  key: 'cues' | 'tags' | 'resources'
  title: string
  group: BackupDiffGroup | null
  hasMatches: boolean
  incomingItems: string[]
  currentOnlyItems: string[]
  sharedItems: string[]
}
type BackupDiffSummaryView = {
  keyword: string
  totalSectionCount: number
  matchedSectionCount: number
  totals: {
    current: number
    backup: number
    incomingOnly: number
    currentOnly: number
    shared: number
  }
  sections: Array<{
    key: string
    title: string
    hasMatches: boolean
    current: number
    backup: number
    incomingOnly: number
    currentOnly: number
    shared: number
  }>
}
type BackupDiffBucketKey = 'incomingOnly' | 'currentOnly' | 'shared'
const backupDiffSectionKeys = ['cues', 'tags', 'resources'] as const

const defaultSettings: AppSettings = {
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

const speedPresets = [0.75, 1, 1.25, 1.5]
const tagColorPalette = ['#ffb86b', '#ffd36b', '#9fd36f', '#6fd3b0', '#75c7ff', '#8fa8ff', '#c99cff', '#f79ad3']
const emptyBackupImportSelection: BackupImportSelection = {
  cues: { incomingOnly: [], currentOnly: [], shared: [] },
  tags: { incomingOnly: [], currentOnly: [], shared: [] },
  resources: { incomingOnly: [], currentOnly: [], shared: [] },
}

function cloneBackupImportSelection(selection: BackupImportSelection): BackupImportSelection {
  return {
    cues: {
      incomingOnly: [...selection.cues.incomingOnly],
      currentOnly: [...selection.cues.currentOnly],
      shared: [...selection.cues.shared],
    },
    tags: {
      incomingOnly: [...selection.tags.incomingOnly],
      currentOnly: [...selection.tags.currentOnly],
      shared: [...selection.tags.shared],
    },
    resources: {
      incomingOnly: [...selection.resources.incomingOnly],
      currentOnly: [...selection.resources.currentOnly],
      shared: [...selection.resources.shared],
    },
  }
}

function areBackupImportSelectionsEqual(left: BackupImportSelection, right: BackupImportSelection) {
  return JSON.stringify(left) === JSON.stringify(right)
}

const defaultTagRenameRule: TagRenameRule = {
  findText: '',
  replaceText: '',
  prefix: '',
  suffix: '',
  trimWhitespace: true,
  collapseSpaces: false,
  caseMode: 'preserve',
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function applyTagRenameRulePreview(name: string, rule: TagRenameRule) {
  let nextName = name

  if (rule.trimWhitespace) {
    nextName = nextName.trim()
  }

  if (rule.collapseSpaces) {
    nextName = nextName.replace(/\s+/g, ' ')
  }

  if (rule.findText) {
    nextName = nextName.split(rule.findText).join(rule.replaceText)
  }

  if (rule.prefix) {
    nextName = `${rule.prefix}${nextName}`
  }

  if (rule.suffix) {
    nextName = `${nextName}${rule.suffix}`
  }

  if (rule.caseMode === 'lower') {
    nextName = nextName.toLowerCase()
  } else if (rule.caseMode === 'upper') {
    nextName = nextName.toUpperCase()
  } else if (rule.caseMode === 'title') {
    nextName = nextName
      .toLowerCase()
      .replace(/(^|[\s\-_]+)(\p{L})/gu, (_, prefix, letter) => `${prefix}${letter.toUpperCase()}`)
  }

  if (rule.trimWhitespace) {
    nextName = nextName.trim()
  }

  if (rule.collapseSpaces) {
    nextName = nextName.replace(/\s+/g, ' ')
  }

  return nextName
}

function toFileUrl(filePath: string) {
  const normalized = filePath.replaceAll('\\', '/')
  return encodeURI(`file:///${normalized}`)
}

function parseTags(value: string) {
  return Array.from(
    new Set(
      value
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
    ),
  )
}

function formatDateTime(value: string, language: AppSettings['language']) {
  return new Intl.DateTimeFormat(language, {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))
}

function formatImportCurrentPath(path: string) {
  const normalized = path.replaceAll('\\', '/')
  const segments = normalized.split('/')
  return segments.slice(-2).join('/')
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unknown error'
}

function getBackupCompatibilityTone(compatibility: BackupCompatibility | null) {
  if (!compatibility) {
    return 'muted'
  }

  if (compatibility.level === 'blocked') {
    return 'danger'
  }

  if (compatibility.level === 'warning') {
    return 'warning'
  }

  return 'ok'
}

function summarizeImportResult(result: ImportResult, format: CopySet) {
  if (
    result.totalDiscovered > 0 ||
    result.failedImports.length > 0 ||
    result.invalidPathCount > 0 ||
    result.skippedDuplicateInputCount > 0
  ) {
    return format.importSummary(
      result.importedCueCount,
      result.importedResourceCount,
      result.reusedResourceCount,
      result.failedImports.length,
      result.skippedDuplicateInputCount,
      result.invalidPathCount,
    )
  }

  return format.importEmpty
}

function pickSelectedId(
  cues: LibraryCueCard[],
  currentId: string | null,
  preferredId?: string | null,
) {
  if (preferredId && cues.some((cue) => cue.id === preferredId)) {
    return preferredId
  }

  if (currentId && cues.some((cue) => cue.id === currentId)) {
    return currentId
  }

  return cues[0]?.id ?? null
}

function sameStringList(left: string[], right: string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

function buildSelectedTagSummaries(cues: LibraryCueCard[]) {
  const tagMap = new Map<string, SelectedTagSummary>()

  for (const cue of cues) {
    for (const tag of cue.tags) {
      const current = tagMap.get(tag.name)
      if (current) {
        current.count += 1
        if (!current.color && tag.color) {
          current.color = tag.color
        }
      } else {
        tagMap.set(tag.name, {
          name: tag.name,
          color: tag.color,
          count: 1,
        })
      }
    }
  }

  const all = Array.from(tagMap.values()).sort((left, right) =>
    left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }),
  )
  const common = all.filter((tag) => tag.count === cues.length)

  return {
    all,
    common,
  }
}

function buildLibraryTagEntries(cues: LibraryCueCard[]) {
  const tagMap = new Map<string, LibraryTagManagerEntry>()

  for (const cue of cues) {
    for (const tag of cue.tags) {
      const current = tagMap.get(tag.id)
      if (current) {
        current.cueCount += 1
        if (new Date(tag.updatedAt).getTime() > new Date(current.updatedAt).getTime()) {
          current.updatedAt = tag.updatedAt
        }
      } else {
        tagMap.set(tag.id, {
          ...tag,
          cueCount: 1,
        })
      }
    }
  }

  return Array.from(tagMap.values())
}

function compareManagedTagNames(left: LibraryTagManagerEntry, right: LibraryTagManagerEntry) {
  return left.name.localeCompare(right.name, undefined, { sensitivity: 'base' })
}

function sortManagedTags(tags: LibraryTagManagerEntry[], mode: TagManagerSortMode) {
  return [...tags].sort((left, right) => {
    if (mode === 'usage') {
      return right.cueCount - left.cueCount || compareManagedTagNames(left, right)
    }

    if (mode === 'recent') {
      return (
        new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime() ||
        right.cueCount - left.cueCount ||
        compareManagedTagNames(left, right)
      )
    }

    return compareManagedTagNames(left, right)
  })
}

function normalizeAcceleratorKey(event: KeyboardEvent) {
  const { key } = event

  if (/^[a-z]$/i.test(key)) {
    return key.toUpperCase()
  }

  if (/^[0-9]$/.test(key)) {
    return key
  }

  const keyMap: Record<string, string> = {
    ' ': 'Space',
    Escape: 'Esc',
    ArrowUp: 'Up',
    ArrowDown: 'Down',
    ArrowLeft: 'Left',
    ArrowRight: 'Right',
    ',': ',',
    '.': '.',
    ';': ';',
    '=': '=',
    '-': '-',
    '/': '/',
    '\\': '\\',
    '`': '`',
    '[': '[',
    ']': ']',
    Tab: 'Tab',
    Enter: 'Enter',
    Backspace: 'Backspace',
    Delete: 'Delete',
    Insert: 'Insert',
    Home: 'Home',
    End: 'End',
    PageUp: 'PageUp',
    PageDown: 'PageDown',
  }

  if (/^F\d{1,2}$/i.test(key)) {
    return key.toUpperCase()
  }

  return keyMap[key] ?? null
}

function buildAccelerator(event: KeyboardEvent) {
  const key = normalizeAcceleratorKey(event)

  if (!key) {
    return null
  }

  const parts = []
  if (event.ctrlKey) parts.push('Ctrl')
  if (event.altKey) parts.push('Alt')
  if (event.shiftKey) parts.push('Shift')
  if (event.metaKey) parts.push('Super')
  parts.push(key)

  return parts.join('+')
}

async function loadOutputDevices(
  language: AppSettings['language'],
): Promise<OutputDeviceOption[]> {
  const t = i18n.getFixedT(language)

  if (!navigator.mediaDevices?.enumerateDevices) {
    return [{ deviceId: '', label: t('systemDefaultOutput') }]
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    stream.getTracks().forEach((track) => track.stop())
  } catch {
    // Device labels may stay generic when access is denied.
  }

  const devices = await navigator.mediaDevices.enumerateDevices()
  const outputs = devices.filter((device) => device.kind === 'audiooutput')

  return [
    { deviceId: '', label: t('systemDefaultOutput') },
    ...outputs.map((device, index) => ({
      deviceId: device.deviceId,
      label: device.label || t('outputDeviceFallback', { index: index + 1 }),
    })),
  ]
}

async function assignSink(audio: HTMLAudioElement, deviceId: string) {
  if (!deviceId) {
    return 'ok'
  }

  const sinkCapable = audio as HTMLAudioElement & {
    setSinkId?: (id: string) => Promise<void>
  }

  if (!sinkCapable.setSinkId) {
    return 'unsupported'
  }

  try {
    await sinkCapable.setSinkId(deviceId)
    return 'ok'
  } catch {
    return 'fallback'
  }
}

function App() {
  const [bootstrap, setBootstrap] = useState<BootstrapSnapshot | null>(null)
  const [library, setLibrary] = useState<LibrarySnapshot>({ cueCards: [] })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search)
  const [tagFilter, setTagFilter] = useState('all')
  const [isDropActive, setIsDropActive] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [failedHotkeys, setFailedHotkeys] = useState<string[]>([])
  const [duplicateHotkeys, setDuplicateHotkeys] = useState<string[]>([])
  const [reservedHotkeys, setReservedHotkeys] = useState<string[]>([])
  const [weakHotkeys, setWeakHotkeys] = useState<string[]>([])
  const [missingFiles, setMissingFiles] = useState<string[]>([])
  const [activePlaybacks, setActivePlaybacks] = useState<ActivePlayback[]>([])
  const [outputDevices, setOutputDevices] = useState<OutputDeviceOption[]>([])
  const [isCleanupDialogOpen, setIsCleanupDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isExportBackupDialogOpen, setIsExportBackupDialogOpen] = useState(false)
  const [isHotkeyRepairDialogOpen, setIsHotkeyRepairDialogOpen] = useState(false)
  const [cardViewMode, setCardViewMode] = useState<CardViewMode>('paged')
  const [pageSize, setPageSize] = useState(24)
  const [currentPage, setCurrentPage] = useState(1)
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null)
  const [importReport, setImportReport] = useState<ImportResult | null>(null)
  const [pendingBackupImport, setPendingBackupImport] = useState<BackupImportResult | null>(null)
  const [exportBackupPassword, setExportBackupPassword] = useState('')
  const [exportBackupPasswordConfirm, setExportBackupPasswordConfirm] = useState('')
  const [importBackupPassword, setImportBackupPassword] = useState('')
  const [isBackupBusy, setIsBackupBusy] = useState(false)
  const [isHotkeyRepairBusy, setIsHotkeyRepairBusy] = useState(false)
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([])
  const [tagManagerSearch, setTagManagerSearch] = useState('')
  const [selectedManagedTagId, setSelectedManagedTagId] = useState<string | null>(null)
  const [selectedManagedTagIds, setSelectedManagedTagIds] = useState<string[]>([])
  const [tagRenameInput, setTagRenameInput] = useState('')
  const [tagRenameRule, setTagRenameRule] = useState<TagRenameRule>(defaultTagRenameRule)
  const [backupTemplateName, setBackupTemplateName] = useState('')
  const [backupDiffSearch, setBackupDiffSearch] = useState('')
  const [expandedBackupDiffSections, setExpandedBackupDiffSections] = useState<Record<string, boolean>>({})
  const [backupImportSelection, setBackupImportSelection] = useState<BackupImportSelection>(emptyBackupImportSelection)
  const [runtimeDiagnostics, setRuntimeDiagnostics] = useState<RuntimeDiagnostics>({
    outputFallbackCount: 0,
    unsupportedOutputCount: 0,
    playbackFailureCount: 0,
    lastPlaybackFailure: null,
  })
  const [gridMetrics, setGridMetrics] = useState<GridMetrics>({
    width: 0,
    height: 0,
    scrollTop: 0,
  })
  const [selectedCueIds, setSelectedCueIds] = useState<string[]>([])
  const [selectedSuggestedHotkeyCueIds, setSelectedSuggestedHotkeyCueIds] = useState<string[]>([])
  const [bulkTagInput, setBulkTagInput] = useState('')
  const [dragCueId, setDragCueId] = useState<string | null>(null)
  const [tagInput, setTagInput] = useState('')
  const [isEditorDrawerOpen, setIsEditorDrawerOpen] = useState(false)
  const [activeWorkspaceSection, setActiveWorkspaceSection] = useState<WorkspaceSection>('library')
  const [isRecordingHotkey, setIsRecordingHotkey] = useState(false)
  const [hotkeyRepairScope, setHotkeyRepairScope] = useState<HotkeyRepairScope>({
    duplicate: true,
    failed: true,
    reserved: true,
    weak: true,
  })
  const audioMapRef = useRef<Map<string, HTMLAudioElement[]>>(new Map())
  const pendingCuePatchesRef = useRef<Map<string, CuePatch>>(new Map())
  const cuePatchTimerRef = useRef<number | null>(null)
  const gridRef = useRef<HTMLElement | null>(null)

  const settings = bootstrap?.settings ?? defaultSettings
  const language = settings.language
  const tagManagerSortMode: TagManagerSortMode = settings.tagManagerSortMode
  const m = useCopy()
  const isFloatingControlMode = window.location.hash === '#floating-control'
  const isHostedByWinUiShell = isHostedByNativeWorkspaceShell()

  const selectedCue = useMemo(
    () => library.cueCards.find((cue) => cue.id === selectedId) ?? null,
    [library.cueCards, selectedId],
  )
  const libraryTags = useMemo(
    () => sortManagedTags(buildLibraryTagEntries(library.cueCards), 'name'),
    [library.cueCards],
  )
  const managedTag = useMemo(
    () => libraryTags.find((tag) => tag.id === selectedManagedTagId) ?? null,
    [libraryTags, selectedManagedTagId],
  )
  const selectedCues = useMemo(
    () => library.cueCards.filter((cue) => selectedCueIds.includes(cue.id)),
    [library.cueCards, selectedCueIds],
  )
  const selectedTagSummaries = useMemo(
    () => (selectedCues.length > 0 ? buildSelectedTagSummaries(selectedCues) : { all: [], common: [] }),
    [selectedCues],
  )
  const stagedBulkTags = useMemo(() => parseTags(bulkTagInput), [bulkTagInput])
  const filteredManagedTags = useMemo(() => {
    const keyword = tagManagerSearch.trim().toLowerCase()
    const visibleTags = keyword
      ? libraryTags.filter((tag) => tag.name.toLowerCase().includes(keyword))
      : libraryTags

    return sortManagedTags(visibleTags, tagManagerSortMode)
  }, [libraryTags, tagManagerSearch, tagManagerSortMode])
  const batchTagRenamePreview = useMemo<TagRenamePreviewEntry[]>(
    () =>
      libraryTags
        .filter((tag) => selectedManagedTagIds.includes(tag.id))
        .map((tag) => ({
          tagId: tag.id,
          previousName: tag.name,
          nextName: applyTagRenameRulePreview(tag.name, tagRenameRule),
        })),
    [libraryTags, selectedManagedTagIds, tagRenameRule],
  )
  const actionableBatchTagRenamePreview = useMemo(
    () =>
      batchTagRenamePreview.filter(
        (entry) => entry.nextName.trim().length > 0 && entry.nextName !== entry.previousName,
      ),
    [batchTagRenamePreview],
  )
  const batchTagRenameWarnings = useMemo(() => {
    const selectedTagIdSet = new Set(selectedManagedTagIds)
    const existingOutsideSelection = new Set(
      libraryTags.filter((tag) => !selectedTagIdSet.has(tag.id)).map((tag) => tag.name),
    )
    const nextNameCounts = new Map<string, number>()
    let emptyCount = 0
    let unchangedCount = 0
    let mergeIntoExistingCount = 0

    for (const entry of batchTagRenamePreview) {
      const normalized = entry.nextName.trim()
      if (!normalized) {
        emptyCount += 1
        continue
      }
      if (normalized === entry.previousName) {
        unchangedCount += 1
      }
      if (existingOutsideSelection.has(normalized)) {
        mergeIntoExistingCount += 1
      }
      nextNameCounts.set(normalized, (nextNameCounts.get(normalized) ?? 0) + 1)
    }

    const mergeWithinSelectionCount = Array.from(nextNameCounts.values()).reduce(
      (total, count) => total + (count > 1 ? count : 0),
      0,
    )

    return {
      emptyCount,
      unchangedCount,
      mergeIntoExistingCount,
      mergeWithinSelectionCount,
    }
  }, [batchTagRenamePreview, libraryTags, selectedManagedTagIds])
  const multiSelectedCount = selectedCueIds.length
  const isLibraryEmpty = library.cueCards.length === 0
  const isImporting = importProgress != null && importProgress.phase !== 'complete'

  useEffect(() => {
    setTagInput(selectedCue ? selectedCue.tags.map((tag) => tag.name).join(', ') : '')
    setIsRecordingHotkey(false)
    setIsDeleteDialogOpen(false)
  }, [selectedCue])

  useEffect(() => {
    if (!selectedCue) {
      setIsEditorDrawerOpen(false)
    }
  }, [selectedCue])

  useEffect(() => {
    setSelectedCueIds((current) => current.filter((cueId) => library.cueCards.some((cue) => cue.id === cueId)))
  }, [library.cueCards])

  useEffect(() => {
    setSelectedManagedTagId((current) => current && libraryTags.some((tag) => tag.id === current) ? current : libraryTags[0]?.id ?? null)
  }, [libraryTags])

  useEffect(() => {
    setSelectedManagedTagIds((current) => current.filter((tagId) => libraryTags.some((tag) => tag.id === tagId)))
  }, [libraryTags])

  useEffect(() => {
    setTagRenameInput(managedTag?.name ?? '')
  }, [managedTag])

  useEffect(() => {
    setCurrentPage(1)
  }, [deferredSearch, pageSize, tagFilter])

  const missingPathSet = useMemo(() => new Set(missingFiles), [missingFiles])
  const duplicateHotkeySet = useMemo(() => new Set(duplicateHotkeys), [duplicateHotkeys])
  const failedHotkeySet = useMemo(() => new Set(failedHotkeys), [failedHotkeys])
  const reservedHotkeySet = useMemo(() => new Set(reservedHotkeys), [reservedHotkeys])
  const weakHotkeySet = useMemo(() => new Set(weakHotkeys), [weakHotkeys])
  const activePlaybackIdSet = useMemo(
    () => new Set(activePlaybacks.map((entry) => entry.id)),
    [activePlaybacks],
  )
  const selectedCueIdSet = useMemo(() => new Set(selectedCueIds), [selectedCueIds])
  const hotkeyAlertCount = useMemo(
    () =>
      new Set([
        ...failedHotkeys,
        ...duplicateHotkeys,
        ...reservedHotkeys,
        ...weakHotkeys,
      ]).size,
    [duplicateHotkeys, failedHotkeys, reservedHotkeys, weakHotkeys],
  )
  const hotkeyRepairCounts = useMemo(
    () => ({
      duplicate: duplicateHotkeys.length,
      failed: failedHotkeys.length,
      reserved: reservedHotkeys.length,
      weak: weakHotkeys.length,
    }),
    [duplicateHotkeys.length, failedHotkeys.length, reservedHotkeys.length, weakHotkeys.length],
  )
  const selectedHotkeyRepairCount = useMemo(
    () =>
      new Set([
        ...(hotkeyRepairScope.duplicate ? duplicateHotkeys : []),
        ...(hotkeyRepairScope.failed ? failedHotkeys : []),
        ...(hotkeyRepairScope.reserved ? reservedHotkeys : []),
        ...(hotkeyRepairScope.weak ? weakHotkeys : []),
      ]).size,
    [duplicateHotkeys, failedHotkeys, hotkeyRepairScope, reservedHotkeys, weakHotkeys],
  )
  const hasPlayback = activePlaybacks.length > 0

  useEffect(() => {
    if (hotkeyAlertCount === 0) {
      setIsHotkeyRepairDialogOpen(false)
    }
  }, [hotkeyAlertCount])

  const allTags = useMemo(
    () => [{ name: 'all', color: null }, ...libraryTags.map((tag) => ({ name: tag.name, color: tag.color }))],
    [libraryTags],
  )

  const filteredCues = useMemo(() => {
    const keyword = deferredSearch.trim().toLowerCase()

    return library.cueCards.filter((cue) => {
      const textHit =
        keyword.length === 0 ||
        cue.name.toLowerCase().includes(keyword) ||
        cue.resource.originalFilename.toLowerCase().includes(keyword) ||
        cue.tags.some((tag) => tag.name.toLowerCase().includes(keyword))

      const tagHit = tagFilter === 'all' || cue.tags.some((tag) => tag.name === tagFilter)

      return textHit && tagHit
    })
  }, [deferredSearch, library.cueCards, tagFilter])

  useEffect(() => {
    setCurrentPage((current) =>
      Math.min(current, Math.max(1, Math.ceil(filteredCues.length / Math.max(1, pageSize)))),
    )
  }, [filteredCues.length, pageSize])

  const tagSuggestions = useMemo(() => {
    if (!selectedCue) {
      return []
    }

    const selectedNames = new Set(selectedCue.tags.map((tag) => tag.name))
    return libraryTags.filter((tag) => !selectedNames.has(tag.name)).slice(0, 8)
  }, [libraryTags, selectedCue])

  const selectedCueHotkeyWarnings = useMemo(() => {
    if (!selectedCue) {
      return []
    }

    const warnings = []

    if (duplicateHotkeys.includes(selectedCue.id)) {
      warnings.push(m.duplicateHotkey)
    }
    if (failedHotkeys.includes(selectedCue.id)) {
      warnings.push(m.rejectedHotkey)
    }
    if (reservedHotkeys.includes(selectedCue.id)) {
      warnings.push(m.reservedHotkey)
    }
    if (weakHotkeys.includes(selectedCue.id)) {
      warnings.push(m.weakHotkey)
    }

    return warnings
  }, [
    duplicateHotkeys,
    failedHotkeys,
    m.duplicateHotkey,
    m.rejectedHotkey,
    m.reservedHotkey,
    m.weakHotkey,
    reservedHotkeys,
    selectedCue,
    weakHotkeys,
  ])

  const retryableImportFailures = useMemo(
    () => importReport?.failedImports.filter((entry) => entry.retryable) ?? [],
    [importReport],
  )
  const suggestedImportedHotkeys = useMemo(
    () => importReport?.suggestedHotkeys ?? [],
    [importReport],
  )
  const selectedSuggestedHotkeys = useMemo(
    () =>
      suggestedImportedHotkeys.filter((entry) => selectedSuggestedHotkeyCueIds.includes(entry.cueId)),
    [selectedSuggestedHotkeyCueIds, suggestedImportedHotkeys],
  )
  const backupImportSelectionTemplates = settings.backupImportSelectionTemplates ?? []
  const backupRequiresPassword = Boolean(pendingBackupImport?.manifest?.encryption?.enabled)
  const exportPasswordMismatch =
    exportBackupPassword.length > 0 && exportBackupPassword !== exportBackupPasswordConfirm

  useEffect(() => {
    setSelectedSuggestedHotkeyCueIds(suggestedImportedHotkeys.map((entry) => entry.cueId))
  }, [suggestedImportedHotkeys])

  useEffect(() => {
    setExpandedBackupDiffSections({})
    setBackupDiffSearch('')
    setBackupImportSelection(emptyBackupImportSelection)
    setBackupTemplateName('')
  }, [pendingBackupImport?.sourcePath])

  const runtimeIssueCount =
    runtimeDiagnostics.outputFallbackCount +
    runtimeDiagnostics.unsupportedOutputCount +
    runtimeDiagnostics.playbackFailureCount
  const currentOutputDeviceLabel =
    outputDevices.find((device) => device.deviceId === settings.selectedOutputDeviceId)?.label ??
    m.systemDefaultOutput
  const latestPlayback = activePlaybacks
    .slice()
    .sort((left, right) => right.startedAt - left.startedAt)[0] ?? null
  const hasPlayingPlayback = activePlaybacks.some((entry) => !entry.paused)
  const isLibraryWorkspace = activeWorkspaceSection === 'library'

  const importProgressRatio = useMemo(() => {
    if (!importProgress || importProgress.total <= 0) {
      return 0
    }

    return clamp(importProgress.completed / importProgress.total, 0, 1)
  }, [importProgress])

  const getImportFailureLabel = useCallback(
    (code: ImportFailureCode) => {
      switch (code) {
        case 'path_missing':
          return m.importFailurePathMissing
        case 'permission_denied':
          return m.importFailurePermissionDenied
        case 'unsupported_type':
          return m.importFailureUnsupportedType
        case 'directory_scan_failed':
          return m.importFailureDirectoryScanFailed
        case 'hash_failed':
          return m.importFailureHashFailed
        case 'metadata_read_failed':
          return m.importFailureMetadataReadFailed
        case 'library_copy_failed':
          return m.importFailureLibraryCopyFailed
        case 'database_write_failed':
          return m.importFailureDatabaseWriteFailed
        default:
          return m.importFailureUnknown
      }
    },
    [
      m.importFailureDatabaseWriteFailed,
      m.importFailureDirectoryScanFailed,
      m.importFailureHashFailed,
      m.importFailureLibraryCopyFailed,
      m.importFailureMetadataReadFailed,
      m.importFailurePathMissing,
      m.importFailurePermissionDenied,
      m.importFailureUnknown,
      m.importFailureUnsupportedType,
    ],
  )

  const getBackupCompatibilityReasonLabel = useCallback(
    (code: BackupCompatibilityReasonCode) => {
      switch (code) {
        case 'backup_format_too_new':
          return m.backupCompatibilityFormatTooNew
        case 'backup_format_legacy':
          return m.backupCompatibilityFormatLegacy
        case 'schema_too_new':
          return m.backupCompatibilitySchemaTooNew
        case 'schema_legacy':
          return m.backupCompatibilitySchemaLegacy
        case 'storage_mode_changed':
          return m.backupCompatibilityStorageModeChanged
        default:
          return m.backupCompatibilityUnknown
      }
    },
    [
      m.backupCompatibilityFormatLegacy,
      m.backupCompatibilityFormatTooNew,
      m.backupCompatibilitySchemaLegacy,
      m.backupCompatibilitySchemaTooNew,
      m.backupCompatibilityStorageModeChanged,
      m.backupCompatibilityUnknown,
    ],
  )

  const getBackupIntegrityReasonLabel = useCallback(
    (code: BackupIntegrityReasonCode) => {
      switch (code) {
        case 'package_corrupt':
          return m.backupIntegrityPackageCorrupt
        case 'database_checksum_mismatch':
          return m.backupIntegrityDatabaseMismatch
        case 'library_checksum_mismatch':
          return m.backupIntegrityLibraryMismatch
        case 'waveform_checksum_mismatch':
          return m.backupIntegrityWaveformMismatch
        case 'trash_checksum_mismatch':
          return m.backupIntegrityTrashMismatch
        case 'password_required':
          return m.backupIntegrityPasswordRequired
        case 'password_or_signature_invalid':
          return m.backupIntegrityPasswordOrSignatureInvalid
        case 'encrypted_payload_corrupt':
          return m.backupIntegrityEncryptedPayloadCorrupt
        default:
          return m.backupIntegrityUnknown
      }
    },
    [
      m.backupIntegrityDatabaseMismatch,
      m.backupIntegrityEncryptedPayloadCorrupt,
      m.backupIntegrityLibraryMismatch,
      m.backupIntegrityPackageCorrupt,
      m.backupIntegrityPasswordOrSignatureInvalid,
      m.backupIntegrityPasswordRequired,
      m.backupIntegrityTrashMismatch,
      m.backupIntegrityUnknown,
      m.backupIntegrityWaveformMismatch,
    ],
  )

  const importProgressLabel = useMemo(() => {
    if (!importProgress) {
      return ''
    }

    if (importProgress.phase === 'scanning') {
      return m.importScanning
    }

    return m.importProgressSummary(
      importProgress.completed,
      importProgress.total,
      importProgress.importedCueCount,
      importProgress.failedCount,
    )
  }, [importProgress, m])

  const pageCount = useMemo(
    () => Math.max(1, Math.ceil(filteredCues.length / Math.max(1, pageSize))),
    [filteredCues.length, pageSize],
  )

  const pagedCues = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredCues.slice(start, start + pageSize)
  }, [currentPage, filteredCues, pageSize])

  const virtualLayout = useMemo(() => {
    const gap = 14
    const minCardWidth = 220
    const rowHeight = 208
    const columns = Math.max(1, Math.floor((Math.max(gridMetrics.width, minCardWidth) + gap) / (minCardWidth + gap)))
    const totalRows = Math.ceil(filteredCues.length / columns)
    const visibleRows = Math.max(1, Math.ceil(Math.max(gridMetrics.height, rowHeight) / rowHeight))
    const startRow = Math.max(0, Math.floor(gridMetrics.scrollTop / rowHeight) - 2)
    const endRow = Math.min(totalRows, startRow + visibleRows + 4)
    const rows = []

    for (let rowIndex = startRow; rowIndex < endRow; rowIndex += 1) {
      rows.push({
        rowIndex,
        cues: filteredCues.slice(rowIndex * columns, rowIndex * columns + columns),
      })
    }

    return {
      columns,
      rowHeight,
      totalRows,
      rows,
      totalHeight: totalRows * rowHeight,
    }
  }, [filteredCues, gridMetrics.height, gridMetrics.scrollTop, gridMetrics.width])

  const displayedCues = cardViewMode === 'paged' ? pagedCues : filteredCues
  const displayRange = useMemo(() => {
    if (filteredCues.length === 0) {
      return { start: 0, end: 0 }
    }

    if (cardViewMode === 'paged') {
      const start = (currentPage - 1) * pageSize + 1
      return {
        start,
        end: Math.min(filteredCues.length, start + pagedCues.length - 1),
      }
    }

    const firstRow = virtualLayout.rows[0] ?? null
    const lastRow =
      virtualLayout.rows.length > 0
        ? virtualLayout.rows[virtualLayout.rows.length - 1]
        : null
    const start = firstRow ? firstRow.rowIndex * virtualLayout.columns + 1 : 0
    const end = lastRow
      ? Math.min(
          filteredCues.length,
          lastRow.rowIndex * virtualLayout.columns + lastRow.cues.length,
        )
      : 0

    return { start, end }
  }, [cardViewMode, currentPage, filteredCues.length, pageSize, pagedCues.length, virtualLayout.columns, virtualLayout.rows])

  const syncShortcutDiagnostics = useCallback((diagnostics: ShortcutDiagnostics) => {
    setFailedHotkeys(diagnostics.failedCueIds)
    setDuplicateHotkeys(diagnostics.duplicateCueIds)
    setReservedHotkeys(diagnostics.reservedCueIds)
    setWeakHotkeys(diagnostics.weakCueIds)
  }, [])

  const refreshMissingFiles = useCallback(async (cueCards: LibraryCueCard[]) => {
    if (cueCards.length === 0) {
      setMissingFiles([])
      return
    }

      const result = await workspaceHost.checkFilesExist(
      cueCards.map((cue) => cue.resource.absolutePath),
    )
    setMissingFiles(result.missing)
  }, [])

  const refreshSnapshots = useCallback(
    async (preferredId?: string | null) => {
      const [nextBootstrap, nextLibrary, nextHistory, nextDiagnostics] = await Promise.all([
      workspaceHost.getBootstrapSnapshot(),
      workspaceHost.getLibrarySnapshot(),
      workspaceHost.listHistory(),
      workspaceHost.getShortcutDiagnostics(),
      ])

      startTransition(() => {
        setBootstrap(nextBootstrap)
        setLibrary(nextLibrary)
        setHistoryEntries(nextHistory)
        setSelectedId((current) => pickSelectedId(nextLibrary.cueCards, current, preferredId))
      })
      syncShortcutDiagnostics(nextDiagnostics)
      await refreshMissingFiles(nextLibrary.cueCards)
    },
    [refreshMissingFiles, syncShortcutDiagnostics],
  )

  const stopAllPlayback = useCallback(
    (message: string = m.playbackStopped) => {
      for (const audios of audioMapRef.current.values()) {
        for (const audio of audios) {
          audio.pause()
          audio.currentTime = 0
          audio.src = ''
        }
      }

      audioMapRef.current.clear()
      setActivePlaybacks([])
      setStatusMessage(message)
    },
    [m.playbackStopped],
  )

  const togglePlaybackPauseState = useCallback(async () => {
    if (activePlaybacks.length === 0) {
      return
    }

    if (hasPlayingPlayback) {
      for (const audios of audioMapRef.current.values()) {
        for (const audio of audios) {
          if (!audio.paused) {
            audio.pause()
          }
        }
      }
      setStatusMessage(m.allPaused)
      return
    }

    for (const audios of audioMapRef.current.values()) {
      for (const audio of audios) {
        if (audio.paused) {
          try {
            await audio.play()
          } catch {
            // Keep other active sources running when one element fails to resume.
          }
        }
      }
    }

    setActivePlaybacks((current) => current.map((entry) => ({ ...entry, paused: false })))
    setStatusMessage(m.allResumed)
  }, [activePlaybacks.length, hasPlayingPlayback, m.allPaused, m.allResumed])

  const stopCuePlayback = useCallback(
    (cueId: string, message: string = m.playbackStopped) => {
      const audios = audioMapRef.current.get(cueId) ?? []
      for (const audio of audios) {
        audio.pause()
        audio.currentTime = 0
        audio.src = ''
      }

      audioMapRef.current.delete(cueId)
      setActivePlaybacks((current) => current.filter((entry) => entry.id !== cueId))
      setStatusMessage(message)
    },
    [m.playbackStopped],
  )

  const removePlaybackEntry = useCallback((cueId: string, audio: HTMLAudioElement) => {
    const currentEntries = audioMapRef.current.get(cueId) ?? []
    const nextEntries = currentEntries.filter((entry) => entry !== audio)

    if (nextEntries.length === 0) {
      audioMapRef.current.delete(cueId)
    } else {
      audioMapRef.current.set(cueId, nextEntries)
    }

    setActivePlaybacks((current) =>
      current.filter(
        (entry) => !(entry.id === cueId && entry.startedAt === Number(audio.dataset.startedAt)),
      ),
    )
  }, [])

  const playCue = useCallback(
    async (cue: LibraryCueCard) => {
      const absolutePath = cue.resource.absolutePath

      if (missingPathSet.has(absolutePath)) {
        setStatusMessage(m.playMissing(cue.name))
        return
      }

      if (!settings.allowOverlap || settings.stopOthersOnTrigger) {
        stopAllPlayback(m.queueCleared(cue.name))
      }

      const audio = new Audio(toFileUrl(absolutePath))
      const startedAt = Date.now()
      const startSeconds = cue.trimStartMs / 1000
      const endSeconds = cue.trimEndMs != null ? cue.trimEndMs / 1000 : null
      audio.dataset.startedAt = String(startedAt)
      audio.volume = clamp(settings.globalVolume * cue.volume, 0, 1)
      audio.playbackRate = cue.playbackRate

      const finishPlayback = () => {
        audio.pause()
        audio.currentTime = 0
        removePlaybackEntry(cue.id, audio)
      }

      audio.onpause = () => {
        setActivePlaybacks((current) =>
          current.map((entry) =>
            entry.id === cue.id && entry.startedAt === startedAt
              ? { ...entry, paused: audio.paused && audio.currentTime > 0 }
              : entry,
          ),
        )
      }
      audio.onerror = () => {
        finishPlayback()
        setStatusMessage(m.playFileMissing(cue.name))
      }
      audio.onended = finishPlayback
      audio.ontimeupdate = () => {
        if (endSeconds != null && audio.currentTime >= endSeconds - 0.02) {
          finishPlayback()
        }
      }

      try {
        await new Promise<void>((resolve, reject) => {
          audio.addEventListener('loadedmetadata', () => resolve(), { once: true })
          audio.addEventListener('error', () => reject(new Error('metadata failed')), { once: true })
        })

        audio.currentTime = startSeconds
        const sinkResult = await assignSink(audio, settings.selectedOutputDeviceId)
        if (settings.selectedOutputDeviceId && sinkResult !== 'ok') {
          setRuntimeDiagnostics((current) => ({
            outputFallbackCount:
              sinkResult === 'fallback' ? current.outputFallbackCount + 1 : current.outputFallbackCount,
            unsupportedOutputCount:
              sinkResult === 'unsupported'
                ? current.unsupportedOutputCount + 1
                : current.unsupportedOutputCount,
            playbackFailureCount: current.playbackFailureCount,
            lastPlaybackFailure: current.lastPlaybackFailure,
          }))
          setStatusMessage(m.selectedOutputFallback)
        }

        await audio.play()
        const list = audioMapRef.current.get(cue.id) ?? []
        audioMapRef.current.set(cue.id, [...list, audio])
        setActivePlaybacks((current) => [
          ...current,
          { id: cue.id, name: cue.name, startedAt, paused: false },
        ])
        setSelectedId(cue.id)
        setStatusMessage(m.playing(cue.name))
      } catch {
        finishPlayback()
        setRuntimeDiagnostics((current) => ({
          outputFallbackCount: current.outputFallbackCount,
          unsupportedOutputCount: current.unsupportedOutputCount,
          playbackFailureCount: current.playbackFailureCount + 1,
          lastPlaybackFailure: cue.name,
        }))
        setStatusMessage(m.playDeviceFailed(cue.name))
      }
    },
    [
      m,
      missingPathSet,
      removePlaybackEntry,
      settings.allowOverlap,
      settings.globalVolume,
      settings.selectedOutputDeviceId,
      settings.stopOthersOnTrigger,
      stopAllPlayback,
    ],
  )

  useEffect(() => {
    void i18n.changeLanguage(language)
  }, [language])

  useEffect(() => {
    void refreshSnapshots()
    return () => {
      stopAllPlayback()
    }
  }, [refreshSnapshots, stopAllPlayback])

  useEffect(() => {
    setStatusMessage((current) => current || m.ready)
  }, [m.ready])

  useEffect(() => {
    let ignore = false
    void loadOutputDevices(language).then((devices) => {
      if (!ignore) {
        setOutputDevices(devices)
      }
    })
    return () => {
      ignore = true
    }
  }, [language])

  useEffect(() => {
    setRuntimeDiagnostics({
      outputFallbackCount: 0,
      unsupportedOutputCount: 0,
      playbackFailureCount: 0,
      lastPlaybackFailure: null,
    })
  }, [settings.selectedOutputDeviceId])

  useEffect(() => {
    const unsubscribe = workspaceHost.onShortcutTriggered((cueId) => {
      const cue = library.cueCards.find((item) => item.id === cueId)
      if (cue) {
        void playCue(cue)
      }
    })
    return unsubscribe
  }, [library.cueCards, playCue])

  useEffect(() => {
    return workspaceHost.onImportProgress((progress) => {
      setImportProgress(progress)
    })
  }, [])

  useEffect(() => {
    return subscribeWorkspaceHostCommands((command) => {
      if (command.command === 'set-search') {
        setSearch(command.payload.search)
        return
      }

      if (command.command === 'set-active-section') {
        activateWorkspaceSection(command.payload.section)
        return
      }

      if (command.command === 'set-output-device') {
        void updateSettings({ selectedOutputDeviceId: command.payload.deviceId })
        return
      }

      if (command.command === 'toggle-global-shortcuts') {
        void updateSettings({ globalShortcutsEnabled: !settings.globalShortcutsEnabled })
        return
      }

      if (command.command === 'toggle-playback-pause') {
        void togglePlaybackPauseState()
        return
      }

      if (command.command === 'stop-all-playback') {
        stopAllPlayback(m.allPlaybackStopped)
        return
      }

      if (command.command === 'set-global-volume') {
        void updateSettings({ globalVolume: command.payload.value })
      }
    })
  }, [
    activateWorkspaceSection,
    m.allPlaybackStopped,
    settings.globalShortcutsEnabled,
    stopAllPlayback,
    togglePlaybackPauseState,
    updateSettings,
  ])

  useEffect(() => {
    const element = gridRef.current
    if (!element) {
      return
    }

    const updateMetrics = () => {
      setGridMetrics({
        width: element.clientWidth,
        height: element.clientHeight,
        scrollTop: element.scrollTop,
      })
    }

    updateMetrics()

    const observer = new ResizeObserver(() => updateMetrics())
    observer.observe(element)
    element.addEventListener('scroll', updateMetrics, { passive: true })

    return () => {
      observer.disconnect()
      element.removeEventListener('scroll', updateMetrics)
    }
  }, [cardViewMode, displayedCues.length])

  useEffect(() => {
    return () => {
      if (cuePatchTimerRef.current != null) {
        window.clearTimeout(cuePatchTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    for (const cue of library.cueCards) {
      const activeEntries = audioMapRef.current.get(cue.id) ?? []
      activeEntries.forEach((audio) => {
        audio.volume = clamp(settings.globalVolume * cue.volume, 0, 1)
        audio.playbackRate = cue.playbackRate
      })
    }
  }, [library.cueCards, settings.globalVolume])

  const updateCueLocal = useCallback((cueId: string, patch: CuePatch) => {
    setLibrary((current) => ({
      cueCards: current.cueCards.map((cue) =>
        cue.id === cueId
          ? {
              ...cue,
              ...patch,
            }
          : cue,
      ),
    }))
  }, [])

  const flushCuePatches = useCallback(async () => {
    const entries = Array.from(pendingCuePatchesRef.current.entries())
    pendingCuePatchesRef.current.clear()

    for (const [cueId, patch] of entries) {
      const diagnostics = await workspaceHost.updateCue(cueId, patch)
      syncShortcutDiagnostics(diagnostics)
    }
  }, [syncShortcutDiagnostics])

  const queueCuePatch = useCallback(
    (cueId: string, patch: CuePatch) => {
      updateCueLocal(cueId, patch)
      const existing = pendingCuePatchesRef.current.get(cueId) ?? {}
      pendingCuePatchesRef.current.set(cueId, { ...existing, ...patch })

      if (cuePatchTimerRef.current != null) {
        window.clearTimeout(cuePatchTimerRef.current)
      }

      cuePatchTimerRef.current = window.setTimeout(() => {
        void flushCuePatches()
      }, 220)
    },
    [flushCuePatches, updateCueLocal],
  )

  function toggleCueSelection(cueId: string, append: boolean) {
    setSelectedId(cueId)

    if (!append) {
      setSelectedCueIds([cueId])
      return
    }

    setSelectedCueIds((current) =>
      current.includes(cueId) ? current.filter((id) => id !== cueId) : [...current, cueId],
    )
  }

  function handleCueCardPress(cue: LibraryCueCard, appendSelection: boolean) {
    toggleCueSelection(cue.id, appendSelection)

    if (!appendSelection) {
      void playCue(cue)
    }
  }

  function openCueEditor(cue: LibraryCueCard) {
    setSelectedId(cue.id)
    setSelectedCueIds([cue.id])
    setIsEditorDrawerOpen(true)
  }

  function activateWorkspaceSection(section: WorkspaceSection) {
    setIsEditorDrawerOpen(false)
    setActiveWorkspaceSection(section)
  }

  async function applyBulkTagNames(tagNames: string[], mode: BatchTagMode, options?: { clearInput?: boolean }) {
    if (selectedCueIds.length === 0) {
      return
    }

      const snapshot = await workspaceHost.batchCueTags(selectedCueIds, tagNames, mode)
    setLibrary(snapshot)
    setSelectedId((current) => pickSelectedId(snapshot.cueCards, current, selectedId))

    if (options?.clearInput !== false) {
      setBulkTagInput('')
    }
  }

  async function applyBulkTags(mode: BatchTagMode) {
    await applyBulkTagNames(parseTags(bulkTagInput), mode)
  }

  function toggleBulkDraftTag(tagName: string) {
    const current = parseTags(bulkTagInput)
    const next = current.includes(tagName)
      ? current.filter((tag) => tag !== tagName)
      : [...current, tagName]
    setBulkTagInput(next.join(', '))
  }

  async function clearBulkTags() {
    await applyBulkTagNames([], 'replace')
  }

  async function removeBulkTag(tagName: string) {
    await applyBulkTagNames([tagName], 'remove', { clearInput: false })
  }

  async function reorderCues(fromCueId: string, toCueId: string) {
    if (fromCueId === toCueId) {
      return
    }

    const nextCues = [...library.cueCards]
    const fromIndex = nextCues.findIndex((cue) => cue.id === fromCueId)
    const toIndex = nextCues.findIndex((cue) => cue.id === toCueId)

    if (fromIndex < 0 || toIndex < 0) {
      return
    }

    const [movedCue] = nextCues.splice(fromIndex, 1)
    nextCues.splice(toIndex, 0, movedCue)

    const reorderedSnapshot = {
      cueCards: nextCues.map((cue, index) => ({
        ...cue,
        sortOrder: index,
      })),
    }

    setLibrary(reorderedSnapshot)
      const persistedSnapshot = await workspaceHost.reorderCues(nextCues.map((cue) => cue.id))
    setLibrary(persistedSnapshot)
  }

  useEffect(() => {
    if (!isRecordingHotkey || !selectedCue) {
      return
    }

    const onKeyDown = (event: KeyboardEvent) => {
      event.preventDefault()
      event.stopPropagation()

      if (!event.ctrlKey && !event.altKey && !event.shiftKey && !event.metaKey) {
        if (event.key === 'Escape') {
          setIsRecordingHotkey(false)
          return
        }
        if (event.key === 'Backspace' || event.key === 'Delete') {
          queueCuePatch(selectedCue.id, { hotkey: '' })
          setIsRecordingHotkey(false)
          return
        }
      }

      const accelerator = buildAccelerator(event)
      if (!accelerator) {
        return
      }

      queueCuePatch(selectedCue.id, { hotkey: accelerator })
      setIsRecordingHotkey(false)
    }

    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [isRecordingHotkey, queueCuePatch, selectedCue])

  async function handleImport(paths: string[]) {
    if (isImporting) return

    const cleanPaths = paths.filter(Boolean)
    if (cleanPaths.length === 0) return

    setImportProgress({
      phase: 'scanning',
      completed: 0,
      total: 0,
      importedCueCount: 0,
      failedCount: 0,
      currentPath: null,
    })

    try {
      const result = await workspaceHost.importAudioPaths(cleanPaths)
      setImportReport(result)
      syncShortcutDiagnostics(result)
      await refreshSnapshots()
      setStatusMessage(summarizeImportResult(result, m))
    } finally {
      window.setTimeout(() => setImportProgress(null), 450)
    }
  }

  async function handleOpenFiles() {
    if (isImporting) return

      const paths = await workspaceHost.pickAudioFiles()
    await handleImport(paths)
  }

  async function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setIsDropActive(false)

    if (isImporting) return

    const paths = Array.from(event.dataTransfer.files)
        .map((file) => workspaceHost.getPathForFile(file))
      .filter(Boolean)
    await handleImport(paths)
  }

  async function updateSettings(patch: Partial<AppSettings>) {
    const optimistic = { ...settings, ...patch }
    setBootstrap((current) => (current ? { ...current, settings: optimistic } : current))

      const result = await workspaceHost.updateSettings(patch)
    syncShortcutDiagnostics(result)
    setBootstrap((current) => (current ? { ...current, settings: result.settings } : current))
  }

  async function commitTagInput() {
    if (!selectedCue) return

    const nextTags = parseTags(tagInput)
    const currentTags = selectedCue.tags.map((tag) => tag.name)

    if (sameStringList(nextTags, currentTags)) {
      return
    }

      const snapshot = await workspaceHost.setCueTags(selectedCue.id, nextTags)
    setLibrary(snapshot)
    setSelectedId((current) => pickSelectedId(snapshot.cueCards, current, selectedCue.id))
  }

  async function appendTag(tagName: string) {
    if (!selectedCue) return

    const nextTags = Array.from(new Set([...selectedCue.tags.map((tag) => tag.name), tagName]))
      const snapshot = await workspaceHost.setCueTags(selectedCue.id, nextTags)
    setLibrary(snapshot)
    setSelectedId(selectedCue.id)
  }

  async function changeTagColor(tag: LibraryTag, color: string | null) {
      const snapshot = await workspaceHost.updateTagColor(tag.id, color)
    setLibrary(snapshot)
    setSelectedId((current) => pickSelectedId(snapshot.cueCards, current, selectedCue?.id ?? null))
  }

  async function renameManagedTag() {
    if (!managedTag) {
      return
    }

    const nextName = tagRenameInput.trim()
    if (!nextName || nextName === managedTag.name) {
      return
    }

      const snapshot = await workspaceHost.renameTag(managedTag.id, nextName)
      const nextHistory = await workspaceHost.listHistory()
    setLibrary(snapshot)
    setHistoryEntries(nextHistory)
    setSelectedId((current) => pickSelectedId(snapshot.cueCards, current, selectedCue?.id ?? null))
    setStatusMessage(m.tagManagerRenameDone(managedTag.name, nextName))
  }

  async function deleteManagedTag(tag: LibraryTagManagerEntry) {
    const confirmed = window.confirm(m.tagManagerDeleteConfirm(tag.name, tag.cueCount))

    if (!confirmed) {
      return
    }

      const snapshot = await workspaceHost.deleteTag(tag.id)
      const nextHistory = await workspaceHost.listHistory()
    setLibrary(snapshot)
    setHistoryEntries(nextHistory)
    setSelectedId((current) => pickSelectedId(snapshot.cueCards, current, selectedCue?.id ?? null))
    setStatusMessage(m.tagManagerDeleteDone(tag.name))
  }

  function toggleManagedTagSelection(tagId: string) {
    setSelectedManagedTagIds((current) =>
      current.includes(tagId) ? current.filter((id) => id !== tagId) : [...current, tagId],
    )
  }

  function selectAllFilteredTags() {
    setSelectedManagedTagIds(filteredManagedTags.map((tag) => tag.id))
  }

  function clearManagedTagSelection() {
    setSelectedManagedTagIds([])
  }

  async function mergeSelectedManagedTags() {
    const selectedIds = Array.from(new Set(selectedManagedTagIds))
    const targetName = tagRenameInput.trim()

    if (selectedIds.length === 0 || !targetName) {
      return
    }

      const snapshot = await workspaceHost.batchMergeTags(selectedIds, targetName)
      const nextHistory = await workspaceHost.listHistory()
    setLibrary(snapshot)
    setHistoryEntries(nextHistory)
    setSelectedManagedTagIds([])
    setSelectedId((current) => pickSelectedId(snapshot.cueCards, current, selectedCue?.id ?? null))
    setStatusMessage(m.tagManagerBatchMergeDone(selectedIds.length, targetName))
  }

  async function batchColorManagedTags(color: string | null) {
    const selectedIds = Array.from(new Set(selectedManagedTagIds))

    if (selectedIds.length === 0) {
      return
    }

      const snapshot = await workspaceHost.batchUpdateTagColor(selectedIds, color)
    setLibrary(snapshot)
    setSelectedId((current) => pickSelectedId(snapshot.cueCards, current, selectedCue?.id ?? null))
    setStatusMessage(
      color ? m.tagManagerBatchColorDone(selectedIds.length) : m.tagManagerBatchColorResetDone(selectedIds.length),
    )
  }

  async function deleteSelectedManagedTags() {
    const selectedIds = Array.from(new Set(selectedManagedTagIds))

    if (selectedIds.length === 0) {
      return
    }

    const confirmed = window.confirm(m.tagManagerBatchDeleteConfirm(selectedIds.length))

    if (!confirmed) {
      return
    }

      const snapshot = await workspaceHost.batchDeleteTags(selectedIds)
      const nextHistory = await workspaceHost.listHistory()
    setLibrary(snapshot)
    setHistoryEntries(nextHistory)
    setSelectedManagedTagIds([])
    setSelectedId((current) => pickSelectedId(snapshot.cueCards, current, selectedCue?.id ?? null))
    setStatusMessage(m.tagManagerBatchDeleteDone(selectedIds.length))
  }

  function toggleBackupDiffSelection(section: BackupDiffSectionView['key'], bucket: BackupDiffBucketKey, name: string) {
    setBackupImportSelection((current) => {
      const currentValues = current[section][bucket]
      const nextValues = currentValues.includes(name)
        ? currentValues.filter((value) => value !== name)
        : [...currentValues, name]

      return {
        ...current,
        [section]: {
          ...current[section],
          [bucket]: nextValues,
        },
      }
    })
  }

  function isBackupDiffSelected(section: BackupDiffSectionView['key'], bucket: BackupDiffBucketKey, name: string) {
    return backupImportSelection[section][bucket].includes(name)
  }

  function clearBackupImportSelection() {
    setBackupImportSelection(emptyBackupImportSelection)
  }

  async function saveBackupImportSelectionTemplate() {
    const name = backupTemplateName.trim()

    if (!name || selectedBackupDiffItemCount === 0) {
      return
    }

    const now = new Date().toISOString()
    const existing = backupImportSelectionTemplates.find(
      (template) => template.name.toLocaleLowerCase() === name.toLocaleLowerCase(),
    )
    const nextTemplate = {
      id: existing?.id ?? globalThis.crypto?.randomUUID?.() ?? `backup-template-${Date.now()}`,
      name,
      selection: cloneBackupImportSelection(backupImportSelection),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    }
    const nextTemplates = existing
      ? backupImportSelectionTemplates.map((template) => (template.id === existing.id ? nextTemplate : template))
      : [...backupImportSelectionTemplates, nextTemplate]

    await updateSettings({ backupImportSelectionTemplates: nextTemplates })
    setBackupTemplateName(name)
    setStatusMessage(m.backupDiffTemplateSaved(name))
  }

  function applyBackupImportSelectionTemplate(template: BackupImportSelectionTemplate) {
    setBackupImportSelection(cloneBackupImportSelection(template.selection))
    setBackupTemplateName(template.name)
    setStatusMessage(m.backupDiffTemplateApplied(template.name))
  }

  async function deleteBackupImportSelectionTemplate(templateId: string) {
    const template = backupImportSelectionTemplates.find((entry) => entry.id === templateId)

    if (!template) {
      return
    }

    await updateSettings({
      backupImportSelectionTemplates: backupImportSelectionTemplates.filter((entry) => entry.id !== templateId),
    })

    if (backupTemplateName.trim().toLocaleLowerCase() === template.name.toLocaleLowerCase()) {
      setBackupTemplateName('')
    }

    setStatusMessage(m.backupDiffTemplateDeleted(template.name))
  }

  async function applyBatchRenameRule() {
    const selectedIds = Array.from(new Set(selectedManagedTagIds))

    if (selectedIds.length === 0 || actionableBatchTagRenamePreview.length === 0) {
      return
    }

      const result: BatchTagRenameResult = await workspaceHost.batchRenameTagsByRule(selectedIds, tagRenameRule)
      const nextHistory = await workspaceHost.listHistory()
    setLibrary(result.snapshot)
    setHistoryEntries(nextHistory)
    setSelectedManagedTagIds([])
    setTagRenameRule(defaultTagRenameRule)
    setSelectedId((current) => pickSelectedId(result.snapshot.cueCards, current, selectedCue?.id ?? null))
    setStatusMessage(m.tagManagerBatchRenameDone(result.renamedCount))
  }

  function buildFilteredBackupDiffSections() {
    if (!pendingBackupImport?.manifest || !pendingBackupImport.diffSummary?.available) {
      return null
    }

    const keyword = backupDiffSearch.trim()
    const keywordLower = keyword.toLowerCase()
    const filterItems = (values: string[]) =>
      keywordLower ? values.filter((value) => value.toLowerCase().includes(keywordLower)) : values

    const sectionSeeds = [
      { key: 'cues', title: m.backupDiffSectionCues, group: pendingBackupImport.diffSummary.cues },
      { key: 'tags', title: m.backupDiffSectionTags, group: pendingBackupImport.diffSummary.tags },
      { key: 'resources', title: m.backupDiffSectionResources, group: pendingBackupImport.diffSummary.resources },
    ] as const

    return {
      keyword,
      sections: sectionSeeds.map((section): BackupDiffSectionView => {
      if (!section.group) {
        return {
          ...section,
          hasMatches: false,
          incomingItems: [],
          currentOnlyItems: [],
          sharedItems: [],
        }
      }

      const incomingItems = filterItems(section.group.incomingItems)
      const currentOnlyItems = filterItems(section.group.currentOnlyItems)
      const sharedItems = filterItems(section.group.sharedItems)
      const hasMatches =
        incomingItems.length > 0 || currentOnlyItems.length > 0 || sharedItems.length > 0 || keyword.length === 0

      return {
        ...section,
        incomingItems,
        currentOnlyItems,
        sharedItems,
        hasMatches,
      }
      }),
    }
  }

  function buildBackupDiffSummaryView(sections: BackupDiffSectionView[], keyword: string): BackupDiffSummaryView {
    const populatedSections = sections
      .filter((section): section is BackupDiffSectionView & { group: BackupDiffGroup } => Boolean(section.group))
      .map((section) => ({
        key: section.key,
        title: section.title,
        hasMatches: section.hasMatches,
        current: section.currentOnlyItems.length + section.sharedItems.length,
        backup: section.incomingItems.length + section.sharedItems.length,
        incomingOnly: section.incomingItems.length,
        currentOnly: section.currentOnlyItems.length,
        shared: section.sharedItems.length,
      }))

    return {
      keyword,
      totalSectionCount: populatedSections.length,
      matchedSectionCount: populatedSections.filter((section) => section.hasMatches).length,
      totals: populatedSections.reduce(
        (summary, section) => ({
          current: summary.current + section.current,
          backup: summary.backup + section.backup,
          incomingOnly: summary.incomingOnly + section.incomingOnly,
          currentOnly: summary.currentOnly + section.currentOnly,
          shared: summary.shared + section.shared,
        }),
        {
          current: 0,
          backup: 0,
          incomingOnly: 0,
          currentOnly: 0,
          shared: 0,
        },
      ),
      sections: populatedSections,
    }
  }

  function buildBackupDiffReport(format: BackupDiffExportFormat) {
    const exportState = buildFilteredBackupDiffSections()

    if (!exportState || !pendingBackupImport?.manifest) {
      return null
    }

    const summary = buildBackupDiffSummaryView(exportState.sections, exportState.keyword)

    if (format === 'json') {
      return JSON.stringify(
        {
          sourcePath: pendingBackupImport.sourcePath,
          backupVersion: pendingBackupImport.manifest.version,
          backupSchemaVersion: pendingBackupImport.manifest.schemaVersion,
          currentSchemaVersion: bootstrap?.schemaVersion ?? 0,
          keyword: exportState.keyword,
          summary,
          sections: exportState.sections.map((section) => ({
            key: section.key,
            title: section.title,
            counts: section.group
              ? {
                  current: section.currentOnlyItems.length + section.sharedItems.length,
                  backup: section.incomingItems.length + section.sharedItems.length,
                  shared: section.sharedItems.length,
                  incomingOnly: section.incomingItems.length,
                  currentOnly: section.currentOnlyItems.length,
                }
              : null,
            hasMatches: section.hasMatches,
            incomingItems: section.incomingItems,
            currentOnlyItems: section.currentOnlyItems,
            sharedItems: section.sharedItems,
          })),
        },
        null,
        2,
      )
    }

    if (format === 'csv') {
      const rows = [
        ['recordType', 'section', 'bucket', 'name', 'currentCount', 'backupCount', 'sharedCount', 'incomingOnlyCount', 'currentOnlyCount', 'keyword'],
        [
          'summary_total',
          '',
          '',
          '',
          summary.totals.current,
          summary.totals.backup,
          summary.totals.shared,
          summary.totals.incomingOnly,
          summary.totals.currentOnly,
          summary.keyword,
        ],
      ]

      for (const section of summary.sections) {
        rows.push([
          'summary_section',
          section.title,
          '',
          '',
          section.current,
          section.backup,
          section.shared,
          section.incomingOnly,
          section.currentOnly,
          summary.keyword,
        ])
      }

      for (const section of exportState.sections) {
        if (!section.group) {
          continue
        }

        const pushRows = (bucket: string, values: string[]) => {
          if (values.length === 0) {
            rows.push(['item', section.title, bucket, '', '', '', '', '', '', summary.keyword])
            return
          }

          for (const value of values) {
            rows.push(['item', section.title, bucket, value, '', '', '', '', '', summary.keyword])
          }
        }

        if (!section.hasMatches) {
          rows.push(['item', section.title, 'none', '', '', '', '', '', '', summary.keyword])
          continue
        }

        pushRows('incoming_only', section.incomingItems)
        pushRows('current_only', section.currentOnlyItems)
        pushRows('shared', section.sharedItems)
      }

      return rows
        .map((row) =>
          row
            .map((cell) => `"${String(cell).replaceAll('"', '""')}"`)
            .join(','),
        )
        .join('\n')
    }

    const lines = [
      `${m.backupDiffTitle}`,
      `${m.backupSelectedPath(pendingBackupImport.sourcePath ?? '')}`,
      m.backupVersionSummary(
        pendingBackupImport.manifest.version,
        pendingBackupImport.manifest.schemaVersion,
        bootstrap?.schemaVersion ?? 0,
      ),
      exportState.keyword
        ? `${m.backupDiffSearch}: ${exportState.keyword}`
        : `${m.backupDiffSearch}: ${m.backupDiffSummaryKeywordNone}`,
      `${m.backupDiffSummaryTitle}`,
      `${m.backupDiffSummarySections(summary.matchedSectionCount, summary.totalSectionCount)}`,
      `${m.backupDiffSummaryTotals(
        summary.totals.current,
        summary.totals.backup,
        summary.totals.incomingOnly,
        summary.totals.currentOnly,
        summary.totals.shared,
      )}`,
      ...summary.sections.map((section) =>
        m.backupDiffSummarySection(
          section.title,
          section.current,
          section.backup,
          section.incomingOnly,
          section.currentOnly,
          section.shared,
        ),
      ),
      '',
    ]

    for (const section of exportState.sections) {
      const { title, incomingItems, currentOnlyItems, sharedItems, hasMatches } = section
      if (!section.group) {
        continue
      }

      const filteredCurrentCount = currentOnlyItems.length + sharedItems.length
      const filteredBackupCount = incomingItems.length + sharedItems.length

      lines.push(`${title}`)
      lines.push(`${m.backupDiffCounts(filteredCurrentCount, filteredBackupCount, sharedItems.length)}`)

      if (!hasMatches) {
        lines.push(m.backupDiffNoResults(exportState.keyword))
        lines.push('')
        continue
      }

      lines.push(`${m.backupDiffIncomingOnly(incomingItems.length)}:`)
      lines.push(...(incomingItems.length > 0 ? incomingItems.map((item) => `- ${item}`) : [`- ${m.backupDiffNoMatches}`]))
      lines.push(`${m.backupDiffCurrentOnly(currentOnlyItems.length)}:`)
      lines.push(...(currentOnlyItems.length > 0 ? currentOnlyItems.map((item) => `- ${item}`) : [`- ${m.backupDiffNoMatches}`]))
      lines.push(`${m.backupDiffShared(sharedItems.length)}:`)
      lines.push(...(sharedItems.length > 0 ? sharedItems.map((item) => `- ${item}`) : [`- ${m.backupDiffNoMatches}`]))
      lines.push('')
    }

    return lines.join('\n')
  }

  async function exportBackupDiffReport(format: BackupDiffExportFormat) {
    const report = buildBackupDiffReport(format)

    if (!report) {
      return
    }

      const result = await workspaceHost.exportBackupDiffReport({
      format,
      content: report,
    })

    if (result.cancelled || !result.targetPath) {
      return
    }

    setStatusMessage(m.backupDiffExportDone(format.toUpperCase(), result.targetPath))
  }

  async function removeSelectedCue() {
    if (!selectedCue) return

    stopAllPlayback(m.playbackStopped)
      const result = await workspaceHost.deleteCue(selectedCue.id)
    const [nextBootstrap, nextHistory] = await Promise.all([
        workspaceHost.getBootstrapSnapshot(),
        workspaceHost.listHistory(),
    ])
    syncShortcutDiagnostics(result)
    setBootstrap(nextBootstrap)
    setHistoryEntries(nextHistory)
    setLibrary(result.snapshot)
    setSelectedId((current) => pickSelectedId(result.snapshot.cueCards, current, null))
    await refreshMissingFiles(result.snapshot.cueCards)
    setStatusMessage(m.cleanupSummary(result.cleanup.deletedResourceCount, result.cleanup.deletedTagCount))
  }

  async function cleanupUnusedLibrary() {
      const result = await workspaceHost.cleanupUnusedLibrary()
      const nextBootstrap = await workspaceHost.getBootstrapSnapshot()
    setBootstrap(nextBootstrap)
    setLibrary(result.snapshot)
    setSelectedId((current) => pickSelectedId(result.snapshot.cueCards, current, selectedCue?.id ?? null))
    await refreshMissingFiles(result.snapshot.cueCards)
    setStatusMessage(m.cleanupDone(result.cleanup.deletedResourceCount, result.cleanup.deletedTagCount))
    setIsCleanupDialogOpen(false)
  }

  async function undoHistoryEntry(entry: HistoryEntry) {
    if (entry.status !== 'active') {
      return
    }

      const result = await workspaceHost.undoHistoryEntry(entry.id)
    setHistoryEntries(result.history)
    setLibrary(result.snapshot)
    setBootstrap(result.bootstrap)
    setSelectedId((current) => pickSelectedId(result.snapshot.cueCards, current, selectedId))
    syncShortcutDiagnostics(result.diagnostics)
    await refreshMissingFiles(result.snapshot.cueCards)
    setStatusMessage(m.undoDone(entry.summary))
  }

  async function retryFailedImports(failures: ImportFailure[]) {
    const retryPaths = Array.from(new Set(failures.filter((entry) => entry.retryable).map((entry) => entry.path)))

    if (retryPaths.length === 0) {
      return
    }

    await handleImport(retryPaths)
  }

  async function createStarterPack() {
    if (isImporting) return

      const result = await workspaceHost.createStarterPack()
    setLibrary(result.snapshot)
    setBootstrap(result.bootstrap)
    setHistoryEntries(result.history)
    setSelectedId((current) => pickSelectedId(result.snapshot.cueCards, current, result.snapshot.cueCards[0]?.id ?? null))
    syncShortcutDiagnostics(result.diagnostics)
    await refreshMissingFiles(result.snapshot.cueCards)
    setStatusMessage(m.starterPackReady(result.snapshot.cueCards.length))
  }

  function clearRuntimeDiagnostics() {
    setRuntimeDiagnostics({
      outputFallbackCount: 0,
      unsupportedOutputCount: 0,
      playbackFailureCount: 0,
      lastPlaybackFailure: null,
    })
  }

  function toggleHotkeyRepairScope(scope: keyof HotkeyRepairScope) {
    setHotkeyRepairScope((current) => ({
      ...current,
      [scope]: !current[scope],
    }))
  }

  async function exportLibraryBackup() {
    if (exportPasswordMismatch) {
      setStatusMessage(m.backupPasswordMismatch)
      return
    }

    setIsBackupBusy(true)

    try {
      const password = exportBackupPassword.trim()
      const result = await workspaceHost.exportLibraryBackup(password || undefined)

      if (result.cancelled || !result.targetPath) {
        return
      }

      setStatusMessage(m.backupExportDone(result.targetPath))
      setIsExportBackupDialogOpen(false)
      setExportBackupPassword('')
      setExportBackupPasswordConfirm('')
    } catch (error) {
      setStatusMessage(m.backupActionFailed(getErrorMessage(error)))
    } finally {
      setIsBackupBusy(false)
    }
  }

  async function previewLibraryBackupImport() {
    setIsBackupBusy(true)

    try {
      const result = await workspaceHost.previewLibraryBackupImport()

      if (result.cancelled || !result.sourcePath) {
        return
      }

      setImportBackupPassword('')
      setPendingBackupImport(result)
      setActiveWorkspaceSection('backup')
    } catch (error) {
      setStatusMessage(m.backupActionFailed(getErrorMessage(error)))
    } finally {
      setIsBackupBusy(false)
    }
  }

  async function importLibraryBackup() {
    if (
      !pendingBackupImport?.sourcePath ||
      pendingBackupImport.compatibility?.blocked ||
      (backupRequiresPassword && importBackupPassword.trim().length === 0)
    ) {
      return
    }

    setIsBackupBusy(true)

    try {
      stopAllPlayback(m.allPlaybackStopped)
      const result = await workspaceHost.importLibraryBackup(
        pendingBackupImport.sourcePath,
        importBackupPassword.trim() || undefined,
        backupImportSelection,
      )

      if (result.cancelled || !result.snapshot || !result.bootstrap || !result.history || !result.diagnostics) {
        return
      }

      const snapshot = result.snapshot
      const bootstrapSnapshot = result.bootstrap
      const history = result.history
      const diagnostics = result.diagnostics

      setImportProgress(null)
      setImportReport(null)
      setBootstrap(bootstrapSnapshot)
      setLibrary(snapshot)
      setHistoryEntries(history)
      setSelectedCueIds([])
      setSelectedId((current) => pickSelectedId(snapshot.cueCards, current, snapshot.cueCards[0]?.id ?? null))
      syncShortcutDiagnostics(diagnostics)
      clearRuntimeDiagnostics()
      await refreshMissingFiles(snapshot.cueCards)
      setStatusMessage(m.backupImportDone(snapshot.cueCards.length))
      setImportBackupPassword('')
      setPendingBackupImport(null)
    } catch (error) {
      setStatusMessage(m.backupActionFailed(getErrorMessage(error)))
    } finally {
      setIsBackupBusy(false)
    }
  }

  async function repairShortcutConflicts(mode: HotkeyRepairMode) {
    if (selectedHotkeyRepairCount === 0) {
      return
    }

    setIsHotkeyRepairBusy(true)

    try {
      const result = await workspaceHost.repairShortcutConflicts({
        mode,
        scopes: hotkeyRepairScope,
      })

      setLibrary(result.snapshot)
      setSelectedId((current) =>
        pickSelectedId(result.snapshot.cueCards, current, selectedCue?.id ?? result.snapshot.cueCards[0]?.id ?? null),
      )
      syncShortcutDiagnostics(result.diagnostics)
      setStatusMessage(
        mode === 'assign'
          ? m.hotkeyRepairAssigned(result.updatedCount)
          : m.hotkeyRepairCleared(result.updatedCount),
      )
      setIsHotkeyRepairDialogOpen(false)
    } catch (error) {
      setStatusMessage(m.hotkeyRepairFailed(getErrorMessage(error)))
    } finally {
      setIsHotkeyRepairBusy(false)
    }
  }

  async function applySuggestedHotkeys() {
    if (selectedSuggestedHotkeys.length === 0) {
      return
    }

    try {
      const result = await workspaceHost.applyShortcutAssignments(selectedSuggestedHotkeys)
      setLibrary(result.snapshot)
      setSelectedId((current) =>
        pickSelectedId(result.snapshot.cueCards, current, selectedCue?.id ?? result.snapshot.cueCards[0]?.id ?? null),
      )
      syncShortcutDiagnostics(result.diagnostics)
      setImportReport((current) =>
        current
          ? {
              ...current,
              suggestedHotkeys: current.suggestedHotkeys.filter(
                (entry) => !selectedSuggestedHotkeyCueIds.includes(entry.cueId),
              ),
            }
          : current,
      )
      setStatusMessage(m.hotkeySuggestionApplied(result.updatedCount))
    } catch (error) {
      setStatusMessage(m.hotkeySuggestionFailed(getErrorMessage(error)))
    }
  }

  function toggleSuggestedHotkey(cueId: string) {
    setSelectedSuggestedHotkeyCueIds((current) =>
      current.includes(cueId) ? current.filter((id) => id !== cueId) : [...current, cueId],
    )
  }

  function toggleBackupDiffSection(sectionKey: string) {
    setExpandedBackupDiffSections((current) => ({
      ...current,
      [sectionKey]: !current[sectionKey],
    }))
  }

  function renderBackupDiffGroup(sectionKey: BackupDiffSectionView['key'], title: string, group: BackupDiffGroup | null) {
    if (!group) {
      return null
    }

    const isExpanded = Boolean(expandedBackupDiffSections[sectionKey])
    const keyword = backupDiffSearch.trim().toLowerCase()
    const filterItems = (values: string[]) =>
      keyword ? values.filter((value) => value.toLowerCase().includes(keyword)) : values
    const incomingItems = filterItems(group.incomingItems)
    const currentOnlyItems = filterItems(group.currentOnlyItems)
    const sharedItems = filterItems(group.sharedItems)
    const collapsedIncomingItems = (keyword ? incomingItems : group.incomingSamples).slice(0, 5)
    const collapsedCurrentOnlyItems = (keyword ? currentOnlyItems : group.currentOnlySamples).slice(0, 5)
    const hasMatches =
      incomingItems.length > 0 || currentOnlyItems.length > 0 || sharedItems.length > 0 || keyword.length === 0

    return (
      <div className="backup-diff-group">
        <div className="backup-diff-header">
          <div>
            <strong>{title}</strong>
            <div className="muted small">
              {m.backupDiffCounts(group.currentCount, group.backupCount, group.sharedCount)}
            </div>
          </div>
          <button className="tag-chip" onClick={() => toggleBackupDiffSection(sectionKey)}>
            {isExpanded ? m.backupDiffHideDetails : m.backupDiffShowDetails}
          </button>
        </div>
        {hasMatches ? (
          <div className="backup-diff-columns">
            <div className="backup-diff-column">
              <span className="muted small">{m.backupDiffIncomingOnly(group.incomingOnlyCount)}</span>
              {(isExpanded ? incomingItems : collapsedIncomingItems).length > 0 ? (
                <div className="tag-row backup-diff-item-row">
                  {(isExpanded ? incomingItems : collapsedIncomingItems).map((name) => (
                    <label className="backup-diff-item" key={`${title}-incoming-${name}`}>
                      <input
                        type="checkbox"
                        checked={isBackupDiffSelected(sectionKey, 'incomingOnly', name)}
                        onChange={() => toggleBackupDiffSelection(sectionKey, 'incomingOnly', name)}
                      />
                      <span className="mini-tag">{name}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <span className="muted small">{m.backupDiffNoMatches}</span>
              )}
            </div>
            <div className="backup-diff-column">
              <span className="muted small">{m.backupDiffCurrentOnly(group.currentOnlyCount)}</span>
              {(isExpanded ? currentOnlyItems : collapsedCurrentOnlyItems).length > 0 ? (
                <div className="tag-row backup-diff-item-row">
                  {(isExpanded ? currentOnlyItems : collapsedCurrentOnlyItems).map((name) => (
                    <label className="backup-diff-item" key={`${title}-current-${name}`}>
                      <input
                        type="checkbox"
                        checked={isBackupDiffSelected(sectionKey, 'currentOnly', name)}
                        onChange={() => toggleBackupDiffSelection(sectionKey, 'currentOnly', name)}
                      />
                      <span className="mini-tag muted-item">{name}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <span className="muted small">{m.backupDiffNoMatches}</span>
              )}
            </div>
            {isExpanded ? (
              <div className="backup-diff-column">
                <span className="muted small">{m.backupDiffShared(group.sharedCount)}</span>
                {sharedItems.length > 0 ? (
                  <div className="tag-row backup-diff-item-row">
                    {sharedItems.map((name) => (
                      <label className="backup-diff-item" key={`${title}-shared-${name}`}>
                        <input
                          type="checkbox"
                          checked={isBackupDiffSelected(sectionKey, 'shared', name)}
                          onChange={() => toggleBackupDiffSelection(sectionKey, 'shared', name)}
                        />
                        <span className="mini-tag">{name}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <span className="muted small">{m.backupDiffNoMatches}</span>
                )}
              </div>
            ) : null}
          </div>
        ) : (
          <span className="muted small">{m.backupDiffNoResults(keyword)}</span>
        )}
      </div>
    )
  }

  async function rescanFiles() {
    await refreshMissingFiles(library.cueCards)
    const missingCount = (
        await workspaceHost.checkFilesExist(
        library.cueCards.map((cue) => cue.resource.absolutePath),
      )
    ).missing.length
    setStatusMessage(missingCount === 0 ? m.allFilesAvailable : m.filesMissing(missingCount))
  }

  function handleTagInputKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault()
      void commitTagInput()
    }
  }

  const filteredBackupDiffState = buildFilteredBackupDiffSections()
  const backupDiffSummaryView = filteredBackupDiffState
    ? buildBackupDiffSummaryView(filteredBackupDiffState.sections, filteredBackupDiffState.keyword)
    : null
  const selectedBackupDiffItemCount = useMemo(
    () =>
      backupDiffSectionKeys.reduce(
        (total, section) =>
          total +
          backupImportSelection[section].incomingOnly.length +
          backupImportSelection[section].currentOnly.length +
          backupImportSelection[section].shared.length,
        0,
      ),
    [backupImportSelection],
  )

  const currentStatusText = statusMessage || m.ready
  const chromeProps = buildWorkspaceChromeProps({
    copy: m,
    activeSection: activeWorkspaceSection,
    search,
    currentOutputDeviceLabel,
    hotkeyAlertCount,
    runtimeIssueCount,
    latestPlaybackName: latestPlayback?.name ?? null,
    globalShortcutsEnabled: settings.globalShortcutsEnabled,
    globalVolume: settings.globalVolume,
    hasPlayback,
    hasPlayingPlayback,
    statusText: currentStatusText,
    outputDevices,
    selectedOutputDeviceId: settings.selectedOutputDeviceId,
    onSearchChange: setSearch,
    onCloseWindow: () => window.close(),
    onSectionChange: activateWorkspaceSection,
    onOutputDeviceChange: (deviceId) => void updateSettings({ selectedOutputDeviceId: deviceId }),
    onToggleGlobalShortcuts: () => void updateSettings({ globalShortcutsEnabled: !settings.globalShortcutsEnabled }),
    onTogglePlaybackPause: () => void togglePlaybackPauseState(),
    onStopAllPlayback: () => stopAllPlayback(m.allPlaybackStopped),
    onVolumeChange: (value) => void updateSettings({ globalVolume: value }),
  })

  useEffect(() => {
    publishWorkspaceShellState(chromeProps.shellState)
  }, [chromeProps.shellState])

  const libraryToolbarHeader = (
    <>
      <p className="eyebrow">{m.library}</p>
      <h2>{m.soundsReady(filteredCues.length)}</h2>
      <p className="muted small">
        {m.visibleRange(displayRange.start, displayRange.end, filteredCues.length)}
      </p>
    </>
  )

  const libraryToolbarActions = (
    <>
      <button className="primary-button" onClick={handleOpenFiles} disabled={isImporting}>
        {m.importAudio}
      </button>
      <button className="tag-chip" onClick={() => void rescanFiles()}>
        {m.rescanFiles}
      </button>
      <button
        className={`tag-chip ${cardViewMode === 'paged' ? 'active' : ''}`}
        onClick={() => setCardViewMode('paged')}
      >
        {m.viewPaged}
      </button>
      <button
        className={`tag-chip ${cardViewMode === 'virtual' ? 'active' : ''}`}
        onClick={() => setCardViewMode('virtual')}
      >
        {m.viewVirtual}
      </button>
    </>
  )

  const libraryToolbarFilters = (
    <div className="tag-strip" role="tablist" aria-label={m.tags}>
      {allTags.map((tag) => (
        <button
          key={tag.name}
          className={`tag-chip ${tagFilter === tag.name ? 'active' : ''}`}
          onClick={() => setTagFilter(tag.name)}
          style={tag.color && tagFilter !== tag.name ? { background: tag.color } : undefined}
        >
          {tag.name === 'all' ? m.allTags : tag.name}
        </button>
      ))}
    </div>
  )

  const libraryToolbarMeta =
    cardViewMode === 'paged' ? (
      <>
        <div className="toolbar-inline">
          <span className="muted small">{m.pageSize}</span>
          <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}>
            {[24, 40, 48, 96].map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>
        <div className="toolbar-inline">
          <button
            className="tag-chip"
            disabled={currentPage <= 1}
            onClick={() => setCurrentPage((current) => Math.max(1, current - 1))}
          >
            {m.prevPage}
          </button>
          <span className="muted small">{m.pageInfo(currentPage, pageCount)}</span>
          <button
            className="tag-chip"
            disabled={currentPage >= pageCount}
            onClick={() => setCurrentPage((current) => Math.min(pageCount, current + 1))}
          >
            {m.nextPage}
          </button>
        </div>
      </>
    ) : (
      <span className="muted small">
        {m.virtualWindowInfo(virtualLayout.rows.length, virtualLayout.totalRows)}
      </span>
    )

  const libraryImportProgressPanel = importProgress ? (
    <section className="panel import-progress-panel">
      <div className="import-progress-header">
        <strong>{importProgressLabel}</strong>
        {importProgress.phase === 'importing' ? (
          <span className="muted small">{Math.round(importProgressRatio * 100)}%</span>
        ) : null}
      </div>
      <div className="progress-track" aria-hidden="true">
        <div
          className={`progress-fill ${importProgress.phase === 'scanning' ? 'indeterminate' : ''}`}
          style={importProgress.phase === 'importing' ? { width: `${importProgressRatio * 100}%` } : undefined}
        />
      </div>
      {importProgress.currentPath ? (
        <span className="muted small">
          {m.importCurrentFile(formatImportCurrentPath(importProgress.currentPath))}
        </span>
      ) : null}
    </section>
  ) : undefined

  const libraryWarningFeedback = (
    <>
      {settings.warnOnMissingFiles && missingFiles.length > 0 ? (
        <div className="alert-strip warning">{m.missingWarning(missingFiles.length)}</div>
      ) : null}
      {hotkeyAlertCount > 0 ? (
        <div className="alert-strip">
          <div className="hotkey-alert-row">
            <strong>{m.hotkeyAlerts(hotkeyAlertCount)}</strong>
            <button className="tag-chip" onClick={() => setIsHotkeyRepairDialogOpen(true)}>
              {m.hotkeyRepairOpen}
            </button>
          </div>
          <div className="hotkey-alert-summary">
            {duplicateHotkeys.length > 0 ? (
              <span className="badge warning">
                {m.duplicateHotkey} {duplicateHotkeys.length}
              </span>
            ) : null}
            {failedHotkeys.length > 0 ? (
              <span className="badge warning">
                {m.rejectedHotkey} {failedHotkeys.length}
              </span>
            ) : null}
            {reservedHotkeys.length > 0 ? (
              <span className="badge warning">
                {m.reservedHotkey} {reservedHotkeys.length}
              </span>
            ) : null}
            {weakHotkeys.length > 0 ? (
              <span className="badge warning">
                {m.weakHotkey} {weakHotkeys.length}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  )

  const libraryImportReportPanel = importReport ? (
    <section className="alert-strip import-report">
      <div className="import-report-header">
        <strong>{m.importReportTitle}</strong>
        <div className="transport-row">
          {suggestedImportedHotkeys.length > 0 ? (
            <button
              className="tag-chip"
              disabled={selectedSuggestedHotkeys.length === 0}
              onClick={() => void applySuggestedHotkeys()}
            >
              {m.hotkeySuggestionApply}
            </button>
          ) : null}
          <button
            className="tag-chip"
            disabled={retryableImportFailures.length === 0 || isImporting}
            onClick={() => void retryFailedImports(retryableImportFailures)}
          >
            {m.importRetryAll}
          </button>
        </div>
      </div>
      <span>{summarizeImportResult(importReport, m)}</span>
      {suggestedImportedHotkeys.length > 0 ? (
        <div className="import-suggestion-block">
          <strong>{m.hotkeySuggestionTitle(suggestedImportedHotkeys.length)}</strong>
          <span className="muted small">
            {m.hotkeySuggestionHint} {m.hotkeySuggestionSelection(selectedSuggestedHotkeys.length)}
          </span>
          <div className="suggestion-list">
            {suggestedImportedHotkeys.slice(0, 8).map((entry) => {
              const checked = selectedSuggestedHotkeyCueIds.includes(entry.cueId)

              return (
                <label className={`suggestion-item ${checked ? 'selected' : ''}`} key={`${entry.cueId}-${entry.hotkey}`}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleSuggestedHotkey(entry.cueId)}
                  />
                  <span>
                    {entry.name}
                    {entry.groupLabel ? <span className="suggestion-group-label">{entry.groupLabel}</span> : null}
                  </span>
                  <strong>{entry.hotkey}</strong>
                </label>
              )
            })}
          </div>
        </div>
      ) : null}
      {importReport.failedImports.length > 0 ? (
        <div className="import-failures">
          <strong>{m.importFailures}</strong>
          {importReport.failedImports.slice(0, 6).map((entry) => (
            <div className="import-failure-item" key={`${entry.path}-${entry.code}-${entry.reason}`}>
              <div className="import-failure-copy">
                <div className="tag-row">
                  <span className="badge warning">{getImportFailureLabel(entry.code)}</span>
                  {!entry.retryable ? (
                    <span className="badge">{m.importFailureNotRetryable}</span>
                  ) : null}
                </div>
                <code>{entry.path}</code>
                <span className="muted small">{m.importFailureReason(entry.reason)}</span>
              </div>
              <button
                className="tag-chip"
                disabled={!entry.retryable || isImporting}
                onClick={() => void retryFailedImports([entry])}
              >
                {m.importRetryOne}
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  ) : undefined

  const libraryBulkActionsPanel =
    multiSelectedCount > 0 ? (
      <section className="panel bulk-panel">
        <div className="bulk-header">
          <strong>{m.selectedCount(multiSelectedCount)}</strong>
          <span className="muted small">{m.dragSortHint}</span>
        </div>
        <div className="bulk-row">
          <input
            value={bulkTagInput}
            onChange={(event) => setBulkTagInput(event.target.value)}
            placeholder={m.bulkTagPlaceholder}
          />
          <button className="tag-chip" onClick={() => void applyBulkTags('add')}>
            {m.bulkAdd}
          </button>
          <button className="tag-chip" onClick={() => void applyBulkTags('remove')}>
            {m.bulkRemove}
          </button>
          <button className="tag-chip" onClick={() => void applyBulkTags('replace')}>
            {m.bulkReplace}
          </button>
          <button className="tag-chip" onClick={() => void clearBulkTags()}>
            {m.bulkClearAll}
          </button>
          <button className="tag-chip" onClick={() => setSelectedCueIds([])}>
            {m.clearSelection}
          </button>
        </div>
        {selectedTagSummaries.common.length > 0 ? (
          <div className="bulk-tag-block">
            <div className="bulk-tag-block-header">
              <strong>{m.bulkTagCommon}</strong>
              <button
                className="tag-chip"
                onClick={() =>
                  setBulkTagInput(selectedTagSummaries.common.map((tag) => tag.name).join(', '))
                }
              >
                {m.bulkUseCommon}
              </button>
            </div>
            <span className="muted small">{m.bulkTagCommonHint}</span>
            <div className="tag-row">
              {selectedTagSummaries.common.map((tag) => (
                <button
                  className="tag-chip"
                  key={`common-${tag.name}`}
                  style={tag.color ? { background: tag.color } : undefined}
                  onClick={() => void removeBulkTag(tag.name)}
                >
                  {`${tag.name} - ${m.bulkRemoveSelectedTag}`}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        <div className="bulk-tag-block">
          <div className="bulk-tag-block-header">
            <strong>{m.bulkTagInventory}</strong>
            <span className="muted small">{m.bulkTagInventoryHint}</span>
          </div>
          {selectedTagSummaries.all.length > 0 ? (
            <div className="tag-row">
              {selectedTagSummaries.all.map((tag) => {
                const staged = stagedBulkTags.includes(tag.name)

                return (
                  <button
                    className={`tag-chip ${staged ? 'active' : ''}`}
                    key={`selected-tag-${tag.name}`}
                    style={tag.color && !staged ? { background: tag.color } : undefined}
                    onClick={() => toggleBulkDraftTag(tag.name)}
                  >
                    {tag.name} <span className="bulk-tag-count">{tag.count}/{multiSelectedCount}</span>
                  </button>
                )
              })}
            </div>
          ) : (
            <span className="muted small">{m.bulkNoTags}</span>
          )}
        </div>
      </section>
    ) : undefined

  const libraryCardState = {
    selectedCueId: selectedId,
    selectedCueIds: selectedCueIdSet,
    missingPaths: missingPathSet,
    duplicateHotkeys: duplicateHotkeySet,
    failedHotkeys: failedHotkeySet,
    reservedHotkeys: reservedHotkeySet,
    weakHotkeys: weakHotkeySet,
    activePlaybackIds: activePlaybackIdSet,
  }

  const libraryWorkspacePage = (
    <LibraryWorkspaceContent
      {...buildLibraryWorkspaceContentProps({
        copy: m,
        toolbar: {
          header: libraryToolbarHeader,
          actions: libraryToolbarActions,
          filters: libraryToolbarFilters,
          meta: libraryToolbarMeta,
        },
        feedback: {
          progressPanel: libraryImportProgressPanel,
          warnings: libraryWarningFeedback,
          report: libraryImportReportPanel,
        },
        bulkPanel: libraryBulkActionsPanel,
        gridRef,
        virtual: cardViewMode === 'virtual',
        cues: filteredCues,
        displayedCues,
        virtualLayout,
        cardState: libraryCardState,
        isLibraryEmpty,
        isImporting,
        onCuePress: handleCueCardPress,
        onCueEdit: openCueEditor,
        onCueStop: (cueId) => stopCuePlayback(cueId, m.playbackStopped),
        onCueDragStart: setDragCueId,
        onCueDrop: (targetCueId) => {
          if (dragCueId) {
            void reorderCues(dragCueId, targetCueId)
          }
          setDragCueId(null)
        },
        onCueDragEnd: () => setDragCueId(null),
        onOpenFiles: handleOpenFiles,
        onCreateStarterPack: () => void createStarterPack(),
      })}
    />
  )
  const adminWorkspacePage = (
    <AdminWorkspaceView
      {...buildAdminWorkspaceViewProps({
        copy: m,
        activeSection: activeWorkspaceSection,
        settings,
        outputDevices,
        bootstrap,
        historyEntries,
        language,
        formatDateTime,
        onUndoHistoryEntry: (entry) => void undoHistoryEntry(entry),
        libraryTags,
        tagManagerSearch,
        tagManagerSortMode,
        filteredManagedTags,
        selectedManagedTagId,
        selectedManagedTagIds,
        managedTag,
        tagRenameInput,
        tagRenameRule,
        batchTagRenamePreview,
        actionableBatchTagRenamePreviewCount: actionableBatchTagRenamePreview.length,
        batchTagRenameWarnings,
        tagColorPalette,
        onUpdateSettings: (patch) => updateSettings(patch),
        onOpenFloatingControl: () => void workspaceHost.openFloatingControlWindow(),
        onSearchChange: setTagManagerSearch,
        onSortModeChange: (mode) => void updateSettings({ tagManagerSortMode: mode }),
        onSelectAllFiltered: selectAllFilteredTags,
        onClearSelection: clearManagedTagSelection,
        onToggleSelection: toggleManagedTagSelection,
        onSelectManagedTag: setSelectedManagedTagId,
        onBatchColor: (color) => void batchColorManagedTags(color),
        onBatchDelete: () => void deleteSelectedManagedTags(),
        onTagRenameRuleChange: setTagRenameRule,
        onApplyBatchRenameRule: () => void applyBatchRenameRule(),
        onResetTagRenameRule: () => setTagRenameRule(defaultTagRenameRule),
        onTagRenameInputChange: setTagRenameInput,
        onRenameManagedTag: () => void renameManagedTag(),
        onMergeSelectedManagedTags: () => void mergeSelectedManagedTags(),
        onDeleteManagedTag: (tag) => void deleteManagedTag(tag),
        onChangeTagColor: (tag, color) => void changeTagColor(tag, color),
        isBackupBusy,
        pendingBackupImport,
        onOpenExportDialog: () => setIsExportBackupDialogOpen(true),
        onPreviewImport: () => void previewLibraryBackupImport(),
        onCancelPendingImport: () => setPendingBackupImport(null),
        hotkeyAlertCount,
        missingFilesCount: missingFiles.length,
        runtimeDiagnostics,
        runtimeIssueCount,
        onRescanFiles: () => void rescanFiles(),
        onOpenHotkeyRepair: () => setIsHotkeyRepairDialogOpen(true),
        onClearRuntimeDiagnostics: clearRuntimeDiagnostics,
        onOpenCleanupDialog: () => setIsCleanupDialogOpen(true),
      })}
    />
  )
  const backupTemplateViews = backupImportSelectionTemplates.map((template) => ({
    id: template.id,
    name: template.name,
    isActive: areBackupImportSelectionsEqual(template.selection, backupImportSelection),
    onApply: () => applyBackupImportSelectionTemplate(template),
    onDelete: () => void deleteBackupImportSelectionTemplate(template.id),
  }))
  const backupDiffSummaryNode = backupDiffSummaryView ? (
    <div className="backup-diff-summary-grid">
      <div className="backup-diff-summary-card">
        <strong>{m.backupDiffSummaryTitle}</strong>
        <span className="muted small">
          {m.backupDiffSummarySections(
            backupDiffSummaryView.matchedSectionCount,
            backupDiffSummaryView.totalSectionCount,
          )}
        </span>
        <span className="muted small">
          {m.backupDiffSummaryTotals(
            backupDiffSummaryView.totals.current,
            backupDiffSummaryView.totals.backup,
            backupDiffSummaryView.totals.incomingOnly,
            backupDiffSummaryView.totals.currentOnly,
            backupDiffSummaryView.totals.shared,
          )}
        </span>
      </div>
      <div className="backup-diff-summary-card">
        <strong>{m.backupDiffSummaryBySection}</strong>
        <div className="backup-diff-summary-list">
          {backupDiffSummaryView.sections.map((section) => (
            <span className="muted small" key={`summary-${section.key}`}>
              {m.backupDiffSummarySection(
                section.title,
                section.current,
                section.backup,
                section.incomingOnly,
                section.currentOnly,
                section.shared,
              )}
            </span>
          ))}
        </div>
      </div>
    </div>
  ) : null
  const backupDiffGroupsNode = pendingBackupImport?.diffSummary ? (
    <>
      {renderBackupDiffGroup('cues', m.backupDiffSectionCues, pendingBackupImport.diffSummary.cues)}
      {renderBackupDiffGroup('tags', m.backupDiffSectionTags, pendingBackupImport.diffSummary.tags)}
      {renderBackupDiffGroup(
        'resources',
        m.backupDiffSectionResources,
        pendingBackupImport.diffSummary.resources,
      )}
    </>
  ) : null

  if (isFloatingControlMode) {
    return (
      <FloatingControlView
        copy={m}
        globalShortcutsEnabled={settings.globalShortcutsEnabled}
        hotkeyAlertCount={hotkeyAlertCount}
        missingFilesCount={missingFiles.length}
        currentOutputDeviceLabel={currentOutputDeviceLabel}
        currentStatusText={currentStatusText}
        onFocusMainWindow={() => void workspaceHost.focusMainWindow()}
        onToggleGlobalShortcuts={(enabled) => void updateSettings({ globalShortcutsEnabled: enabled })}
      />
    )
  }

  const workspaceBody = (
    <main className={isHostedByWinUiShell ? 'embedded-workspace' : 'frame-workspace'}>
      <div
        className={`content-area ${
          isHostedByWinUiShell ? 'embedded-workspace-scroll' : 'frame-workspace-scroll'
        }`}
      >
        {isLibraryWorkspace ? libraryWorkspacePage : adminWorkspacePage}
      </div>
    </main>
  )

  if (isHostedByWinUiShell) {
    return (
      <div
        className="embedded-workspace-shell"
        onDragOver={(event) => {
          event.preventDefault()
          setIsDropActive(true)
        }}
        onDragLeave={() => setIsDropActive(false)}
        onDrop={handleDrop}
      >
        <WorkspaceDropOverlay isVisible={isDropActive} title={m.dropTitle} hint={m.dropHint} />
        {workspaceBody}

        <CueEditorDrawer
          copy={m}
          isOpen={isEditorDrawerOpen}
          cue={selectedCue}
          isRecordingHotkey={isRecordingHotkey}
          tagInput={tagInput}
          selectedCueHotkeyWarnings={selectedCueHotkeyWarnings}
          tagSuggestions={tagSuggestions}
          tagColorPalette={tagColorPalette}
          speedPresets={speedPresets}
          onClose={() => setIsEditorDrawerOpen(false)}
          onCueNameChange={(value) => selectedCue && queueCuePatch(selectedCue.id, { name: value })}
          onToggleHotkeyRecording={() => setIsRecordingHotkey((current) => !current)}
          onClearHotkey={() => selectedCue && queueCuePatch(selectedCue.id, { hotkey: '' })}
          onTagInputChange={setTagInput}
          onCommitTagInput={() => void commitTagInput()}
          onTagInputKeyDown={handleTagInputKeyDown}
          onAppendTag={(tagName) => void appendTag(tagName)}
          onChangeTagColor={(tag, color) => void changeTagColor(tag, color)}
          onPlaybackRateChange={(value) =>
            selectedCue && queueCuePatch(selectedCue.id, { playbackRate: value })
          }
          onVolumeChange={(value) => selectedCue && queueCuePatch(selectedCue.id, { volume: value })}
          onPreview={() => selectedCue && void playCue(selectedCue)}
          onTrimChange={(trimStartMs, trimEndMs) =>
            selectedCue && queueCuePatch(selectedCue.id, { trimStartMs, trimEndMs })
          }
          onOpenDelete={() => setIsDeleteDialogOpen(true)}
        />

        <WorkspaceDialogs
          copy={m}
          exportBackup={{
            isOpen: isExportBackupDialogOpen,
            password: exportBackupPassword,
            passwordConfirm: exportBackupPasswordConfirm,
            isBusy: isBackupBusy,
            passwordMismatch: exportPasswordMismatch,
            onPasswordChange: setExportBackupPassword,
            onPasswordConfirmChange: setExportBackupPasswordConfirm,
            onCancel: () => setIsExportBackupDialogOpen(false),
            onSubmit: () => void exportLibraryBackup(),
          }}
          importBackup={{
            pending: pendingBackupImport,
            bootstrap,
            requiresPassword: backupRequiresPassword,
            password: importBackupPassword,
            isBusy: isBackupBusy,
            selectedItemCount: selectedBackupDiffItemCount,
            backupTemplateName,
            templates: backupTemplateViews,
            summaryNode: backupDiffSummaryNode,
            diffGroupsNode: backupDiffGroupsNode,
            getCompatibilityTone: getBackupCompatibilityTone,
            getCompatibilityReasonLabel: getBackupCompatibilityReasonLabel,
            getIntegrityReasonLabel: getBackupIntegrityReasonLabel,
            onCancel: () => setPendingBackupImport(null),
            onPasswordChange: setImportBackupPassword,
            onDiffSearchChange: setBackupDiffSearch,
            onClearSelection: clearBackupImportSelection,
            onTemplateNameChange: setBackupTemplateName,
            onSaveTemplate: () => void saveBackupImportSelectionTemplate(),
            onExportDiff: (format) => void exportBackupDiffReport(format),
            onSubmit: () => void importLibraryBackup(),
            diffSearch: backupDiffSearch,
          }}
          hotkeyRepair={{
            isOpen: isHotkeyRepairDialogOpen,
            counts: hotkeyRepairCounts,
            scope: hotkeyRepairScope,
            selectedCount: selectedHotkeyRepairCount,
            isBusy: isHotkeyRepairBusy,
            onCancel: () => setIsHotkeyRepairDialogOpen(false),
            onToggleScope: toggleHotkeyRepairScope,
            onClear: () => void repairShortcutConflicts('clear'),
            onAssign: () => void repairShortcutConflicts('assign'),
          }}
          cleanup={{
            isOpen: isCleanupDialogOpen,
            orphanCount: bootstrap?.stats.orphanResourceCount ?? 0,
            onCancel: () => setIsCleanupDialogOpen(false),
            onSubmit: () => void cleanupUnusedLibrary(),
          }}
          deleteCue={{
            cue: selectedCue,
            isOpen: isDeleteDialogOpen,
            onCancel: () => setIsDeleteDialogOpen(false),
            onSubmit: () => {
              setIsDeleteDialogOpen(false)
              void removeSelectedCue()
            },
          }}
        />
      </div>
    )
  }

  return (
    <div
      className="app-shell"
      onDragOver={(event) => {
        event.preventDefault()
        setIsDropActive(true)
      }}
      onDragLeave={() => setIsDropActive(false)}
      onDrop={handleDrop}
    >
      <WorkspaceDropOverlay isVisible={isDropActive} title={m.dropTitle} hint={m.dropHint} />
        <WorkspaceTopbar {...chromeProps.topbar} />
        <WorkspaceSidebar {...chromeProps.sidebar} />

      {workspaceBody}
        <WorkspaceDock {...chromeProps.dock} />

      <CueEditorDrawer
        copy={m}
        isOpen={isEditorDrawerOpen}
        cue={selectedCue}
        isRecordingHotkey={isRecordingHotkey}
        tagInput={tagInput}
        selectedCueHotkeyWarnings={selectedCueHotkeyWarnings}
        tagSuggestions={tagSuggestions}
        tagColorPalette={tagColorPalette}
        speedPresets={speedPresets}
        onClose={() => setIsEditorDrawerOpen(false)}
        onCueNameChange={(value) => selectedCue && queueCuePatch(selectedCue.id, { name: value })}
        onToggleHotkeyRecording={() => setIsRecordingHotkey((current) => !current)}
        onClearHotkey={() => selectedCue && queueCuePatch(selectedCue.id, { hotkey: '' })}
        onTagInputChange={setTagInput}
        onCommitTagInput={() => void commitTagInput()}
        onTagInputKeyDown={handleTagInputKeyDown}
        onAppendTag={(tagName) => void appendTag(tagName)}
        onChangeTagColor={(tag, color) => void changeTagColor(tag, color)}
        onPlaybackRateChange={(value) =>
          selectedCue && queueCuePatch(selectedCue.id, { playbackRate: value })
        }
        onVolumeChange={(value) => selectedCue && queueCuePatch(selectedCue.id, { volume: value })}
        onPreview={() => selectedCue && void playCue(selectedCue)}
        onTrimChange={(trimStartMs, trimEndMs) =>
          selectedCue && queueCuePatch(selectedCue.id, { trimStartMs, trimEndMs })
        }
        onOpenDelete={() => setIsDeleteDialogOpen(true)}
      />

      <WorkspaceDialogs
        copy={m}
        exportBackup={{
          isOpen: isExportBackupDialogOpen,
          password: exportBackupPassword,
          passwordConfirm: exportBackupPasswordConfirm,
          isBusy: isBackupBusy,
          passwordMismatch: exportPasswordMismatch,
          onPasswordChange: setExportBackupPassword,
          onPasswordConfirmChange: setExportBackupPasswordConfirm,
          onCancel: () => setIsExportBackupDialogOpen(false),
          onSubmit: () => void exportLibraryBackup(),
        }}
        importBackup={{
          pending: pendingBackupImport,
          bootstrap,
          requiresPassword: backupRequiresPassword,
          password: importBackupPassword,
          isBusy: isBackupBusy,
          selectedItemCount: selectedBackupDiffItemCount,
          backupTemplateName,
          templates: backupTemplateViews,
          summaryNode: backupDiffSummaryNode,
          diffGroupsNode: backupDiffGroupsNode,
          getCompatibilityTone: getBackupCompatibilityTone,
          getCompatibilityReasonLabel: getBackupCompatibilityReasonLabel,
          getIntegrityReasonLabel: getBackupIntegrityReasonLabel,
          onCancel: () => setPendingBackupImport(null),
          onPasswordChange: setImportBackupPassword,
          onDiffSearchChange: setBackupDiffSearch,
          onClearSelection: clearBackupImportSelection,
          onTemplateNameChange: setBackupTemplateName,
          onSaveTemplate: () => void saveBackupImportSelectionTemplate(),
          onExportDiff: (format) => void exportBackupDiffReport(format),
          onSubmit: () => void importLibraryBackup(),
          diffSearch: backupDiffSearch,
        }}
        hotkeyRepair={{
          isOpen: isHotkeyRepairDialogOpen,
          counts: hotkeyRepairCounts,
          scope: hotkeyRepairScope,
          selectedCount: selectedHotkeyRepairCount,
          isBusy: isHotkeyRepairBusy,
          onCancel: () => setIsHotkeyRepairDialogOpen(false),
          onToggleScope: toggleHotkeyRepairScope,
          onClear: () => void repairShortcutConflicts('clear'),
          onAssign: () => void repairShortcutConflicts('assign'),
        }}
        cleanup={{
          isOpen: isCleanupDialogOpen,
          orphanCount: bootstrap?.stats.orphanResourceCount ?? 0,
          onCancel: () => setIsCleanupDialogOpen(false),
          onSubmit: () => void cleanupUnusedLibrary(),
        }}
        deleteCue={{
          cue: selectedCue,
          isOpen: isDeleteDialogOpen,
          onCancel: () => setIsDeleteDialogOpen(false),
          onSubmit: () => {
            setIsDeleteDialogOpen(false)
            void removeSelectedCue()
          },
        }}
      />
    </div>
  )
}

export default App
