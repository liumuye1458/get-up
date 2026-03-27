export type AdminSection = 'settings' | 'tags' | 'history' | 'backup' | 'diagnostics' | 'resources'
export type WorkspaceSection = 'library' | AdminSection

export type WorkspaceNavItem = {
  key: WorkspaceSection
  label: string
}

export type WorkspaceOutputDeviceOption = {
  deviceId: string
  label: string
}

export type WorkspaceShellState = {
  activeSection: WorkspaceSection
  search: string
  outputDevices: WorkspaceOutputDeviceOption[]
  selectedOutputDeviceId: string
  currentOutputDeviceLabel: string
  hotkeyAlerts: number
  runtimeIssues: number
  latestPlaybackName: string | null
  globalShortcutsEnabled: boolean
  globalVolume: number
  hasPlayback: boolean
  hasPlayingPlayback: boolean
  statusText: string
}
