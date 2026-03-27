# Workspace Web Transition

`workspace-web` is now legacy transition material.

It may remain in the repository for reference, migration diffing, or temporary reuse of domain/UI ideas, but it is no longer the product architecture.

## Current Decision

- The shipping application is a native WinUI desktop app.
- Fixed shell layout is owned by native XAML, not by embedded web content.
- Stable desktop interaction takes priority over browser-style flexibility.

## Practical Effect

- Do not plan new features around WebView2 containers.
- Do not treat React/Vite workspace content as the main app.
- Do not route core playback, import, editor, or navigation flows through a browser host.

## Allowed Use of `workspace-web`

- Reference implementation during migration.
- Isolated experiments that do not redefine the shipping architecture.
- Temporary comparison material while native screens are being completed.

## Not Allowed as Primary Path

- Shipping the main board inside an embedded browser.
- Reintroducing shell/navigation ownership into web code.
- Depending on web runtime behavior for layout stability.
