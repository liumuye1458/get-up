import type { MouseEvent } from 'react'
import type { LibraryCueCard } from '../../../electron'

type CueGridCopy = {
  noHotkey: string
  nowPlaying: string
  untagged: string
  missingFile: string
  duplicateHotkey: string
  rejectedHotkey: string
  reservedHotkey: string
  weakHotkey: string
  editCue: string
  stopAll: string
  onboardingTitle: string
  onboardingBody: string
  onboardingStepImport: string
  onboardingStepEdit: string
  onboardingStepTrigger: string
  importAudio: string
  createStarterPack: string
  noSoundsTitle: string
  noSoundsBody: string
}

type VirtualRow = {
  rowIndex: number
  cues: LibraryCueCard[]
}

type VirtualLayout = {
  columns: number
  rowHeight: number
  totalHeight: number
  rows: VirtualRow[]
}

type CueCardState = {
  selectedCueId: string | null
  selectedCueIds: Set<string>
  missingPaths: Set<string>
  duplicateHotkeys: Set<string>
  failedHotkeys: Set<string>
  reservedHotkeys: Set<string>
  weakHotkeys: Set<string>
  activePlaybackIds: Set<string>
}

type LibraryCueGridProps = {
  cues: LibraryCueCard[]
  displayedCues: LibraryCueCard[]
  virtual: boolean
  virtualLayout: VirtualLayout
  cardState: CueCardState
  copy: CueGridCopy
  isLibraryEmpty: boolean
  isImporting: boolean
  onCuePress: (cue: LibraryCueCard, appendSelection: boolean) => void
  onCueEdit: (cue: LibraryCueCard) => void
  onCueStop: (cueId: string) => void
  onCueDragStart: (cueId: string) => void
  onCueDrop: (targetCueId: string) => void
  onCueDragEnd: () => void
  onOpenFiles: () => void
  onCreateStarterPack: () => void
}

function LibraryCueCardButton({
  cue,
  state,
  copy,
  onCuePress,
  onCueEdit,
  onCueStop,
  onCueDragStart,
  onCueDrop,
  onCueDragEnd,
}: {
  cue: LibraryCueCard
  state: CueCardState
  copy: CueGridCopy
  onCuePress: (cue: LibraryCueCard, appendSelection: boolean) => void
  onCueEdit: (cue: LibraryCueCard) => void
  onCueStop: (cueId: string) => void
  onCueDragStart: (cueId: string) => void
  onCueDrop: (targetCueId: string) => void
  onCueDragEnd: () => void
}) {
  const isMissing = state.missingPaths.has(cue.resource.absolutePath)
  const duplicateHotkey = state.duplicateHotkeys.has(cue.id)
  const failedHotkey = state.failedHotkeys.has(cue.id)
  const reservedHotkey = state.reservedHotkeys.has(cue.id)
  const weakHotkey = state.weakHotkeys.has(cue.id)
  const isPlaying = state.activePlaybackIds.has(cue.id)
  const visibleStatusCount =
    Number(isPlaying) +
    Number(isMissing) +
    Number(duplicateHotkey || failedHotkey || reservedHotkey || weakHotkey)

  const stopAndEdit = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation()
    onCueEdit(cue)
  }

  const stopPlayback = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation()
    onCueStop(cue.id)
  }

  return (
    <button
      key={cue.id}
      draggable
      className={`sound-card ${state.selectedCueId === cue.id ? 'selected' : ''} ${
        state.selectedCueIds.has(cue.id) ? 'multi-selected' : ''
      } ${isMissing ? 'missing' : ''} ${isPlaying ? 'playing' : ''}`}
      onClick={(event) => onCuePress(cue, event.ctrlKey || event.metaKey)}
      onContextMenu={(event) => {
        event.preventDefault()
        onCueEdit(cue)
      }}
      onDragStart={() => onCueDragStart(cue.id)}
      onDragOver={(event) => event.preventDefault()}
      onDrop={() => onCueDrop(cue.id)}
      onDragEnd={onCueDragEnd}
    >
      <div className="sound-card-top">
        <span className="sound-name">{cue.name}</span>
        <span className="sound-hotkey-pill">{cue.hotkey || copy.noHotkey}</span>
      </div>
      <div className="sound-card-bottom">
        <div className="card-status-row">
          {isPlaying ? <span className="badge ok">{copy.nowPlaying}</span> : null}
          {!isPlaying && visibleStatusCount === 0 ? (
            <span className="sound-card-hint">{cue.tags[0]?.name ?? copy.untagged}</span>
          ) : null}
        </div>
        <div className="card-badges">
          {isMissing ? <span className="badge danger">{copy.missingFile}</span> : null}
          {duplicateHotkey ? <span className="badge warning">{copy.duplicateHotkey}</span> : null}
          {failedHotkey ? <span className="badge warning">{copy.rejectedHotkey}</span> : null}
          {reservedHotkey ? <span className="badge warning">{copy.reservedHotkey}</span> : null}
          {weakHotkey ? <span className="badge warning">{copy.weakHotkey}</span> : null}
        </div>
        <div className="sound-card-actions">
          <button className="tag-chip" onClick={stopAndEdit}>
            {copy.editCue}
          </button>
          {isPlaying ? (
            <button className="tag-chip" onClick={stopPlayback}>
              {copy.stopAll}
            </button>
          ) : null}
        </div>
      </div>
    </button>
  )
}

