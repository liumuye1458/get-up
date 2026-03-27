import { useCopy } from '../../use-copy'

type CopySet = ReturnType<typeof useCopy>

type FloatingControlViewProps = {
  copy: CopySet
  globalShortcutsEnabled: boolean
  hotkeyAlertCount: number
  missingFilesCount: number
  currentOutputDeviceLabel: string
  currentStatusText: string
  onFocusMainWindow: () => void
  onToggleGlobalShortcuts: (enabled: boolean) => void
}

export function FloatingControlView({
  copy,
  globalShortcutsEnabled,
  hotkeyAlertCount,
  missingFilesCount,
  currentOutputDeviceLabel,
  currentStatusText,
  onFocusMainWindow,
  onToggleGlobalShortcuts,
}: FloatingControlViewProps) {
  return (
    <div className="floating-control-shell">
      <div className="floating-control-card">
        <div className="floating-control-header">
          <div>
            <p className="eyebrow">{copy.floatingControl}</p>
            <h1>{copy.floatingControl}</h1>
            <p className="muted small">{copy.floatingControlHint}</p>
          </div>
          <button className="tag-chip" onClick={onFocusMainWindow}>
            {copy.showMainBoard}
          </button>
        </div>

        <label className="toggle-row floating-toggle-row">
          <input
            type="checkbox"
            checked={globalShortcutsEnabled}
            onChange={(event) => onToggleGlobalShortcuts(event.target.checked)}
          />
          <span>{copy.globalShortcutsEnabled}</span>
        </label>

        <div className="floating-status-grid">
          <span className={`mini-stat ${globalShortcutsEnabled ? 'active' : ''}`}>
            {copy.globalShortcutsEnabled}
          </span>
          <span className="mini-stat">{copy.hotkeyAlerts(hotkeyAlertCount)}</span>
          <span className="mini-stat">{copy.missingCount(missingFilesCount)}</span>
          <span className="mini-stat">{currentOutputDeviceLabel}</span>
        </div>

        <div className="floating-mode-row">
          <span className="muted small">{currentStatusText}</span>
        </div>
      </div>
    </div>
  )
}
