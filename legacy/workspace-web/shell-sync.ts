import type { WorkspaceShellState } from './types'

declare global {
  interface Window {
    __CODEX_WORKSPACE_SHELL_STATE__?: WorkspaceShellState
  }
}

export function publishWorkspaceShellState(state: WorkspaceShellState) {
  if (typeof window === 'undefined') {
    return
  }

  window.__CODEX_WORKSPACE_SHELL_STATE__ = state
  window.dispatchEvent(new CustomEvent('codex:workspace-shell-state', { detail: state }))
}
