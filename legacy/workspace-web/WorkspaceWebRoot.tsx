import '../index.css'
import '../i18n'
import '../App.css'
import App from '../App'
import { ensureWebView2WorkspaceHost } from './webview2-host'
import './workspace-web.css'

ensureWebView2WorkspaceHost()

export function WorkspaceWebRoot() {
  return (
    <div className="workspace-web-root" data-shell="workspace-web">
      <App />
    </div>
  )
}
