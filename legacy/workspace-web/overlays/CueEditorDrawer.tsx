import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import { WaveformEditor } from '../../components/WaveformEditor'
import type { LibraryCueCard, LibraryTag } from '../../electron'
import { useCopy } from '../../use-copy'

type CopySet = ReturnType<typeof useCopy>

type CueEditorDrawerProps = {
  copy: CopySet
  isOpen: boolean
  cue: LibraryCueCard | null
  isRecordingHotkey: boolean
  tagInput: string
  selectedCueHotkeyWarnings: string[]
  tagSuggestions: LibraryTag[]
  tagColorPalette: string[]
  speedPresets: number[]
  onClose: () => void
  onCueNameChange: (value: string) => void
  onToggleHotkeyRecording: () => void
  onClearHotkey: () => void
  onTagInputChange: (value: string) => void
  onCommitTagInput: () => void
  onTagInputKeyDown: (event: ReactKeyboardEvent<HTMLInputElement>) => void
  onAppendTag: (tagName: string) => void
  onChangeTagColor: (tag: LibraryCueCard['tags'][number], color: string | null) => void
  onPlaybackRateChange: (value: number) => void
  onVolumeChange: (value: number) => void
  onPreview: () => void
  onTrimChange: (trimStartMs: number, trimEndMs: number | null) => void
  onOpenDelete: () => void
}

