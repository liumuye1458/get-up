import type { ComponentProps } from 'react'
import { AdminWorkspacePage } from '../AdminWorkspacePage'
import { AdminWorkspaceContent } from './AdminWorkspaceContent'

type AdminWorkspacePageProps = ComponentProps<typeof AdminWorkspacePage>
type AdminWorkspaceContentProps = ComponentProps<typeof AdminWorkspaceContent>

type AdminWorkspaceViewProps = {
  page: Omit<AdminWorkspacePageProps, 'content'>
  content: AdminWorkspaceContentProps
}

export function AdminWorkspaceView({ page, content }: AdminWorkspaceViewProps) {
  return (
    <AdminWorkspacePage
      activeSection={page.activeSection}
      content={<AdminWorkspaceContent {...content} />}
    />
  )
}
