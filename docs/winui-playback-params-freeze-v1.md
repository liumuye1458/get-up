# WinUI Playback Parameters Freeze V1

## Scope

This round freezes only the playback parameter area inside the right editor drawer.
It does not change the drawer section order.
It does not change the basic info section, the hotkey section, or the danger zone.

## Volume Control

- Control form: horizontal slider with a right-aligned numeric value
- Range: `0%` to `100%`
- Default value: `100%`
- Step size: `1%`
- Display format: integer percentage such as `76%`

The slider is the primary control.
The percentage stays visible at all times so the user does not need to infer the current gain from position alone.

## Playback Rate Control

- Control form: horizontal slider with a right-aligned numeric value
- Range: `0.50x` to `1.50x`
- Default value: `1.0x`
- Step size: `0.05x`
- Display format: compact multiplier such as `1.0x`, `1.25x`, `0.95x`

Playback rate remains directly visible in the always-open playback parameter section.
It is not folded behind trim editing.

## Trim Inputs

- Layout: one compact row with two fields
- Left field: `Trim start`
- Right field: `Trim end`
- Input mode: manual numeric input in seconds
- Interaction mode: manual input and waveform drag handles both remain available

Manual input and waveform drag are two views of the same trim range.
When one changes, the other must reflect the updated start and end boundaries.

## Collapsed Trim Summary

When the trim section is collapsed, it still shows a one-line summary:

- Full clip state: `Full clip | 0.00 s -> 2.40 s`
- Trimmed state: `Trimmed | <start> -> <end>`

This summary keeps trim state visible without forcing the waveform open.

## Waveform Area

- Expanded waveform height: `140 px`
- Vertical order inside the expanded trim section:
  1. Trim start and end inputs
  2. Waveform block
  3. Drag interaction hint

The waveform stays below the numeric trim inputs.
The waveform block keeps a fixed height and may not compress the always-visible volume and playback rate controls above it.

## Drag Interaction Priority

- Drag handles are the highest-priority pointer target inside the waveform
- The selected trim range is secondary
- Background waveform hit area is tertiary

This keeps boundary adjustment unambiguous during fine trim work.

## Parameter Feedback Rules

### Volume And Playback Rate

- Slider movement updates the visible value immediately
- The edit session preview updates immediately
- If the same cue is currently playing, volume and rate changes apply to the active playback immediately
- The cue is not persisted until the user presses `Save`

### Trim

- Start and end edits update the trim summary immediately
- Waveform and text fields stay synchronized
- Trim edits do not force the currently playing cue to jump or restart mid-playback
- Updated trim boundaries apply on the next playback trigger
- The cue is not persisted until the user presses `Save`

## Save Rule

Playback parameter edits are live for editing feedback but not durable by default.
`Save` remains the only write-to-storage action for volume, rate, and trim.
