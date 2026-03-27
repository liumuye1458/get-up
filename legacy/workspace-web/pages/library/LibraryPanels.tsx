import type { ReactNode, RefObject } from 'react'

export function LibraryToolbarPanel({
  header,
  actions,
  filters,
  meta,
}: {
  header: ReactNode
  actions: ReactNode
  filters: ReactNode
  meta: ReactNode
}) {
  return (
    <section className="board-toolbar panel compact">
      <div className="board-toolbar-row">
        <div>{header}</div>
        <div className="header-actions">{actions}</div>
      </div>
      <div className="board-toolbar-row">
        <section className="stage-filterbar">{filters}</section>
        <div className="stage-meta-actions">{meta}</div>
      </div>
    </section>
  )
}

export function LibraryImportFeedbackPanel({
  progressPanel,
  warnings,
  report,
}: {
  progressPanel?: ReactNode
  warnings?: ReactNode
  report?: ReactNode
}) {
  return (
    <>
      {progressPanel ?? null}
      {warnings ?? null}
      {report ?? null}
    </>
  )
}

export function LibraryBulkActionsPanel({ children }: { children?: ReactNode }) {
  return <>{children ?? null}</>
}

export function LibraryCardGridPanel({
  gridRef,
  virtual,
  children,
}: {
  gridRef: RefObject<HTMLElement | null>
  virtual: boolean
  children: ReactNode
}) {
  return (
    <section
      ref={gridRef as RefObject<HTMLElement>}
      className={`sound-grid stage-grid ${virtual ? 'virtual' : ''}`}
    >
      {children}
    </section>
  )
}
