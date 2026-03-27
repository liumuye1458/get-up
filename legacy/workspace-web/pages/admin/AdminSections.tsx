import type { ReactNode } from 'react'
import type {
  AppSettings,
  BootstrapSnapshot,
  HistoryEntry,
  LibraryTagManagerEntry,
  TagRenamePreviewEntry,
  TagRenameRule,
} from '../../../electron'

type OutputDeviceOption = {
  deviceId: string
  label: string
}

export function SettingsAdminSection({
  copy,
  settings,
  outputDevices,
  onUpdateSettings,
  onOpenFloatingControl,
}: {
  copy: {
    settings: string
    playbackRouting: string
    language: string
    languageZh: string
    languageEn: string
    allowLayeredPlayback: string
    stopOthersOnTrigger: string
    warnOnMissingFiles: string
    globalShortcutsEnabled: string
    outputDevice: string
    hotkeySuggestionSettings: string
    hotkeySuggestionPrimaryModifier: string
    hotkeySuggestionGroupingMode: string
    hotkeySuggestionGroupingNone: string
    hotkeySuggestionGroupingTag: string
    hotkeySuggestionIncludeAlternateModifiers: string
    hotkeySuggestionIncludeDigits: string
    hotkeySuggestionIncludeFunctionKeys: string
    hotkeySuggestionIncludeLetters: string
    floatingControl: string
    floatingControlHint: string
    openFloatingControl: string
  }
  settings: AppSettings
  outputDevices: OutputDeviceOption[]
  onUpdateSettings: (patch: Partial<AppSettings>) => void | Promise<void>
  onOpenFloatingControl: () => void
}) {
  return (
    <section className="panel admin-section-panel">
      <p className="eyebrow">{copy.settings}</p>
      <h2>{copy.playbackRouting}</h2>
      <label className="field">
        <span>{copy.language}</span>
        <select
          value={settings.language}
          onChange={(event) =>
            void onUpdateSettings({ language: event.target.value as AppSettings['language'] })
          }
        >
          <option value="zh-CN">{copy.languageZh}</option>
          <option value="en-US">{copy.languageEn}</option>
        </select>
      </label>

      <div className="toggle-list">
        <label className="toggle-row">
          <input
            type="checkbox"
            checked={settings.allowOverlap}
            onChange={(event) => void onUpdateSettings({ allowOverlap: event.target.checked })}
          />
          <span>{copy.allowLayeredPlayback}</span>
        </label>
        <label className="toggle-row">
          <input
            type="checkbox"
            checked={settings.stopOthersOnTrigger}
            onChange={(event) => void onUpdateSettings({ stopOthersOnTrigger: event.target.checked })}
          />
          <span>{copy.stopOthersOnTrigger}</span>
        </label>
        <label className="toggle-row">
          <input
            type="checkbox"
            checked={settings.warnOnMissingFiles}
            onChange={(event) => void onUpdateSettings({ warnOnMissingFiles: event.target.checked })}
          />
          <span>{copy.warnOnMissingFiles}</span>
        </label>
        <label className="toggle-row">
          <input
            type="checkbox"
            checked={settings.globalShortcutsEnabled}
            onChange={(event) =>
              void onUpdateSettings({ globalShortcutsEnabled: event.target.checked })
            }
          />
          <span>{copy.globalShortcutsEnabled}</span>
        </label>
      </div>

      <label className="field">
        <span>{copy.outputDevice}</span>
        <select
          value={settings.selectedOutputDeviceId}
          onChange={(event) => void onUpdateSettings({ selectedOutputDeviceId: event.target.value })}
        >
          {outputDevices.map((device) => (
            <option key={device.deviceId || 'default'} value={device.deviceId}>
              {device.label}
            </option>
          ))}
        </select>
      </label>

      <div className="field">
        <span>{copy.hotkeySuggestionSettings}</span>
        <div className="toggle-list">
          <label className="field">
            <span>{copy.hotkeySuggestionPrimaryModifier}</span>
            <select
              value={settings.hotkeySuggestionStrategy.primaryModifier}
              onChange={(event) =>
                void onUpdateSettings({
                  hotkeySuggestionStrategy: {
                    ...settings.hotkeySuggestionStrategy,
                    primaryModifier:
                      event.target.value as AppSettings['hotkeySuggestionStrategy']['primaryModifier'],
                  },
                })
              }
            >
              {['Ctrl+Shift', 'Ctrl+Alt', 'Alt+Shift'].map((modifier) => (
                <option key={modifier} value={modifier}>
                  {modifier}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>{copy.hotkeySuggestionGroupingMode}</span>
            <select
              value={settings.hotkeySuggestionStrategy.groupingMode}
              onChange={(event) =>
                void onUpdateSettings({
                  hotkeySuggestionStrategy: {
                    ...settings.hotkeySuggestionStrategy,
                    groupingMode:
                      event.target.value as AppSettings['hotkeySuggestionStrategy']['groupingMode'],
                  },
                })
              }
            >
              <option value="none">{copy.hotkeySuggestionGroupingNone}</option>
              <option value="tag">{copy.hotkeySuggestionGroupingTag}</option>
            </select>
          </label>

          <label className="toggle-row">
            <input
              type="checkbox"
              checked={settings.hotkeySuggestionStrategy.includeAlternateModifiers}
              onChange={(event) =>
                void onUpdateSettings({
                  hotkeySuggestionStrategy: {
                    ...settings.hotkeySuggestionStrategy,
                    includeAlternateModifiers: event.target.checked,
                  },
                })
              }
            />
            <span>{copy.hotkeySuggestionIncludeAlternateModifiers}</span>
          </label>
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={settings.hotkeySuggestionStrategy.includeDigits}
              onChange={(event) =>
                void onUpdateSettings({
                  hotkeySuggestionStrategy: {
                    ...settings.hotkeySuggestionStrategy,
                    includeDigits: event.target.checked,
                  },
                })
              }
            />
            <span>{copy.hotkeySuggestionIncludeDigits}</span>
          </label>
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={settings.hotkeySuggestionStrategy.includeFunctionKeys}
              onChange={(event) =>
                void onUpdateSettings({
                  hotkeySuggestionStrategy: {
                    ...settings.hotkeySuggestionStrategy,
                    includeFunctionKeys: event.target.checked,
                  },
                })
              }
            />
            <span>{copy.hotkeySuggestionIncludeFunctionKeys}</span>
          </label>
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={settings.hotkeySuggestionStrategy.includeLetters}
              onChange={(event) =>
                void onUpdateSettings({
                  hotkeySuggestionStrategy: {
                    ...settings.hotkeySuggestionStrategy,
                    includeLetters: event.target.checked,
                  },
                })
              }
            />
            <span>{copy.hotkeySuggestionIncludeLetters}</span>
          </label>
        </div>
      </div>

      <div className="compatibility-block">
        <strong>{copy.floatingControl}</strong>
        <span className="muted small">{copy.floatingControlHint}</span>
        <div className="transport-row">
          <button className="tag-chip" onClick={onOpenFloatingControl}>
            {copy.openFloatingControl}
          </button>
        </div>
      </div>
    </section>
  )
}

export function HistoryAdminSection({
  copy,
  bootstrap,
  historyEntries,
  language,
  formatDateTime,
  onUndoHistoryEntry,
}: {
  copy: {
    history: string
    historyPolicy: (maxEntries: number, activeRetentionDays: number, undoneRetentionDays: number) => string
    historyUndone: (value: string) => string
    undo: string
    noHistory: string
  }
  bootstrap: BootstrapSnapshot | null
  historyEntries: HistoryEntry[]
  language: AppSettings['language']
  formatDateTime: (value: string, language: AppSettings['language']) => string
  onUndoHistoryEntry: (entry: HistoryEntry) => void
}) {
  return (
    <section className="panel compact history-panel admin-section-panel">
      <div className="history-header">
        <div>
          <p className="eyebrow">{copy.history}</p>
          <h2>{copy.history}</h2>
        </div>
      </div>
      {bootstrap ? (
        <p className="muted small">
          {copy.historyPolicy(
            bootstrap.historyPolicy.maxEntries,
            bootstrap.historyPolicy.activeRetentionDays,
            bootstrap.historyPolicy.undoneRetentionDays,
          )}
        </p>
      ) : null}
      {historyEntries.length > 0 ? (
        <div className="history-list">
          {historyEntries.map((entry) => (
            <div className={`history-item ${entry.status !== 'active' ? 'muted-item' : ''}`} key={entry.id}>
              <div className="history-copy">
                <strong>{entry.summary}</strong>
                <span className="muted small">{formatDateTime(entry.createdAt, language)}</span>
                {entry.status !== 'active' && entry.undoneAt ? (
                  <span className="muted small">{copy.historyUndone(formatDateTime(entry.undoneAt, language))}</span>
                ) : null}
              </div>
              <button
                className="tag-chip"
                disabled={entry.status !== 'active'}
                onClick={() => onUndoHistoryEntry(entry)}
              >
                {copy.undo}
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="muted">{copy.noHistory}</p>
      )}
    </section>
  )
}

export function TagManagerAdminSection({
  copy,
  libraryTagCount,
  search,
  sortMode,
  filteredTags,
  selectedTagId,
  selectedTagIds,
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
}: {
  copy: {
    tagManager: string
    tagManagerTitle: (count: number) => string
    tagManagerHint: string
    tagManagerSearch: string
    tagManagerSearchPlaceholder: string
    tagManagerSort: string
    tagManagerSortName: string
    tagManagerSortUsage: string
    tagManagerSortRecent: string
    tagManagerSelectFiltered: string
    tagManagerClearSelection: string
    tagManagerSelectedCount: (count: number) => string
    tagManagerBatchTools: string
    tagManagerBatchResetColor: string
    tagManagerBatchDelete: string
    tagManagerBatchRenameRule: string
    tagManagerBatchRenameFind: string
    tagManagerBatchRenameReplace: string
    tagManagerBatchRenamePrefix: string
    tagManagerBatchRenameSuffix: string
    tagManagerBatchRenameCase: string
    tagManagerBatchRenameCasePreserve: string
    tagManagerBatchRenameCaseLower: string
    tagManagerBatchRenameCaseUpper: string
    tagManagerBatchRenameCaseTitle: string
    tagManagerBatchRenameTrim: string
    tagManagerBatchRenameCollapseSpaces: string
    tagManagerBatchRenameWarningsTitle: string
    tagManagerBatchRenameWarningEmpty: (count: number) => string
    tagManagerBatchRenameWarningUnchanged: (count: number) => string
    tagManagerBatchRenameWarningMergeExisting: (count: number) => string
    tagManagerBatchRenameWarningMergeSelection: (count: number) => string
    tagManagerBatchRenameEmptyPreview: string
    tagManagerBatchRenameApply: (count: number) => string
    tagManagerBatchRenameReset: string
    tagManagerUsage: (count: number) => string
    tagManagerEmpty: string
    tagManagerRename: string
    tagManagerRenameApply: string
    tagManagerBatchMerge: string
    tagManagerDelete: string
    tagManagerBatchMergeHint: string
    tagColors: string
    resetAutoColor: string
  }
  libraryTagCount: number
  search: string
  sortMode: 'name' | 'usage' | 'recent'
  filteredTags: LibraryTagManagerEntry[]
  selectedTagId: string | null
  selectedTagIds: string[]
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
  onSearchChange: (value: string) => void
  onSortModeChange: (mode: 'name' | 'usage' | 'recent') => void
  onSelectAllFiltered: () => void
  onClearSelection: () => void
  onToggleSelection: (tagId: string) => void
  onSelectManagedTag: (tagId: string) => void
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
}) {
  return (
    <section className="panel tag-manager-panel admin-section-panel">
      <p className="eyebrow">{copy.tagManager}</p>
      <h2>{copy.tagManagerTitle(libraryTagCount)}</h2>
      <p className="muted">{copy.tagManagerHint}</p>

      <label className="field">
        <span>{copy.tagManagerSearch}</span>
        <input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={copy.tagManagerSearchPlaceholder}
        />
      </label>

      <div className="field">
        <span>{copy.tagManagerSort}</span>
        <div className="transport-row">
          <button
            className={`tag-chip ${sortMode === 'name' ? 'active' : ''}`}
            onClick={() => onSortModeChange('name')}
          >
            {copy.tagManagerSortName}
          </button>
          <button
            className={`tag-chip ${sortMode === 'usage' ? 'active' : ''}`}
            onClick={() => onSortModeChange('usage')}
          >
            {copy.tagManagerSortUsage}
          </button>
          <button
            className={`tag-chip ${sortMode === 'recent' ? 'active' : ''}`}
            onClick={() => onSortModeChange('recent')}
          >
            {copy.tagManagerSortRecent}
          </button>
        </div>
      </div>

      <div className="transport-row">
        <button className="tag-chip" disabled={filteredTags.length === 0} onClick={onSelectAllFiltered}>
          {copy.tagManagerSelectFiltered}
        </button>
        <button className="tag-chip" disabled={selectedTagIds.length === 0} onClick={onClearSelection}>
          {copy.tagManagerClearSelection}
        </button>
        <span className="muted small">{copy.tagManagerSelectedCount(selectedTagIds.length)}</span>
      </div>

      {selectedTagIds.length > 0 ? (
        <div className="bulk-tag-block">
          <div className="bulk-tag-block-header">
            <strong>{copy.tagManagerBatchTools}</strong>
            <span className="muted small">{copy.tagManagerSelectedCount(selectedTagIds.length)}</span>
          </div>
          <div className="tag-row">
            {tagColorPalette.map((color) => (
              <button
                className="color-swatch"
                key={`batch-color-${color}`}
                style={{ background: color }}
                onClick={() => onBatchColor(color)}
              />
            ))}
            <button className="tag-chip" onClick={() => onBatchColor(null)}>
              {copy.tagManagerBatchResetColor}
            </button>
          </div>
          <div className="transport-row">
            <button className="tag-chip" onClick={onBatchDelete}>
              {copy.tagManagerBatchDelete}
            </button>
          </div>
          <div className="tag-rename-rule-block">
            <strong>{copy.tagManagerBatchRenameRule}</strong>
            <div className="tag-rename-rule-grid">
              <label className="field">
                <span>{copy.tagManagerBatchRenameFind}</span>
                <input
                  value={tagRenameRule.findText}
                  onChange={(event) =>
                    onTagRenameRuleChange({ ...tagRenameRule, findText: event.target.value })
                  }
                />
              </label>
              <label className="field">
                <span>{copy.tagManagerBatchRenameReplace}</span>
                <input
                  value={tagRenameRule.replaceText}
                  onChange={(event) =>
                    onTagRenameRuleChange({ ...tagRenameRule, replaceText: event.target.value })
                  }
                />
              </label>
              <label className="field">
                <span>{copy.tagManagerBatchRenamePrefix}</span>
                <input
                  value={tagRenameRule.prefix}
                  onChange={(event) =>
                    onTagRenameRuleChange({ ...tagRenameRule, prefix: event.target.value })
                  }
                />
              </label>
              <label className="field">
                <span>{copy.tagManagerBatchRenameSuffix}</span>
                <input
                  value={tagRenameRule.suffix}
                  onChange={(event) =>
                    onTagRenameRuleChange({ ...tagRenameRule, suffix: event.target.value })
                  }
                />
              </label>
              <label className="field">
                <span>{copy.tagManagerBatchRenameCase}</span>
                <select
                  value={tagRenameRule.caseMode}
                  onChange={(event) =>
                    onTagRenameRuleChange({
                      ...tagRenameRule,
                      caseMode: event.target.value as TagRenameRule['caseMode'],
                    })
                  }
                >
                  <option value="preserve">{copy.tagManagerBatchRenameCasePreserve}</option>
                  <option value="lower">{copy.tagManagerBatchRenameCaseLower}</option>
                  <option value="upper">{copy.tagManagerBatchRenameCaseUpper}</option>
                  <option value="title">{copy.tagManagerBatchRenameCaseTitle}</option>
                </select>
              </label>
            </div>
            <div className="toggle-list">
              <label className="toggle-row">
                <input
                  type="checkbox"
                  checked={tagRenameRule.trimWhitespace}
                  onChange={(event) =>
                    onTagRenameRuleChange({
                      ...tagRenameRule,
                      trimWhitespace: event.target.checked,
                    })
                  }
                />
                <span>{copy.tagManagerBatchRenameTrim}</span>
              </label>
              <label className="toggle-row">
                <input
                  type="checkbox"
                  checked={tagRenameRule.collapseSpaces}
                  onChange={(event) =>
                    onTagRenameRuleChange({
                      ...tagRenameRule,
                      collapseSpaces: event.target.checked,
                    })
                  }
                />
                <span>{copy.tagManagerBatchRenameCollapseSpaces}</span>
              </label>
            </div>
            {batchTagRenameWarnings.emptyCount > 0 ||
            batchTagRenameWarnings.unchangedCount > 0 ||
            batchTagRenameWarnings.mergeIntoExistingCount > 0 ||
            batchTagRenameWarnings.mergeWithinSelectionCount > 0 ? (
              <div className="compatibility-block warning">
                <strong>{copy.tagManagerBatchRenameWarningsTitle}</strong>
                <div className="backup-diff-summary-list">
                  {batchTagRenameWarnings.emptyCount > 0 ? (
                    <span className="muted small">
                      {copy.tagManagerBatchRenameWarningEmpty(batchTagRenameWarnings.emptyCount)}
                    </span>
                  ) : null}
                  {batchTagRenameWarnings.unchangedCount > 0 ? (
                    <span className="muted small">
                      {copy.tagManagerBatchRenameWarningUnchanged(batchTagRenameWarnings.unchangedCount)}
                    </span>
                  ) : null}
                  {batchTagRenameWarnings.mergeIntoExistingCount > 0 ? (
                    <span className="muted small">
                      {copy.tagManagerBatchRenameWarningMergeExisting(
                        batchTagRenameWarnings.mergeIntoExistingCount,
                      )}
                    </span>
                  ) : null}
                  {batchTagRenameWarnings.mergeWithinSelectionCount > 0 ? (
                    <span className="muted small">
                      {copy.tagManagerBatchRenameWarningMergeSelection(
                        batchTagRenameWarnings.mergeWithinSelectionCount,
                      )}
                    </span>
                  ) : null}
                </div>
              </div>
            ) : null}
            <div className="tag-rename-preview-list">
              {batchTagRenamePreview.map((entry) => (
                <div className="tag-rename-preview-item" key={`rename-preview-${entry.tagId}`}>
                  <span className="muted small">{entry.previousName}</span>
                  <strong>{entry.nextName || copy.tagManagerBatchRenameEmptyPreview}</strong>
                </div>
              ))}
            </div>
            <div className="transport-row">
              <button
                className="tag-chip"
                disabled={actionableBatchTagRenamePreviewCount === 0}
                onClick={onApplyBatchRenameRule}
              >
                {copy.tagManagerBatchRenameApply(actionableBatchTagRenamePreviewCount)}
              </button>
              <button className="tag-chip" onClick={onResetTagRenameRule}>
                {copy.tagManagerBatchRenameReset}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {filteredTags.length > 0 ? (
        <div className="tag-manager-list">
          {filteredTags.map((tag) => (
            <button
              className={`tag-manager-item ${selectedTagId === tag.id ? 'selected' : ''}`}
              key={tag.id}
              onClick={() => onSelectManagedTag(tag.id)}
            >
              <span className="tag-manager-name-row">
                <input
                  type="checkbox"
                  checked={selectedTagIds.includes(tag.id)}
                  onChange={() => onToggleSelection(tag.id)}
                  onClick={(event) => event.stopPropagation()}
                />
                <span
                  className="tag-manager-color"
                  style={tag.color ? { background: tag.color } : undefined}
                />
                <strong>{tag.name}</strong>
              </span>
              <span className="muted small">{copy.tagManagerUsage(tag.cueCount)}</span>
            </button>
          ))}
        </div>
      ) : (
        <p className="muted small">{copy.tagManagerEmpty}</p>
      )}

      {managedTag ? (
        <div className="tag-manager-editor">
          <label className="field">
            <span>{copy.tagManagerRename}</span>
            <input
              value={tagRenameInput}
              onChange={(event) => onTagRenameInputChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  onRenameManagedTag()
                }
              }}
            />
          </label>

          <div className="transport-row">
            <button
              className="tag-chip"
              disabled={!tagRenameInput.trim() || tagRenameInput.trim() === managedTag.name}
              onClick={onRenameManagedTag}
            >
              {copy.tagManagerRenameApply}
            </button>
            <button
              className="tag-chip"
              disabled={selectedTagIds.length < 2 || !tagRenameInput.trim()}
              onClick={onMergeSelectedManagedTags}
            >
              {copy.tagManagerBatchMerge}
            </button>
            <button
              className="tag-chip"
              disabled={managedTag.cueCount === 0}
              onClick={() => onDeleteManagedTag(managedTag)}
            >
              {copy.tagManagerDelete}
            </button>
          </div>
          <p className="muted small">{copy.tagManagerBatchMergeHint}</p>

          <div className="field">
            <span>{copy.tagColors}</span>
            <div className="tag-row">
              {tagColorPalette.map((color) => (
                <button
                  className={`color-swatch ${
                    managedTag.color === color && managedTag.colorMode === 'manual' ? 'active' : ''
                  }`}
                  key={`${managedTag.id}-${color}`}
                  style={{ background: color }}
                  onClick={() => onChangeTagColor(managedTag, color)}
                />
              ))}
              <button className="tag-chip" onClick={() => onChangeTagColor(managedTag, null)}>
                {copy.resetAutoColor}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}

export function BackupAdminSection({
  copy,
  bootstrap,
  isBackupBusy,
  pendingBackupImport,
  onOpenExportDialog,
  onPreviewImport,
  onCancelPendingImport,
}: {
  copy: {
    backup: string
    backupHint: string
    library: string
    managementCenter: string
    importBackupCurrentStats: (cueCount: number, resourceCount: number, tagCount: number) => string
    historyPolicy: (maxEntries: number, activeRetentionDays: number, undoneRetentionDays: number) => string
    exportBackup: string
    importBackup: string
    backupVersionSummary: (version: number, backupSchemaVersion: number, currentSchemaVersion: number) => string
    importBackupUnavailable: string
    backupSelectedPath: (path: string) => string
    importBackupCancel: string
  }
  bootstrap: BootstrapSnapshot | null
  isBackupBusy: boolean
  pendingBackupImport: {
    manifest?: { version: number; schemaVersion: number } | null
    sourcePath?: string | null
  } | null
  onOpenExportDialog: () => void
  onPreviewImport: () => void
  onCancelPendingImport: () => void
}) {
  return (
    <section className="panel admin-section-panel">
      <p className="eyebrow">{copy.backup}</p>
      <h2>{copy.backup}</h2>
      <p className="muted">{copy.backupHint}</p>

      {bootstrap ? (
        <div className="backup-diff-summary-grid">
          <div className="backup-diff-summary-card">
            <strong>{copy.library}</strong>
            <span className="muted small">
              {copy.importBackupCurrentStats(
                bootstrap.stats.cueCount,
                bootstrap.stats.resourceCount,
                bootstrap.stats.tagCount,
              )}
            </span>
          </div>
          <div className="backup-diff-summary-card">
            <strong>{copy.managementCenter}</strong>
            <span className="muted small">
              {copy.historyPolicy(
                bootstrap.historyPolicy.maxEntries,
                bootstrap.historyPolicy.activeRetentionDays,
                bootstrap.historyPolicy.undoneRetentionDays,
              )}
            </span>
          </div>
        </div>
      ) : null}

      <div className="transport-row">
        <button className="transport-button" onClick={onOpenExportDialog}>
          {copy.exportBackup}
        </button>
        <button className="transport-button secondary" disabled={isBackupBusy} onClick={onPreviewImport}>
          {copy.importBackup}
        </button>
      </div>

      {pendingBackupImport ? (
        <div className="compatibility-block">
          <strong>
            {pendingBackupImport.manifest
              ? copy.backupVersionSummary(
                  pendingBackupImport.manifest.version,
                  pendingBackupImport.manifest.schemaVersion,
                  bootstrap?.schemaVersion ?? 0,
                )
              : copy.importBackupUnavailable}
          </strong>
          <span className="muted small">{copy.backupSelectedPath(pendingBackupImport.sourcePath ?? '')}</span>
          <div className="transport-row">
            <button className="tag-chip" onClick={onCancelPendingImport}>
              {copy.importBackupCancel}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  )
}

export function DiagnosticsAdminSection({
  copy,
  hotkeyAlertCount,
  missingFilesCount,
  runtimeDiagnostics,
  runtimeIssueCount,
  onRescanFiles,
  onOpenHotkeyRepair,
  onClearRuntimeDiagnostics,
}: {
  copy: {
    diagnostics: string
    diagnosticsHealthy: string
    hotkeyRepairDiagnostic: (count: number) => string
    hotkeyRepairDiagnosticHint: string
    missingFilesDiagnostic: (count: number) => string
    missingFilesDiagnosticHint: string
    deviceUnsupportedDiagnostic: (count: number) => string
    deviceUnsupportedDiagnosticHint: string
    deviceFallbackDiagnostic: (count: number) => string
    deviceFallbackDiagnosticHint: string
    playbackFailureDiagnostic: (count: number) => string
    playbackFailureDiagnosticHint: (lastFailure: string) => string
    clearDiagnostics: string
    rescanFiles: string
    hotkeyRepairOpen: string
  }
  hotkeyAlertCount: number
  missingFilesCount: number
  runtimeDiagnostics: {
    unsupportedOutputCount: number
    outputFallbackCount: number
    playbackFailureCount: number
    lastPlaybackFailure: string | null
  }
  runtimeIssueCount: number
  onRescanFiles: () => void
  onOpenHotkeyRepair: () => void
  onClearRuntimeDiagnostics: () => void
}) {
  const issueCount = hotkeyAlertCount + missingFilesCount + runtimeIssueCount

  return (
    <section className="panel admin-section-panel">
      <p className="eyebrow">{copy.diagnostics}</p>
      <h2>{copy.diagnostics}</h2>
      <p className="muted">
        {issueCount === 0 ? copy.diagnosticsHealthy : copy.hotkeyRepairDiagnostic(hotkeyAlertCount)}
      </p>

      <div className="backup-diff-summary-grid">
        <div className="backup-diff-summary-card">
          <strong>{copy.hotkeyRepairDiagnostic(hotkeyAlertCount)}</strong>
          <span className="muted small">{copy.hotkeyRepairDiagnosticHint}</span>
        </div>
        <div className="backup-diff-summary-card">
          <strong>{copy.missingFilesDiagnostic(missingFilesCount)}</strong>
          <span className="muted small">{copy.missingFilesDiagnosticHint}</span>
        </div>
        <div className="backup-diff-summary-card">
          <strong>{copy.deviceUnsupportedDiagnostic(runtimeDiagnostics.unsupportedOutputCount)}</strong>
          <span className="muted small">{copy.deviceUnsupportedDiagnosticHint}</span>
        </div>
        <div className="backup-diff-summary-card">
          <strong>{copy.deviceFallbackDiagnostic(runtimeDiagnostics.outputFallbackCount)}</strong>
          <span className="muted small">{copy.deviceFallbackDiagnosticHint}</span>
        </div>
        <div className="backup-diff-summary-card">
          <strong>{copy.playbackFailureDiagnostic(runtimeDiagnostics.playbackFailureCount)}</strong>
          <span className="muted small">
            {runtimeDiagnostics.lastPlaybackFailure
              ? copy.playbackFailureDiagnosticHint(runtimeDiagnostics.lastPlaybackFailure)
              : copy.clearDiagnostics}
          </span>
        </div>
      </div>

      <div className="transport-row">
        <button className="transport-button secondary" onClick={onRescanFiles}>
          {copy.rescanFiles}
        </button>
        <button
          className="transport-button secondary"
          disabled={hotkeyAlertCount === 0}
          onClick={onOpenHotkeyRepair}
        >
          {copy.hotkeyRepairOpen}
        </button>
        <button className="tag-chip" disabled={runtimeIssueCount === 0} onClick={onClearRuntimeDiagnostics}>
          {copy.clearDiagnostics}
        </button>
      </div>
    </section>
  )
}

export function ResourceAdminSection({
  copy,
  bootstrap,
  onOpenCleanupDialog,
}: {
  copy: {
    resourceMaintenance: string
    resourceMaintenanceHint: string
    resourcesStat: (count: number) => string
    orphanStat: (count: number) => string
    storageModePortable: string
    storageModeInstalled: string
    managedDataRoot: string
    library: string
    waveformCache: string
    trashDirectory: string
    cleanupUnused: string
  }
  bootstrap: BootstrapSnapshot | null
  onOpenCleanupDialog: () => void
}) {
  return (
    <section className="panel admin-section-panel">
      <p className="eyebrow">{copy.resourceMaintenance}</p>
      <h2>{copy.resourceMaintenance}</h2>
      <p className="muted">{copy.resourceMaintenanceHint}</p>

      {bootstrap ? (
        <>
          <div className="backup-diff-summary-grid">
            <div className="backup-diff-summary-card">
              <strong>{copy.resourcesStat(bootstrap.stats.resourceCount)}</strong>
              <span className="muted small">{copy.orphanStat(bootstrap.stats.orphanResourceCount)}</span>
            </div>
            <div className="backup-diff-summary-card">
              <strong>
                {bootstrap.storage.mode === 'portable' ? copy.storageModePortable : copy.storageModeInstalled}
              </strong>
              <span className="muted small">{bootstrap.storage.dataRoot}</span>
            </div>
          </div>

          <div className="file-block">
            <span className="muted small">{copy.managedDataRoot}</span>
            <code>{bootstrap.storage.dataRoot}</code>
            <span className="muted small">{copy.library}</span>
            <code>{bootstrap.storage.libraryDir}</code>
            <span className="muted small">{copy.waveformCache}</span>
            <code>{bootstrap.storage.waveformsDir}</code>
            <span className="muted small">{copy.trashDirectory}</span>
            <code>{bootstrap.storage.trashDir}</code>
          </div>
        </>
      ) : null}

      <div className="transport-row">
        <button className="transport-button danger" onClick={onOpenCleanupDialog}>
          {copy.cleanupUnused}
        </button>
      </div>
    </section>
  )
}

export function AdminSectionSlot({ children }: { children: ReactNode }) {
  return <>{children}</>
}