export function CueEditorDrawer({
  copy,
  isOpen,
  cue,
  isRecordingHotkey,
  tagInput,
  selectedCueHotkeyWarnings,
  tagSuggestions,
  tagColorPalette,
  speedPresets,
  onClose,
  onCueNameChange,
  onToggleHotkeyRecording,
  onClearHotkey,
  onTagInputChange,
  onCommitTagInput,
  onTagInputKeyDown,
  onAppendTag,
  onChangeTagColor,
  onPlaybackRateChange,
  onVolumeChange,
  onPreview,
  onTrimChange,
  onOpenDelete,
}: CueEditorDrawerProps) {
  if (!isOpen || !cue) {
    return null
  }

  return (
    <div className="drawer-backdrop" role="presentation" onClick={onClose}>
      <aside
        className="editor-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={copy.inspector}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="editor-drawer-header">
          <div>
            <p className="eyebrow">{copy.inspector}</p>
            <h2>{cue.name}</h2>
            <p className="muted small">{copy.inspectorHint}</p>
          </div>
          <button className="tag-chip" onClick={onClose}>
            {copy.closePanel}
          </button>
        </div>

        <section className="panel">
          <label className="field">
            <span>{copy.name}</span>
            <input value={cue.name} onChange={(event) => onCueNameChange(event.target.value)} />
          </label>

          <div className="field">
            <span>{copy.hotkey}</span>
            <div className="hotkey-row">
              <input
                value={isRecordingHotkey ? copy.hotkeyRecording : cue.hotkey}
                placeholder={copy.hotkeyPlaceholder}
                readOnly
              />
              <button
                className={`tag-chip ${isRecordingHotkey ? 'active' : ''}`}
                onClick={onToggleHotkeyRecording}
              >
                {copy.hotkeyRecord}
              </button>
              <button className="tag-chip" onClick={onClearHotkey}>
                {copy.hotkeyClear}
              </button>
            </div>
            {selectedCueHotkeyWarnings.length > 0 ? (
              <div className="tag-row">
                {selectedCueHotkeyWarnings.map((warning) => (
                  <span className="badge warning" key={`${cue.id}-${warning}`}>
                    {warning}
                  </span>
                ))}
              </div>
            ) : null}
          </div>

          <label className="field">
            <span>{copy.tags}</span>
            <input
              value={tagInput}
              onChange={(event) => onTagInputChange(event.target.value)}
              onBlur={onCommitTagInput}
              onKeyDown={onTagInputKeyDown}
              placeholder={copy.tagsPlaceholder}
            />
          </label>

          {tagSuggestions.length > 0 ? (
            <div className="suggestion-row">
              <span className="muted small">{copy.addTag}</span>
              <div className="tag-row">
                {tagSuggestions.map((tag) => (
                  <button
                    key={tag.name}
                    className="tag-chip"
                    style={tag.color ? { background: tag.color } : undefined}
                    onClick={() => onAppendTag(tag.name)}
                  >
                    {tag.name}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {cue.tags.length > 0 ? (
            <div className="field">
              <span>{copy.tagColors}</span>
              <div className="tag-color-list">
                {cue.tags.map((tag) => (
                  <div className="tag-color-item" key={tag.id}>
                    <span
                      className="mini-tag"
                      style={tag.color ? { background: tag.color } : undefined}
                    >
                      {tag.name}
                    </span>
                    <div className="tag-palette">
                      {tagColorPalette.map((color) => (
                        <button
                          key={`${tag.id}-${color}`}
                          className={`color-swatch ${
                            tag.color === color && tag.colorMode === 'manual' ? 'active' : ''
                          }`}
                          style={{ background: color }}
                          onClick={() => onChangeTagColor(tag, color)}
                        />
                      ))}
                      <button className="tag-chip" onClick={() => onChangeTagColor(tag, null)}>
                        {copy.resetAutoColor}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>

        <section className="panel">
          <label className="field">
            <span>{copy.speed}</span>
            <div className="range-row">
              <input
                type="range"
                min="0.5"
                max="2"
                step="0.05"
                value={cue.playbackRate}
                onChange={(event) => onPlaybackRateChange(Number(event.target.value))}
              />
              <strong>{cue.playbackRate.toFixed(2)}x</strong>
            </div>
          </label>

          <div className="preset-row">
            {speedPresets.map((preset) => (
              <button
                key={preset}
                className={`preset-chip ${Math.abs(cue.playbackRate - preset) < 0.01 ? 'active' : ''}`}
                onClick={() => onPlaybackRateChange(preset)}
              >
                {preset.toFixed(2)}x
              </button>
            ))}
          </div>

          <label className="field">
            <span>{copy.cueVolume}</span>
            <div className="range-row">
              <input
                type="range"
                min="0"
                max="1.5"
                step="0.01"
                value={cue.volume}
                onChange={(event) => onVolumeChange(Number(event.target.value))}
              />
              <strong>{Math.round(cue.volume * 100)}%</strong>
            </div>
          </label>

          <div className="transport-row">
            <button className="transport-button" onClick={onPreview}>
              {copy.preview}
            </button>
          </div>
        </section>

        <details className="panel drawer-section" open={false}>
          <summary>{copy.advancedSettings}</summary>
          <div className="drawer-section-content">
            <div className="file-block">
              <span className="muted small">{copy.resourceName}</span>
              <code>{cue.resource.originalFilename}</code>
              <span className="muted small">{copy.sourceFile}</span>
              <code>{cue.resource.absolutePath}</code>
            </div>
            <WaveformEditor
              key={cue.id}
              cueId={cue.id}
              audioPath={cue.resource.absolutePath}
              trimStartMs={cue.trimStartMs}
              trimEndMs={cue.trimEndMs}
              durationMs={cue.resource.durationMs}
              labels={{
                waveform: copy.waveform,
                start: copy.trimStart,
                end: copy.trimEnd,
                segment: copy.segmentDuration,
                loading: copy.waveformLoading,
                untilEnd: copy.trimUntilEnd,
              }}
              onChange={onTrimChange}
            />
          </div>
        </details>

        <details className="panel drawer-section" open={false}>
          <summary>{copy.dangerZone}</summary>
          <div className="drawer-section-content">
            <button className="transport-button danger" onClick={onOpenDelete}>
              {copy.remove}
            </button>
          </div>
        </details>
      </aside>
    </div>
  )
}