function renderCueCardRow(
  cues: LibraryCueCard[],
  state: CueCardState,
  copy: CueGridCopy,
  handlers: {
    onCuePress: (cue: LibraryCueCard, appendSelection: boolean) => void
    onCueEdit: (cue: LibraryCueCard) => void
    onCueStop: (cueId: string) => void
    onCueDragStart: (cueId: string) => void
    onCueDrop: (targetCueId: string) => void
    onCueDragEnd: () => void
  },
) {
  return cues.map((cue) => (
    <LibraryCueCardButton
      key={cue.id}
      cue={cue}
      state={state}
      copy={copy}
      onCuePress={handlers.onCuePress}
      onCueEdit={handlers.onCueEdit}
      onCueStop={handlers.onCueStop}
      onCueDragStart={handlers.onCueDragStart}
      onCueDrop={handlers.onCueDrop}
      onCueDragEnd={handlers.onCueDragEnd}
    />
  ))
}

function EmptyLibraryState({
  isLibraryEmpty,
  isImporting,
  copy,
  onOpenFiles,
  onCreateStarterPack,
}: {
  isLibraryEmpty: boolean
  isImporting: boolean
  copy: CueGridCopy
  onOpenFiles: () => void
  onCreateStarterPack: () => void
}) {
  return (
    <div className="empty-state">
      {isLibraryEmpty ? (
        <>
          <h3>{copy.onboardingTitle}</h3>
          <p>{copy.onboardingBody}</p>
          <div className="onboarding-list">
            <span className="mini-tag">{copy.onboardingStepImport}</span>
            <span className="mini-tag">{copy.onboardingStepEdit}</span>
            <span className="mini-tag">{copy.onboardingStepTrigger}</span>
          </div>
          <div className="transport-row">
            <button className="transport-button" disabled={isImporting} onClick={onOpenFiles}>
              {copy.importAudio}
            </button>
            <button className="transport-button secondary" disabled={isImporting} onClick={onCreateStarterPack}>
              {copy.createStarterPack}
            </button>
          </div>
        </>
      ) : (
        <>
          <h3>{copy.noSoundsTitle}</h3>
          <p>{copy.noSoundsBody}</p>
        </>
      )}
    </div>
  )
}

export function LibraryCueGrid({
  cues,
  displayedCues,
  virtual,
  virtualLayout,
  cardState,
  copy,
  isLibraryEmpty,
  isImporting,
  onCuePress,
  onCueEdit,
  onCueStop,
  onCueDragStart,
  onCueDrop,
  onCueDragEnd,
  onOpenFiles,
  onCreateStarterPack,
}: LibraryCueGridProps) {
  const handlers = {
    onCuePress,
    onCueEdit,
    onCueStop,
    onCueDragStart,
    onCueDrop,
    onCueDragEnd,
  }

  if (cues.length === 0) {
    return (
      <EmptyLibraryState
        isLibraryEmpty={isLibraryEmpty}
        isImporting={isImporting}
        copy={copy}
        onOpenFiles={onOpenFiles}
        onCreateStarterPack={onCreateStarterPack}
      />
    )
  }

  if (virtual) {
    return (
      <div className="virtual-canvas" style={{ height: `${virtualLayout.totalHeight}px` }}>
        {virtualLayout.rows.map((row) => (
          <div
            className="virtual-row"
            key={`row-${row.rowIndex}`}
            style={{
              top: `${row.rowIndex * virtualLayout.rowHeight}px`,
              gridTemplateColumns: `repeat(${virtualLayout.columns}, minmax(0, 1fr))`,
            }}
          >
            {renderCueCardRow(row.cues, cardState, copy, handlers)}
          </div>
        ))}
      </div>
    )
  }

  return <>{renderCueCardRow(displayedCues, cardState, copy, handlers)}</>
}
