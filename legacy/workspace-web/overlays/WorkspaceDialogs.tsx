import type { ReactNode } from 'react'
import type { BackupImportResult, BootstrapSnapshot, LibraryCueCard } from '../../electron'
import { useCopy } from '../../use-copy'

type CopySet = ReturnType<typeof useCopy>

type BackupSelectionTemplateView = {
  id: string
  name: string
  isActive: boolean
  onApply: () => void
  onDelete: () => void
}

type WorkspaceDialogsProps = {
  copy: CopySet
  exportBackup: {
    isOpen: boolean
    password: string
    passwordConfirm: string
    isBusy: boolean
    passwordMismatch: boolean
    onPasswordChange: (value: string) => void
    onPasswordConfirmChange: (value: string) => void
    onCancel: () => void
    onSubmit: () => void
  }
  importBackup: {
    pending: BackupImportResult | null
    bootstrap: BootstrapSnapshot | null
    requiresPassword: boolean
    password: string
    isBusy: boolean
    selectedItemCount: number
    backupTemplateName: string
    templates: BackupSelectionTemplateView[]
    summaryNode: ReactNode
    diffGroupsNode: ReactNode
    getCompatibilityTone: (result: BackupImportResult['compatibility']) => string
    getCompatibilityReasonLabel: (code: NonNullable<NonNullable<BackupImportResult['compatibility']>['reasons']>[number]['code']) => string
    getIntegrityReasonLabel: (code: NonNullable<NonNullable<BackupImportResult['integrity']>['reasons']>[number]['code']) => string
    onCancel: () => void
    onPasswordChange: (value: string) => void
    onDiffSearchChange: (value: string) => void
    onClearSelection: () => void
    onTemplateNameChange: (value: string) => void
    onSaveTemplate: () => void
    onExportDiff: (format: 'txt' | 'csv' | 'json') => void
    onSubmit: () => void
    diffSearch: string
  }
  hotkeyRepair: {
    isOpen: boolean
    counts: Record<'duplicate' | 'failed' | 'reserved' | 'weak', number>
    scope: Record<'duplicate' | 'failed' | 'reserved' | 'weak', boolean>
    selectedCount: number
    isBusy: boolean
    onCancel: () => void
    onToggleScope: (scope: 'duplicate' | 'failed' | 'reserved' | 'weak') => void
    onClear: () => void
    onAssign: () => void
  }
  cleanup: {
    isOpen: boolean
    orphanCount: number
    onCancel: () => void
    onSubmit: () => void
  }
  deleteCue: {
    cue: LibraryCueCard | null
    isOpen: boolean
    onCancel: () => void
    onSubmit: () => void
  }
}

function ModalBackdrop({
  children,
  onClose,
}: {
  children: ReactNode
  onClose: () => void
}) {
  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div className="modal-card" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        {children}
      </div>
    </div>
  )
}

