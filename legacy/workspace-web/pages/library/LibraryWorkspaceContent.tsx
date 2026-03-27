import type { ComponentProps } from 'react'
import { LibraryWorkspacePage } from '../LibraryWorkspacePage'
import { LibraryCueGrid } from './LibraryCueGrid'

type LibraryWorkspacePageProps = ComponentProps<typeof LibraryWorkspacePage>
type LibraryCueGridProps = ComponentProps<typeof LibraryCueGrid>

type LibraryWorkspaceContentProps = {
  page: Omit<LibraryWorkspacePageProps, 'grid'>
  grid: Omit<LibraryWorkspacePageProps['grid'], 'content'>
  cueGrid: LibraryCueGridProps
}

export function LibraryWorkspaceContent({
  page,
  grid,
  cueGrid,
}: LibraryWorkspaceContentProps) {
  return (
    <LibraryWorkspacePage
      toolbar={page.toolbar}
      feedback={page.feedback}
      bulkPanel={page.bulkPanel}
      grid={{
        ...grid,
        content: <LibraryCueGrid {...cueGrid} />,
      }}
    />
  )
}
