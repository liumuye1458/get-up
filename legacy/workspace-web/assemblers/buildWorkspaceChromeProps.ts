import type { ComponentProps } from 'react'
import { useCopy } from '../../use-copy'
import { WorkspaceDock, WorkspaceSidebar, WorkspaceTopbar } from '../WorkspaceChrome'
import type { WorkspaceSection, WorkspaceShellState } from '../types'

type CopySet = ReturnType<typeof useCopy>
type WorkspaceTopbarProps = ComponentProps<typeof WorkspaceTopbar>
type WorkspaceSidebarProps = ComponentProps<typeof WorkspaceSidebar>
type WorkspaceDockProps = ComponentProps<typeof WorkspaceDock>

export type BuildWorkspaceChromePropsArgs = {
  copy: CopySet
  activeSection: WorkspaceSection
  search: string
  currentOutputDeviceLabel: string
  hotkeyAlertCount: number
  runtimeIssueCount: number
  latestPlaybackName: string | null
  globalShortcutsEnabled: boolean
  globalVolume: number
  hasPlayback: boolean
  hasPlayingPlayback: boolean
  statusText: string
  outputDevices: Array<{ deviceId: string; label: string }>
  selectedOutputDeviceId: string
  onSearchChange: (value: string) => void
  onCloseWindow: () => void
  onSectionChange: (section: WorkspaceSection) => void
  onOutputDeviceChange: (deviceId: string) => void
  onToggleGlobalShortcuts: () => void
  onTogglePlaybackPause: () => void
  onStopAllPlayback: () => void
  onVolumeChange: (value: number) => void
}

export function buildWorkspaceChromeProps({
  copy: m,
  activeSection,
  search,
  currentOutputDeviceLabel,
  hotkeyAlertCount,
  runtimeIssueCount,
  latestPlaybackName,
  globalShortcutsEnabled,
  globalVolume,
  hasPlayback,
  hasPlayingPlayback,
  statusText,
  outputDevices,
  selectedOutputDeviceId,
  onSearchChange,
  onCloseWindow,
  onSectionChange,
  onOutputDeviceChange,
  onToggleGlobalShortcuts,
  onTogglePlaybackPause,
  onStopAllPlayback,
  onVolumeChange,
}: BuildWorkspaceChromePropsArgs): {
  shellState: WorkspaceShellState
  topbar: WorkspaceTopbarProps
  sidebar: WorkspaceSidebarProps
  dock: WorkspaceDockProps
} {
  return {
    shellState: {
      activeSection,
      search,
      outputDevices,
      selectedOutputDeviceId,
      currentOutputDeviceLabel,
      hotkeyAlerts: hotkeyAlertCount,
      runtimeIssues: runtimeIssueCount,
      latestPlaybackName,
      globalShortcutsEnabled,
      globalVolume,
      hasPlayback,
      hasPlayingPlayback,
      statusText,
    },
    topbar: {
      brandLabel: m.brand,
      title: m.title,
      search,
      searchPlaceholder: m.searchPlaceholder,
      closeLabel: m.closePanel,
      onSearchChange,
      onCloseWindow,
    },
    sidebar: {
      managementLabel: m.managementCenter,
      navItems: [
        { key: 'library', label: m.library },
        { key: 'tags', label: m.tagManager },
        { key: 'backup', label: m.backup },
        { key: 'history', label: m.history },
        { key: 'diagnostics', label: m.diagnostics },
        { key: 'resources', label: m.resourceMaintenance },
        { key: 'settings', label: m.settings },
      ],
      activeSection,
      onSectionChange,
    },
    dock: {
      outputDeviceLabel: m.outputDevice,
      outputDevices,
      selectedOutputDeviceId,
      globalShortcutsEnabled,
      globalShortcutsLabel: m.globalShortcutsEnabled,
      playbackToggleLabel: hasPlayingPlayback ? m.pauseAll : m.resumeAll,
      stopAllLabel: m.stopAll,
      currentOutputDeviceLabel,
      hotkeyAlertsLabel: m.hotkeyAlerts(hotkeyAlertCount),
      runtimeIssuesLabel: m.runtimeIssues(runtimeIssueCount),
      masterVolumeLabel: m.masterVolume,
      statusText,
      latestPlaybackLabel: latestPlaybackName ? m.playing(latestPlaybackName) : null,
      globalVolume,
      hasPlayback,
      onOutputDeviceChange,
      onToggleGlobalShortcuts,
      onTogglePlaybackPause,
      onStopAllPlayback,
      onVolumeChange,
    },
  }
}
