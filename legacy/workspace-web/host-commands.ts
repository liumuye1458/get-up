import type { WorkspaceSection } from './types'

export type WorkspaceHostCommand =
  | {
      command: 'set-search'
      payload: {
        search: string
      }
    }
  | {
      command: 'set-active-section'
      payload: {
        section: WorkspaceSection
      }
    }
  | {
      command: 'set-output-device'
      payload: {
        deviceId: string
      }
    }
  | {
      command: 'toggle-global-shortcuts'
    }
  | {
      command: 'toggle-playback-pause'
    }
  | {
      command: 'stop-all-playback'
    }
  | {
      command: 'set-global-volume'
      payload: {
        value: number
      }
    }

declare global {
  interface WindowEventMap {
    'codex:workspace-host-command': CustomEvent<WorkspaceHostCommand>
  }
}

export function dispatchWorkspaceHostCommand(command: WorkspaceHostCommand) {
  if (typeof window === 'undefined') {
    return
  }

  window.dispatchEvent(new CustomEvent('codex:workspace-host-command', { detail: command }))
}

export function subscribeWorkspaceHostCommands(
  listener: (command: WorkspaceHostCommand) => void,
) {
  if (typeof window === 'undefined') {
    return () => {}
  }

  const handler = (event: WindowEventMap['codex:workspace-host-command']) => {
    listener(event.detail)
  }

  window.addEventListener('codex:workspace-host-command', handler)
  return () => window.removeEventListener('codex:workspace-host-command', handler)
}
