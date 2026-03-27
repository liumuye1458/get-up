import type {
  AppSettings,
  BackupDiffExportFormat,
  BackupImportSelection,
  CuePatch,
  HotkeyRepairAssignment,
  HotkeyRepairMode,
  HotkeyRepairScope,
  ImportProgress,
  TagRenameRule,
  WorkspaceHostApi,
} from '../electron'
import type {
  WorkspaceBridgeCommandName,
  WorkspaceBridgeEvent,
  WorkspaceBridgeRequest,
  WorkspaceBridgeResponse,
} from './bridge-contract'
import { dispatchWorkspaceHostCommand } from './host-commands'

type ChromeWebView = {
  postMessage: (message: string) => void
  addEventListener: (
    type: 'message',
    listener: (event: { data: string }) => void,
  ) => void
  removeEventListener: (
    type: 'message',
    listener: (event: { data: string }) => void,
  ) => void
}

type WindowWithWebView2 = Window & {
  chrome?: {
    webview?: ChromeWebView
  }
}

function getWebView2Transport() {
  if (typeof window === 'undefined') {
    return null
  }

  const webview = (window as WindowWithWebView2).chrome?.webview
  return webview ?? null
}

function createBridgeRequest<TPayload>(
  command: WorkspaceBridgeCommandName,
  payload: TPayload,
): WorkspaceBridgeRequest<TPayload> {
  return {
    id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    command,
    payload,
  }
}

function isBridgeResponse(value: unknown): value is WorkspaceBridgeResponse {
  if (!value || typeof value !== 'object') {
    return false
  }

  return 'id' in value && 'ok' in value
}

function isBridgeEvent(value: unknown): value is WorkspaceBridgeEvent {
  if (!value || typeof value !== 'object') {
    return false
  }

  return 'event' in value && 'payload' in value
}

type ImportProgressListener = (progress: ImportProgress) => void
type ShortcutListener = (soundId: string) => void