export function WorkspaceDialogs({
  copy,
  exportBackup,
  importBackup,
  hotkeyRepair,
  cleanup,
  deleteCue,
}: WorkspaceDialogsProps) {
  return (
    <>
      {exportBackup.isOpen ? (
        <ModalBackdrop onClose={exportBackup.onCancel}>
          <p className="eyebrow">{copy.exportBackup}</p>
          <h2>{copy.exportBackupConfirmTitle}</h2>
          <p className="muted">{copy.exportBackupConfirmBody}</p>
          <label className="field">
            <span>{copy.backupPasswordOptional}</span>
            <input
              type="password"
              value={exportBackup.password}
              onChange={(event) => exportBackup.onPasswordChange(event.target.value)}
              placeholder={copy.backupPassword}
            />
          </label>
          <label className="field">
            <span>{copy.backupPasswordConfirm}</span>
            <input
              type="password"
              value={exportBackup.passwordConfirm}
              onChange={(event) => exportBackup.onPasswordConfirmChange(event.target.value)}
              placeholder={copy.backupPasswordConfirm}
            />
          </label>
          <p className="muted small">{copy.backupPasswordHint}</p>
          <div className="transport-row">
            <button className="transport-button secondary" onClick={exportBackup.onCancel}>
              {copy.exportBackupCancel}
            </button>
            <button
              className="transport-button"
              disabled={exportBackup.isBusy || exportBackup.passwordMismatch}
              onClick={exportBackup.onSubmit}
            >
              {exportBackup.password.trim().length > 0
                ? copy.backupPasswordProtected
                : copy.exportBackupSubmit}
            </button>
          </div>
        </ModalBackdrop>
      ) : null}

      {importBackup.pending ? (
        <ModalBackdrop onClose={importBackup.onCancel}>
          <p className="eyebrow">{copy.importBackup}</p>
          <h2>{copy.importBackupConfirmTitle}</h2>
          <p className="muted">{copy.importBackupConfirmBody}</p>
          {importBackup.pending.manifest ? (
            <div className={`compatibility-block ${importBackup.getCompatibilityTone(importBackup.pending.compatibility)}`}>
              <strong>
                {copy.backupVersionSummary(
                  importBackup.pending.manifest.version,
                  importBackup.pending.manifest.schemaVersion,
                  importBackup.bootstrap?.schemaVersion ?? 0,
                )}
              </strong>
              <span className="muted small">
                {copy.backupSelectedPath(importBackup.pending.sourcePath ?? '')}
              </span>
              {importBackup.pending.compatibility?.reasons.length ? (
                <div className="compatibility-reason-list">
                  {importBackup.pending.compatibility.reasons.map((reason) => (
                    <span className="badge warning" key={`${reason.code}-${reason.detail}`}>
                      {importBackup.getCompatibilityReasonLabel(reason.code)}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="muted small">{copy.backupCompatibilityReady}</span>
              )}
            </div>
          ) : (
            <div className="compatibility-block danger">
              <strong>{copy.importBackupUnavailable}</strong>
              <span className="muted small">{copy.backupSelectedPath(importBackup.pending.sourcePath ?? '')}</span>
            </div>
          )}
          {importBackup.pending.integrity ? (
            <div
              className={`compatibility-block ${
                importBackup.pending.integrity.level === 'ok'
                  ? 'ok'
                  : importBackup.pending.integrity.level === 'warning'
                    ? 'warning'
                    : 'danger'
              }`}
            >
              <strong>
                {importBackup.pending.integrity.level === 'ok'
                  ? copy.backupIntegrityReady
                  : copy.backupIntegrityFailed}
              </strong>
              {importBackup.pending.integrity.reasons.length > 0 ? (
                <div className="compatibility-reason-list">
                  {importBackup.pending.integrity.reasons.map((reason) => (
                    <span className="badge warning" key={`${reason.code}-${reason.detail}`}>
                      {importBackup.getIntegrityReasonLabel(reason.code)}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="muted small">{copy.backupIntegrityHint}</span>
              )}
            </div>
          ) : null}
          {importBackup.pending.diffSummary ? (
            <div className="compatibility-block">
              <div className="backup-diff-header">
                <strong>{copy.backupDiffTitle}</strong>
                <div className="transport-row">
                  {(['txt', 'csv', 'json'] as const).map((format) => (
                    <button
                      className="tag-chip"
                      disabled={!importBackup.pending?.diffSummary?.available}
                      key={format}
                      onClick={() => importBackup.onExportDiff(format)}
                    >
                      {copy.backupDiffExportFormat(format.toUpperCase())}
                    </button>
                  ))}
                </div>
              </div>
              {importBackup.pending.diffSummary.available ? (
                <>
                  <span className="muted small">{copy.backupDiffHint}</span>
                  <label className="field">
                    <span>{copy.backupDiffSearch}</span>
                    <input
                      value={importBackup.diffSearch}
                      onChange={(event) => importBackup.onDiffSearchChange(event.target.value)}
                      placeholder={copy.backupDiffSearchPlaceholder}
                    />
                  </label>
                  <div className="transport-row">
                    <span className="muted small">{copy.backupDiffExcludedCount(importBackup.selectedItemCount)}</span>
                    <button
                      className="tag-chip"
                      disabled={importBackup.selectedItemCount === 0}
                      onClick={importBackup.onClearSelection}
                    >
                      {copy.backupDiffClearExcluded}
                    </button>
                  </div>
                  <div className="backup-diff-summary-card">
                    <strong>{copy.backupDiffTemplateTitle}</strong>
                    <span className="muted small">{copy.backupDiffTemplateHint}</span>
                    <label className="field">
                      <span>{copy.backupDiffTemplateName}</span>
                      <input
                        value={importBackup.backupTemplateName}
                        onChange={(event) => importBackup.onTemplateNameChange(event.target.value)}
                        placeholder={copy.backupDiffTemplatePlaceholder}
                      />
                    </label>
                    <div className="transport-row">
                      <button
                        className="tag-chip"
                        disabled={importBackup.selectedItemCount === 0 || importBackup.backupTemplateName.trim().length === 0}
                        onClick={importBackup.onSaveTemplate}
                      >
                        {copy.backupDiffTemplateSave}
                      </button>
                    </div>
                    {importBackup.templates.length > 0 ? (
                      <div className="backup-diff-summary-list">
                        {importBackup.templates.map((template) => (
                          <div className="transport-row" key={template.id}>
                            <button
                              className={`tag-chip ${template.isActive ? 'active' : ''}`}
                              onClick={template.onApply}
                            >
                              {template.name}
                            </button>
                            <button className="tag-chip" onClick={template.onDelete}>
                              {copy.backupDiffTemplateDelete}
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="muted small">{copy.backupDiffTemplateEmpty}</span>
                    )}
                  </div>
                  {importBackup.summaryNode}
                  <div className="backup-diff-list">{importBackup.diffGroupsNode}</div>
                </>
              ) : (
                <span className="muted small">{copy.backupDiffUnavailable}</span>
              )}
            </div>
          ) : null}
          {importBackup.requiresPassword ? (
            <>
              <p className="muted small">{copy.importBackupProtectedHint}</p>
              <label className="field">
                <span>{copy.backupPassword}</span>
                <input
                  type="password"
                  value={importBackup.password}
                  onChange={(event) => importBackup.onPasswordChange(event.target.value)}
                  placeholder={copy.importBackupPasswordRequired}
                />
              </label>
            </>
          ) : null}
          {importBackup.bootstrap ? (
            <p className="muted small">
              {copy.importBackupCurrentStats(
                importBackup.bootstrap.stats.cueCount,
                importBackup.bootstrap.stats.resourceCount,
                importBackup.bootstrap.stats.tagCount,
              )}
            </p>
          ) : null}
          <p className="muted small">{copy.importBackupConfirmHint}</p>
          <div className="transport-row">
            <button className="transport-button secondary" onClick={importBackup.onCancel}>
              {copy.importBackupCancel}
            </button>
            <button
              className="transport-button danger"
              disabled={
                importBackup.isBusy ||
                !importBackup.pending.manifest ||
                Boolean(importBackup.pending.compatibility?.blocked) ||
                Boolean(
                  importBackup.pending.integrity &&
                    importBackup.pending.integrity.level === 'blocked' &&
                    !importBackup.pending.integrity.valid,
                ) ||
                (importBackup.requiresPassword && importBackup.password.trim().length === 0)
              }
              onClick={importBackup.onSubmit}
            >
              {importBackup.pending.compatibility?.blocked ||
              importBackup.pending.integrity?.level === 'blocked' ||
              !importBackup.pending.manifest
                ? copy.importBackupBlocked
                : copy.importBackupSubmit}
            </button>
          </div>
        </ModalBackdrop>
      ) : null}

      {hotkeyRepair.isOpen ? (
        <ModalBackdrop onClose={hotkeyRepair.onCancel}>
          <p className="eyebrow">{copy.hotkeyRepair}</p>
          <h2>{copy.hotkeyRepairTitle}</h2>
          <p className="muted">{copy.hotkeyRepairHint}</p>
          <div className="repair-scope-list">
            {(['duplicate', 'failed', 'reserved', 'weak'] as const).map((scope) => {
              const count = hotkeyRepair.counts[scope]
              const labelMap = {
                duplicate: copy.hotkeyRepairScopeDuplicate,
                failed: copy.hotkeyRepairScopeFailed,
                reserved: copy.hotkeyRepairScopeReserved,
                weak: copy.hotkeyRepairScopeWeak,
              } as const

              return (
                <label className="repair-scope-item" key={scope}>
                  <input
                    type="checkbox"
                    checked={hotkeyRepair.scope[scope]}
                    disabled={count === 0}
                    onChange={() => hotkeyRepair.onToggleScope(scope)}
                  />
                  <span>{labelMap[scope]}</span>
                  <strong>{count}</strong>
                </label>
              )
            })}
          </div>
          <p className="muted small">{copy.hotkeyRepairSelection(hotkeyRepair.selectedCount)}</p>
          <div className="transport-row">
            <button className="transport-button secondary" onClick={hotkeyRepair.onCancel}>
              {copy.hotkeyRepairCancel}
            </button>
            <button
              className="transport-button secondary"
              disabled={hotkeyRepair.selectedCount === 0 || hotkeyRepair.isBusy}
              onClick={hotkeyRepair.onClear}
            >
              {copy.hotkeyRepairClear}
            </button>
            <button
              className="transport-button"
              disabled={hotkeyRepair.selectedCount === 0 || hotkeyRepair.isBusy}
              onClick={hotkeyRepair.onAssign}
            >
              {copy.hotkeyRepairAssign}
            </button>
          </div>
        </ModalBackdrop>
      ) : null}

      {cleanup.isOpen ? (
        <ModalBackdrop onClose={cleanup.onCancel}>
          <p className="eyebrow">{copy.cleanupUnused}</p>
          <h2>{copy.cleanupConfirmTitle}</h2>
          <p className="muted">{copy.cleanupConfirmBody}</p>
          <p className="muted">{copy.cleanupConfirmStats(cleanup.orphanCount)}</p>
          <div className="transport-row">
            <button className="transport-button secondary" onClick={cleanup.onCancel}>
              {copy.cleanupConfirmCancel}
            </button>
            <button className="transport-button danger" onClick={cleanup.onSubmit}>
              {copy.cleanupConfirmSubmit}
            </button>
          </div>
        </ModalBackdrop>
      ) : null}

      {deleteCue.isOpen && deleteCue.cue ? (
        <ModalBackdrop onClose={deleteCue.onCancel}>
          <p className="eyebrow">{copy.remove}</p>
          <h2>{copy.deleteConfirmTitle}</h2>
          <p className="muted">{copy.deleteConfirmBody(deleteCue.cue.name)}</p>
          <p className="muted small">{copy.deleteConfirmHint}</p>
          <div className="transport-row">
            <button className="transport-button secondary" onClick={deleteCue.onCancel}>
              {copy.deleteConfirmCancel}
            </button>
            <button className="transport-button danger" onClick={deleteCue.onSubmit}>
              {copy.deleteConfirmSubmit}
            </button>
          </div>
        </ModalBackdrop>
      ) : null}
    </>
  )
}
