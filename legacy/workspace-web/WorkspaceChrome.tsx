import type { WorkspaceNavItem, WorkspaceSection } from './types'

type OutputDeviceOption = {
  deviceId: string
  label: string
}

export function WorkspaceDropOverlay({
  isVisible,
  title,
  hint,
}: {
  isVisible: boolean
  title: string
  hint: string
}) {
  if (!isVisible) {
    return null
  }

  return (
    <div className="drop-overlay" role="presentation">
      <div className="drop-overlay-card">
        <strong>{title}</strong>
        <span>{hint}</span>
      </div>
    </div>
  )
}

export function WorkspaceTopbar({
  brandLabel,
  title,
  search,
  searchPlaceholder,
  closeLabel,
  onSearchChange,
  onCloseWindow,
}: {
  brandLabel: string
  title: string
  search: string
  searchPlaceholder: string
  closeLabel: string
  onSearchChange: (value: string) => void
  onCloseWindow: () => void
}) {
  return (
    <header className="frame-topbar">
      <div className="frame-topbar-brand">
        <p className="eyebrow">{brandLabel}</p>
        <h1 className="frame-title">{title}</h1>
      </div>
      <div className="frame-topbar-search">
        <input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={searchPlaceholder}
        />
      </div>
      <div className="frame-topbar-actions">
        <button className="window-control" type="button" onClick={onCloseWindow} aria-label={closeLabel}>`r`n          X`r`n        </button>
      </div>
    </header>
  )
}

export function WorkspaceSidebar({
  managementLabel,
  navItems,
  activeSection,
  onSectionChange,
}: {
  managementLabel: string
  navItems: WorkspaceNavItem[]
  activeSection: WorkspaceSection
  onSectionChange: (section: WorkspaceSection) => void
}) {
  return (
    <aside className="frame-sidebar">
      <nav className="sidebar-nav" aria-label={managementLabel}>
        {navItems.map((item) => (
          <button
            key={item.key}
            className={`sidebar-nav-item ${activeSection === item.key ? 'active' : ''}`}
            onClick={() => onSectionChange(item.key)}
          >
            {item.label}
          </button>
        ))}
      </nav>
    </aside>
  )
}

export function WorkspaceDock({
  outputDeviceLabel,
  outputDevices,
  selectedOutputDeviceId,
  globalShortcutsEnabled,
  globalShortcutsLabel,
  playbackToggleLabel,
  stopAllLabel,
  currentOutputDeviceLabel,
  hotkeyAlertsLabel,
  runtimeIssuesLabel,
  masterVolumeLabel,
  statusText,
  latestPlaybackLabel,
  globalVolume,
  hasPlayback,
  onOutputDeviceChange,
  onToggleGlobalShortcuts,
  onTogglePlaybackPause,
  onStopAllPlayback,
  onVolumeChange,
}: {
  outputDeviceLabel: string
  outputDevices: OutputDeviceOption[]
  selectedOutputDeviceId: string
  globalShortcutsEnabled: boolean
  globalShortcutsLabel: string
  playbackToggleLabel: string
  stopAllLabel: string
  currentOutputDeviceLabel: string
  hotkeyAlertsLabel: string
  runtimeIssuesLabel: string
  masterVolumeLabel: string
  statusText: string
  latestPlaybackLabel: string | null
  globalVolume: number
  hasPlayback: boolean
  onOutputDeviceChange: (deviceId: string) => void
  onToggleGlobalShortcuts: () => void
  onTogglePlaybackPause: () => void
  onStopAllPlayback: () => void
  onVolumeChange: (value: number) => void
}) {
  return (
    <footer className="control-dock">
      <div className="control-dock-group">
        <label className="dock-select">
          <span>{outputDeviceLabel}</span>
          <select
            value={selectedOutputDeviceId}
            onChange={(event) => onOutputDeviceChange(event.target.value)}
          >
            {outputDevices.map((device) => (
              <option key={device.deviceId || 'default'} value={device.deviceId}>
                {device.label}
              </option>
            ))}
          </select>
        </label>
        <button
          className={`dock-toggle ${globalShortcutsEnabled ? 'active' : ''}`}
          onClick={onToggleGlobalShortcuts}
        >
          <span>{globalShortcutsLabel}</span>
          <strong>Shift+Z</strong>
        </button>
      </div>
      <div className="control-dock-group">
        <button className="transport-button secondary" disabled={!hasPlayback} onClick={onTogglePlaybackPause}>
          {playbackToggleLabel}
        </button>
        <span className="dock-hotkey-pill">Shift+Space</span>
        <button className="transport-button secondary" disabled={!hasPlayback} onClick={onStopAllPlayback}>
          {stopAllLabel}
        </button>
      </div>
      <div className="control-dock-group control-dock-status">
        <span className="mini-stat">{currentOutputDeviceLabel}</span>
        <span className="mini-stat">{hotkeyAlertsLabel}</span>
        <span className="mini-stat">{runtimeIssuesLabel}</span>
        {latestPlaybackLabel ? <span className="muted small">{latestPlaybackLabel}</span> : null}
      </div>
      <div className="control-dock-group control-dock-volume">
        <label className="stage-volume-control">
          <span>{masterVolumeLabel}</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={globalVolume}
            onChange={(event) => onVolumeChange(Number(event.target.value))}
          />
          <strong>{Math.round(globalVolume * 100)}</strong>
        </label>
        <span className="muted small">{statusText}</span>
      </div>
    </footer>
  )
}