export function createWebView2WorkspaceHost(): WorkspaceHostApi | null {
  const transport = getWebView2Transport()

  if (!transport) {
    return null
  }

  const webviewTransport = transport

  const pending = new Map<
    string,
    {
      resolve: (result: unknown) => void
      reject: (error: Error) => void
    }
  >()
  const importProgressListeners = new Set<ImportProgressListener>()
  const shortcutListeners = new Set<ShortcutListener>()

  const onMessage = (event: { data: string }) => {
    let payload: unknown

    try {
      payload = JSON.parse(event.data)
    } catch {
      return
    }

    if (isBridgeResponse(payload)) {
      const resolver = pending.get(payload.id)
      if (!resolver) {
        return
      }

      pending.delete(payload.id)

      if (payload.ok) {
        resolver.resolve(payload.result)
        return
      }

      resolver.reject(new Error(payload.error.message))
      return
    }

    if (!isBridgeEvent(payload)) {
      return
    }

    if (payload.event === 'workspace.import.progress') {
      importProgressListeners.forEach((listener) => listener(payload.payload as ImportProgress))
      return
    }

    if (payload.event === 'workspace.shortcut.triggered') {
      const shortcutPayload = payload.payload as { soundId?: string }
      if (shortcutPayload.soundId) {
        shortcutListeners.forEach((listener) => listener(shortcutPayload.soundId!))
      }

      return
    }

    if (payload.event === 'workspace.host.command') {
      dispatchWorkspaceHostCommand(payload.payload as never)
    }
  }

  transport.addEventListener('message', onMessage)

  async function invoke<TResult, TPayload = unknown>(
    command: WorkspaceBridgeCommandName,
    payload: TPayload,
  ): Promise<TResult> {
    const request = createBridgeRequest(command, payload)

    return new Promise<TResult>((resolve, reject) => {
      pending.set(request.id, {
        resolve: resolve as (result: unknown) => void,
        reject,
      })
      webviewTransport.postMessage(JSON.stringify(request))
    })
  }

  const host: WorkspaceHostApi = {
    getBootstrapSnapshot: () => invoke('workspace.bootstrap.read', null),
    getLibrarySnapshot: () => invoke('workspace.library.read', null),
    importAudioPaths: (paths) => invoke('workspace.library.import', { paths }),
    createStarterPack: () => invoke('workspace.library.import', { createStarterPack: true }),
    updateSettings: (patch: Partial<AppSettings>) => invoke('workspace.settings.update', { patch }),
    updateCue: (cueId: string, patch: CuePatch) => invoke('workspace.cue.update', { cueId, patch }),
    setCueTags: (cueId: string, tagNames: string[]) =>
      invoke('workspace.cue.tags.replace', { cueId, tagNames }),
    batchCueTags: (cueIds: string[], tagNames: string[], mode) =>
      invoke('workspace.cue.tags.batch', { cueIds, tagNames, mode }),
    reorderCues: (orderedCueIds: string[]) => invoke('workspace.cue.reorder', { orderedCueIds }),
    deleteCue: (cueId: string) => invoke('workspace.cue.delete', { cueId }),
    updateTagColor: (tagId: string, color: string | null) =>
      invoke('workspace.tag.color.update', { tagId, color }),
    batchUpdateTagColor: (tagIds: string[], color: string | null) =>
      invoke('workspace.tag.color.batch', { tagIds, color }),
    renameTag: (tagId: string, nextName: string) =>
      invoke('workspace.tag.rename', { tagId, nextName }),
    deleteTag: (tagId: string) => invoke('workspace.tag.delete', { tagId }),
    batchDeleteTags: (tagIds: string[]) => invoke('workspace.tag.delete.batch', { tagIds }),
    batchMergeTags: (tagIds: string[], targetName: string) =>
      invoke('workspace.tag.merge', { tagIds, targetName }),
    batchRenameTagsByRule: (tagIds: string[], rule: TagRenameRule) =>
      invoke('workspace.tag.rename.rule', { tagIds, rule }),
    cleanupUnusedLibrary: () => invoke('workspace.library.cleanup', null),
    listHistory: () => invoke('workspace.history.list', null),
    undoHistoryEntry: (entryId: string) => invoke('workspace.history.undo', { entryId }),
    getShortcutDiagnostics: () => invoke('workspace.diagnostics.read', null),
    repairShortcutConflicts: (options: { mode: HotkeyRepairMode; scopes: HotkeyRepairScope }) =>
      invoke('workspace.shortcuts.repair', options),
    applyShortcutAssignments: (assignments: HotkeyRepairAssignment[]) =>
      invoke('workspace.shortcuts.assign', { assignments }),
    exportLibraryBackup: (password?: string) =>
      invoke('workspace.backup.export', { password }),
    previewLibraryBackupImport: () => invoke('workspace.backup.preview-import', null),
    importLibraryBackup: (
      sourcePath: string,
      password?: string,
      selection?: BackupImportSelection,
    ) => invoke('workspace.backup.import', { sourcePath, password, selection }),
    exportBackupDiffReport: (payload: { format: BackupDiffExportFormat; content: string }) =>
      invoke('workspace.backup.diff.export', payload),
    openFloatingControlWindow: () => invoke('workspace.host.open-floating', null),
    focusMainWindow: () => invoke('workspace.host.focus-main', null),
    pickAudioFiles: () => invoke('workspace.host.pick-audio', null),
    checkFilesExist: (paths: string[]) => invoke('workspace.host.check-files', { paths }),
    getPathForFile: (file: File) =>
      (file as File & { path?: string; webkitRelativePath?: string }).path ??
      file.webkitRelativePath ??
      '',
    onImportProgress: (callback) => {
      importProgressListeners.add(callback)
      return () => importProgressListeners.delete(callback)
    },
    onShortcutTriggered: (callback) => {
      shortcutListeners.add(callback)
      return () => shortcutListeners.delete(callback)
    },
  }

  return host
}

export function ensureWebView2WorkspaceHost() {
  if (typeof window === 'undefined') {
    return null
  }

  if (window.__CODEX_WORKSPACE_HOST__) {
    return window.__CODEX_WORKSPACE_HOST__
  }

  const host = createWebView2WorkspaceHost()

  if (!host) {
    return null
  }

  window.__CODEX_WORKSPACE_HOST__ = host
  return host
}
