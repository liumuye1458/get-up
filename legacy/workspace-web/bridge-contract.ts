export type WorkspaceBridgeCommandName =
  | 'workspace.bootstrap.read'
  | 'workspace.library.read'
  | 'workspace.settings.update'
  | 'workspace.cue.update'
  | 'workspace.cue.tags.replace'
  | 'workspace.cue.tags.batch'
  | 'workspace.cue.reorder'
  | 'workspace.cue.delete'
  | 'workspace.library.import'
  | 'workspace.library.cleanup'
  | 'workspace.tag.rename'
  | 'workspace.tag.delete'
  | 'workspace.tag.color.update'
  | 'workspace.tag.color.batch'
  | 'workspace.tag.merge'
  | 'workspace.tag.delete.batch'
  | 'workspace.tag.rename.rule'
  | 'workspace.history.list'
  | 'workspace.history.undo'
  | 'workspace.diagnostics.read'
  | 'workspace.shortcuts.repair'
  | 'workspace.shortcuts.assign'
  | 'workspace.backup.export'
  | 'workspace.backup.preview-import'
  | 'workspace.backup.import'
  | 'workspace.backup.diff.export'
  | 'workspace.host.pick-audio'
  | 'workspace.host.check-files'
  | 'workspace.host.open-floating'
  | 'workspace.host.focus-main'

export type WorkspaceBridgeEventName =
  | 'workspace.import.progress'
  | 'workspace.shortcut.triggered'
  | 'workspace.shell.state'
  | 'workspace.host.command'

export type WorkspaceBridgeRequest<TPayload = unknown> = {
  id: string
  command: WorkspaceBridgeCommandName
  payload: TPayload
}

export type WorkspaceBridgeSuccess<TResult = unknown> = {
  id: string
  ok: true
  result: TResult
}

export type WorkspaceBridgeFailure = {
  id: string
  ok: false
  error: {
    code: string
    message: string
  }
}

export type WorkspaceBridgeResponse<TResult = unknown> =
  | WorkspaceBridgeSuccess<TResult>
  | WorkspaceBridgeFailure

export type WorkspaceBridgeEvent<TPayload = unknown> = {
  event: WorkspaceBridgeEventName
  payload: TPayload
}

export const minimalShellCommands: WorkspaceBridgeCommandName[] = [
  'workspace.bootstrap.read',
  'workspace.library.read',
  'workspace.settings.update',
  'workspace.host.pick-audio',
  'workspace.host.check-files',
  'workspace.host.open-floating',
  'workspace.host.focus-main',
]

export const minimalBottomBarCommands: WorkspaceBridgeCommandName[] = [
  'workspace.settings.update',
]

export const minimalRealtimeEvents: WorkspaceBridgeEventName[] = [
  'workspace.import.progress',
  'workspace.shortcut.triggered',
  'workspace.shell.state',
  'workspace.host.command',
]
