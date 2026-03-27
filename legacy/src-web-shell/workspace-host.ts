import type { WorkspaceHostApi } from './electron'

type WindowWithWebView2Host = Window & {
  chrome?: {
    webview?: unknown
  }
}

function resolveWorkspaceHost(): WorkspaceHostApi {
  if (typeof window === 'undefined') {
    throw new Error('Workspace host bridge is unavailable outside the browser environment.')
  }

  const host = window.__CODEX_WORKSPACE_HOST__ ?? window.desktopApi

  if (!host) {
    throw new Error('Workspace host bridge is unavailable.')
  }

  return host
}

export const workspaceHost = new Proxy(
  {},
  {
    get(_target, property) {
      const host = resolveWorkspaceHost()
      const value = Reflect.get(host, property)

      if (typeof value === 'function') {
        return value.bind(host)
      }

      return value
    },
  },
) as WorkspaceHostApi

export function getWorkspaceHost() {
  return resolveWorkspaceHost()
}

export function isHostedByNativeWorkspaceShell() {
  if (typeof window === 'undefined') {
    return false
  }

  return Boolean((window as WindowWithWebView2Host).chrome?.webview)
}
