import type { ReactNode } from 'react'
import {
  LibraryBulkActionsPanel,
  LibraryCardGridPanel,
  LibraryImportFeedbackPanel,
  LibraryToolbarPanel,
} from './library'
import type { RefObject } from 'react'

type LibraryWorkspacePageProps = {
  toolbar: {
    header: ReactNode
    actions: ReactNode
    filters: ReactNode
    meta: ReactNode
  }
  feedback?: {
    progressPanel?: ReactNode
    warnings?: ReactNode
    report?: ReactNode
  }
  bulkPanel?: ReactNode
  grid: {
    ref: RefObject<HTMLElement | null>
    virtual: boolean
    content: ReactNode
  }
}

export function LibraryWorkspacePage({
  toolbar,
  feedback,
  bulkPanel,
  grid,
}: LibraryWorkspacePageProps) {
  return (
    <>
      <LibraryToolbarPanel
        header={toolbar.header}
        actions={toolbar.actions}
        filters={toolbar.filters}
        meta={toolbar.meta}
      />
      <LibraryImportFeedbackPanel
        progressPanel={feedback?.progressPanel}
        warnings={feedback?.warnings}
        report={feedback?.report}
      />
      <LibraryBulkActionsPanel>{bulkPanel}</LibraryBulkActionsPanel>
      <LibraryCardGridPanel gridRef={grid.ref} virtual={grid.virtual}>
        {grid.content}
      </LibraryCardGridPanel>
    </>
  )
}
