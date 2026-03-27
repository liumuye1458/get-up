(function () {
  if (typeof window === 'undefined' || !window.chrome || !window.chrome.webview) {
    return;
  }

  function publishShellState(payload) {
    try {
      window.chrome.webview.postMessage(
        JSON.stringify({
          event: 'workspace.shell.state',
          payload,
        }),
      );
    } catch {
      // Ignore bootstrap forwarding failures in the placeholder stage.
    }
  }

  window.addEventListener('codex:workspace-shell-state', function (event) {
    publishShellState(event.detail ?? null);
  });

  if (window.__CODEX_WORKSPACE_SHELL_STATE__) {
    publishShellState(window.__CODEX_WORKSPACE_SHELL_STATE__);
  }
})();
