import type { ComponentProps } from 'react'
import { useCopy } from '../../use-copy'
import type {
  AppSettings,
  BackupImportResult,
  BootstrapSnapshot,
  HistoryEntry,
  LibraryTag,
  LibraryTagManagerEntry,
  TagRenamePreviewEntry,
  TagRenameRule,
} from '../../electron'
import { AdminWorkspaceView } from '../pages/admin'
import type { WorkspaceSection } from '../types'

type CopySet = ReturnType<typeof useCopy>
type AdminWorkspaceViewProps = ComponentProps<typeof AdminWorkspaceView>

export type BuildAdminWorkspaceViewPropsArgs = {
  copy: CopySet
  activeSection: WorkspaceSection
  settings: AppSettings
  outputDevices: Array<{ deviceId: string; label: string }>
  bootstrap: BootstrapSnapshot | null
  historyEntries: HistoryEntry[]
  language: AppSettings['language']
  formatDateTime: (value: string, language: AppSettings['language']) => string
  onUndoHistoryEntry: (entry: HistoryEntry) => void
  libraryTags: LibraryTag[]
  tagManagerSearch: string
  tagManagerSortMode: 'name' | 'usage' | 'recent'
  filteredManagedTags: LibraryTagManagerEntry[]
  selectedManagedTagId: string | null
  selectedManagedTagIds: string[]
  managedTag: LibraryTagManagerEntry | null
  tagRenameInput: string
  tagRenameRule: TagRenameRule
  batchTagRenamePreview: TagRenamePreviewEntry[]
  actionableBatchTagRenamePreviewCount: number
  batchTagRenameWarnings: {
    emptyCount: number
    unchangedCount: number
    mergeIntoExistingCount: number
    mergeWithinSelectionCount: number
  }
  tagColorPalette: string[]
  onUpdateSettings: (patch: Partial<AppSettings>) => void
  onOpenFloatingControl: () => void
  onSearchChange: (value: string) => void
  onSortModeChange: (mode: 'name' | 'usage' | 'recent') => void
  onSelectAllFiltered: () => void
  onClearSelection: () => void
  onToggleSelection: (tagId: string) => void
  onSelectManagedTag: (tagId: string | null) => void
  onBatchColor: (color: string | null) => void
  onBatchDelete: () => void
  onTagRenameRuleChange: (rule: TagRenameRule) => void
  onApplyBatchRenameRule: () => void
  onResetTagRenameRule: () => void
  onTagRenameInputChange: (value: string) => void
  onRenameManagedTag: () => void
  onMergeSelectedManagedTags: () => void
  onDeleteManagedTag: (tag: LibraryTagManagerEntry) => void
  onChangeTagColor: (tag: LibraryTagManagerEntry, color: string | null) => void
  isBackupBusy: boolean
  pendingBackupImport: BackupImportResult | null
  onOpenExportDialog: () => void
  onPreviewImport: () => void
  onCancelPendingImport: () => void
  hotkeyAlertCount: number
  missingFilesCount: number
  runtimeDiagnostics: {
    outputFallbackCount: number
    unsupportedOutputCount: number
    playbackFailureCount: number
    lastPlaybackFailure: string | null
  }
  runtimeIssueCount: number
  onRescanFiles: () => void
  onOpenHotkeyRepair: () => void
  onClearRuntimeDiagnostics: () => void
  onOpenCleanupDialog: () => void
}

