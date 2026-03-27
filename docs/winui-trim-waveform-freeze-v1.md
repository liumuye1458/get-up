# WinUI Trim And Waveform Freeze V1

## Scope

This round freezes only trim and waveform interaction inside the existing trim section.
It does not change drawer layout, playback parameter placement, or basic info fields.

## Drag Handle Rules

- The trim start handle and trim end handle are both visible vertical grips
- Visible handle width: `12 px`
- Effective pointer hit width: `24 px`
- The handle that receives pointer-down keeps capture until release
- V1 supports boundary dragging only; dragging the whole selected range is not part of this version

### Crossing Rule

- Start and end handles may not cross
- Dragging never swaps active sides
- If a drag would cross the opposite side, the active handle clamps at the minimum legal interval

This keeps start and end ownership stable during fine edits.

## Timeline Rules

- Timeline display precision: `0.01 s`
- Total clip duration remains visible at the right side of the timeline
- The selected trim range is shown as one continuous highlighted band between start and end
- The current range summary also shows `start -> end`

## Snap Rules

- Dragging snaps to a fixed `0.01 s` grid
- Manual input uses the same `0.01 s` precision rule
- Both interaction paths must produce the same stored trim boundaries

## Illegal Range Handling

### Invalid Cases

- `start >= end`
- `start < 0`
- `end > total duration`
- Empty range
- Extremely short range under `0.05 s`

### Resolution Rule

- Drag interaction never produces an illegal range; it clamps to the nearest legal boundary
- Manual input may temporarily enter an illegal state while the user edits
- Illegal manual input does not update the waveform highlight to a new invalid range
- The last valid range stays visible
- `Save` is disabled until the trim becomes valid again
- The UI shows an inline validation message instead of silently auto-correcting

## Drag/Input Synchronization

- Dragging a handle updates `Trim start` and `Trim end` immediately
- Editing either input field updates the waveform highlight immediately when the range is valid
- If the typed values are invalid, the waveform keeps the last valid range and shows validation feedback

The trim summary, waveform highlight, and input fields must represent one shared trim state.

## Current Playback Boundary

- Trim drag and manual trim edits do not change the boundaries of a cue that is already playing
- Active playback continues with the trim range that was valid when playback started
- The updated trim range applies on the next trigger only

This rule is fixed for V1 to avoid mid-playback jumps.
