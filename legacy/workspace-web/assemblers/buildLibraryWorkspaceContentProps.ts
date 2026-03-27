import type { ComponentProps, ReactNode, RefObject } from 'react'
import { useCopy } from '../../use-copy'
import type { LibraryCueCard } from '../../electron'
import { LibraryWorkspaceContent } from '../pages/library'

type CopySet = ReturnType<typeof useCopy>
type LibraryWorkspaceContentProps = ComponentProps<typeof LibraryWorkspaceContent>

export type BuildLibraryWorkspaceContentPropsArgs = {
  copy: CopySet
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
  gridRef: RefObject<HTMLElement | null>
  virtual: boolean
  cues: LibraryCueCard[]
  displayedCues: LibraryCueCard[]
  virtualLayout: {
    columns: number
    rowHeight: number
    totalHeight: number
    rows: Array<{ rowIndex: number; cues: LibraryCueCard[] }>
  }
  cardState: {
    selectedCueId: string | null
    selectedCueIds: Set<string>
    missingPaths: Set<string>
    duplicateHotkeys: Set<string>
    failedHotkeys: Set<string>
    reservedHotkeys: Set<string>
    weakHotkeys: Set<string>
    activePlaybackIds: Set<string>
  }
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

export function buildLibraryWorkspaceContentProps({
  copy: m,
  toolbar,
  feedback,
  bulkPanel,
  gridRef,
  virtual,
  cues,
  displayedCues,
  virtualLayout,
  cardState,
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
}: BuildLibraryWorkspaceContentPropsArgs): LibraryWorkspaceContentProps {
  return {
    page: {
      toolbar,
      feedback,
      bulkPanel,
    },
    grid: {
      ref: gridRef,
      virtual,
    },
    cueGrid: {
      cues,
      displayedCues,
      virtual,
      virtualLayout,
      cardState,
      copy: {
        noHotkey: m.noHotkey,
        nowPlaying: m.nowPlaying,
        untagged: m.untagged,
        missingFile: m.missingFile,
        duplicateHotkey: m.duplicateHotkey,
        rejectedHotkey: m.rejectedHotkey,
        reservedHotkey: m.reservedHotkey,
        weakHotkey: m.weakHotkey,
        editCue: m.editCue,
        stopAll: m.stopAll,
        onboardingTitle: m.onboardingTitle,
        onboardingBody: m.onboardingBody,
        onboardingStepImport: m.onboardingStepImport,
        onboardingStepEdit: m.onboardingStepEdit,
        onboardingStepTrigger: m.onboardingStepTrigger,
        importAudio: m.importAudio,
        createStarterPack: m.createStarterPack,
        noSoundsTitle: m.noSoundsTitle,
        noSoundsBody: m.noSoundsBody,
      },
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
    },
  }
}