export function buildAdminWorkspaceViewProps({
  copy: m,
  activeSection,
  settings,
  outputDevices,
  bootstrap,
  historyEntries,
  language,
  formatDateTime,
  onUndoHistoryEntry,
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
  actionableBatchTagRenamePreviewCount,
  batchTagRenameWarnings,
  tagColorPalette,
  onUpdateSettings,
  onOpenFloatingControl,
  onSearchChange,
  onSortModeChange,
  onSelectAllFiltered,
  onClearSelection,
  onToggleSelection,
  onSelectManagedTag,
  onBatchColor,
  onBatchDelete,
  onTagRenameRuleChange,
  onApplyBatchRenameRule,
  onResetTagRenameRule,
  onTagRenameInputChange,
  onRenameManagedTag,
  onMergeSelectedManagedTags,
  onDeleteManagedTag,
  onChangeTagColor,
  isBackupBusy,
  pendingBackupImport,
  onOpenExportDialog,
  onPreviewImport,
  onCancelPendingImport,
  hotkeyAlertCount,
  missingFilesCount,
  runtimeDiagnostics,
  runtimeIssueCount,
  onRescanFiles,
  onOpenHotkeyRepair,
  onClearRuntimeDiagnostics,
  onOpenCleanupDialog,
}: BuildAdminWorkspaceViewPropsArgs): AdminWorkspaceViewProps {
  return {
    page: {
      activeSection,
    },
    content: {
      activeSection,
      settingsSection: {
        copy: {
          settings: m.settings,
          playbackRouting: m.playbackRouting,
          language: m.language,
          languageZh: m.languageZh,
          languageEn: m.languageEn,
          allowLayeredPlayback: m.allowLayeredPlayback,
          stopOthersOnTrigger: m.stopOthersOnTrigger,
          warnOnMissingFiles: m.warnOnMissingFiles,
          globalShortcutsEnabled: m.globalShortcutsEnabled,
          outputDevice: m.outputDevice,
          hotkeySuggestionSettings: m.hotkeySuggestionSettings,
          hotkeySuggestionPrimaryModifier: m.hotkeySuggestionPrimaryModifier,
          hotkeySuggestionGroupingMode: m.hotkeySuggestionGroupingMode,
          hotkeySuggestionGroupingNone: m.hotkeySuggestionGroupingNone,
          hotkeySuggestionGroupingTag: m.hotkeySuggestionGroupingTag,
          hotkeySuggestionIncludeAlternateModifiers: m.hotkeySuggestionIncludeAlternateModifiers,
          hotkeySuggestionIncludeDigits: m.hotkeySuggestionIncludeDigits,
          hotkeySuggestionIncludeFunctionKeys: m.hotkeySuggestionIncludeFunctionKeys,
          hotkeySuggestionIncludeLetters: m.hotkeySuggestionIncludeLetters,
          floatingControl: m.floatingControl,
          floatingControlHint: m.floatingControlHint,
          openFloatingControl: m.openFloatingControl,
        },
        settings,
        outputDevices,
        onUpdateSettings,
        onOpenFloatingControl,
      },
      historySection: {
        copy: {
          history: m.history,
          historyPolicy: m.historyPolicy,
          historyUndone: m.historyUndone,
          undo: m.undo,
          noHistory: m.noHistory,
        },
        bootstrap,
        historyEntries,
        language,
        formatDateTime,
        onUndoHistoryEntry,
      },
      tagManagerSection: {
        copy: {
          tagManager: m.tagManager,
          tagManagerTitle: m.tagManagerTitle,
          tagManagerHint: m.tagManagerHint,
          tagManagerSearch: m.tagManagerSearch,
          tagManagerSearchPlaceholder: m.tagManagerSearchPlaceholder,
          tagManagerSort: m.tagManagerSort,
          tagManagerSortName: m.tagManagerSortName,
          tagManagerSortUsage: m.tagManagerSortUsage,
          tagManagerSortRecent: m.tagManagerSortRecent,
          tagManagerSelectFiltered: m.tagManagerSelectFiltered,
          tagManagerClearSelection: m.tagManagerClearSelection,
          tagManagerSelectedCount: m.tagManagerSelectedCount,
          tagManagerBatchTools: m.tagManagerBatchTools,
          tagManagerBatchResetColor: m.tagManagerBatchResetColor,
          tagManagerBatchDelete: m.tagManagerBatchDelete,
          tagManagerBatchRenameRule: m.tagManagerBatchRenameRule,
          tagManagerBatchRenameFind: m.tagManagerBatchRenameFind,
          tagManagerBatchRenameReplace: m.tagManagerBatchRenameReplace,
          tagManagerBatchRenamePrefix: m.tagManagerBatchRenamePrefix,
          tagManagerBatchRenameSuffix: m.tagManagerBatchRenameSuffix,
          tagManagerBatchRenameCase: m.tagManagerBatchRenameCase,
          tagManagerBatchRenameCasePreserve: m.tagManagerBatchRenameCasePreserve,
          tagManagerBatchRenameCaseLower: m.tagManagerBatchRenameCaseLower,
          tagManagerBatchRenameCaseUpper: m.tagManagerBatchRenameCaseUpper,
          tagManagerBatchRenameCaseTitle: m.tagManagerBatchRenameCaseTitle,
          tagManagerBatchRenameTrim: m.tagManagerBatchRenameTrim,
          tagManagerBatchRenameCollapseSpaces: m.tagManagerBatchRenameCollapseSpaces,
          tagManagerBatchRenameWarningsTitle: m.tagManagerBatchRenameWarningsTitle,
          tagManagerBatchRenameWarningEmpty: m.tagManagerBatchRenameWarningEmpty,
          tagManagerBatchRenameWarningUnchanged: m.tagManagerBatchRenameWarningUnchanged,
          tagManagerBatchRenameWarningMergeExisting: m.tagManagerBatchRenameWarningMergeExisting,
          tagManagerBatchRenameWarningMergeSelection: m.tagManagerBatchRenameWarningMergeSelection,
          tagManagerBatchRenameEmptyPreview: m.tagManagerBatchRenameEmptyPreview,
          tagManagerBatchRenameApply: m.tagManagerBatchRenameApply,
          tagManagerBatchRenameReset: m.tagManagerBatchRenameReset,
          tagManagerUsage: m.tagManagerUsage,
          tagManagerEmpty: m.tagManagerEmpty,
          tagManagerRename: m.tagManagerRename,
          tagManagerRenameApply: m.tagManagerRenameApply,
          tagManagerBatchMerge: m.tagManagerBatchMerge,
          tagManagerDelete: m.tagManagerDelete,
          tagManagerBatchMergeHint: m.tagManagerBatchMergeHint,
          tagColors: m.tagColors,
          resetAutoColor: m.resetAutoColor,
        },
        libraryTagCount: libraryTags.length,
        search: tagManagerSearch,
        sortMode: tagManagerSortMode,
        filteredTags: filteredManagedTags,
        selectedTagId: selectedManagedTagId,
        selectedTagIds: selectedManagedTagIds,
        managedTag,
        tagRenameInput,
        tagRenameRule,
        batchTagRenamePreview,
        actionableBatchTagRenamePreviewCount,
        batchTagRenameWarnings,
        tagColorPalette,
        onSearchChange,
        onSortModeChange,
        onSelectAllFiltered,
        onClearSelection,
        onToggleSelection,
        onSelectManagedTag,
        onBatchColor,
        onBatchDelete,
        onTagRenameRuleChange,
        onApplyBatchRenameRule,
        onResetTagRenameRule,
        onTagRenameInputChange,
        onRenameManagedTag,
        onMergeSelectedManagedTags,
        onDeleteManagedTag,
        onChangeTagColor,
      },
      backupSection: {
        copy: {
          backup: m.backup,
          backupHint: m.backupHint,
          library: m.library,
          managementCenter: m.managementCenter,
          importBackupCurrentStats: m.importBackupCurrentStats,
          historyPolicy: m.historyPolicy,
          exportBackup: m.exportBackup,
          importBackup: m.importBackup,
          backupVersionSummary: m.backupVersionSummary,
          importBackupUnavailable: m.importBackupUnavailable,
          backupSelectedPath: m.backupSelectedPath,
          importBackupCancel: m.importBackupCancel,
        },
        bootstrap,
        isBackupBusy,
        pendingBackupImport,
        onOpenExportDialog,
        onPreviewImport,
        onCancelPendingImport,
      },
      diagnosticsSection: {
        copy: {
          diagnostics: m.diagnostics,
          diagnosticsHealthy: m.diagnosticsHealthy,
          hotkeyRepairDiagnostic: m.hotkeyRepairDiagnostic,
          hotkeyRepairDiagnosticHint: m.hotkeyRepairDiagnosticHint,
          missingFilesDiagnostic: m.missingFilesDiagnostic,
          missingFilesDiagnosticHint: m.missingFilesDiagnosticHint,
          deviceUnsupportedDiagnostic: m.deviceUnsupportedDiagnostic,
          deviceUnsupportedDiagnosticHint: m.deviceUnsupportedDiagnosticHint,
          deviceFallbackDiagnostic: m.deviceFallbackDiagnostic,
          deviceFallbackDiagnosticHint: m.deviceFallbackDiagnosticHint,
          playbackFailureDiagnostic: m.playbackFailureDiagnostic,
          playbackFailureDiagnosticHint: m.playbackFailureDiagnosticHint,
          clearDiagnostics: m.clearDiagnostics,
          rescanFiles: m.rescanFiles,
          hotkeyRepairOpen: m.hotkeyRepairOpen,
        },
        hotkeyAlertCount,
        missingFilesCount,
        runtimeDiagnostics,
        runtimeIssueCount,
        onRescanFiles,
        onOpenHotkeyRepair,
        onClearRuntimeDiagnostics,
      },
      resourceSection: {
        copy: {
          resourceMaintenance: m.resourceMaintenance,
          resourceMaintenanceHint: m.resourceMaintenanceHint,
          resourcesStat: m.resourcesStat,
          orphanStat: m.orphanStat,
          storageModePortable: m.storageModePortable,
          storageModeInstalled: m.storageModeInstalled,
          managedDataRoot: m.managedDataRoot,
          library: m.library,
          waveformCache: m.waveformCache,
          trashDirectory: m.trashDirectory,
          cleanupUnused: m.cleanupUnused,
        },
        bootstrap,
        onOpenCleanupDialog,
      },
    },
  }
}
