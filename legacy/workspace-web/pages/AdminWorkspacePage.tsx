import type { ReactNode } from 'react'
import type { WorkspaceSection } from '../types'

type AdminWorkspacePageProps = {
  activeSection: WorkspaceSection
  content: ReactNode
}

export function AdminWorkspacePage({ activeSection, content }: AdminWorkspacePageProps) {
  return (
    <div className="workspace-admin-page" data-section={activeSection}>
      {content}
    </div>
  )
}
