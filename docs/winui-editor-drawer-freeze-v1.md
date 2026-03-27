# WinUI Editor Drawer Freeze V1

## Scope

This round freezes only the right editor drawer for single-cue editing.
It does not change the left filter rail rules.
It does not change the center cue card sizing or click hierarchy.

## Fixed Top-To-Bottom Order

The drawer content order is fixed and may not be rearranged in V1:

1. Basic info
2. Hotkey
3. Playback parameters
4. Trim and waveform
5. Danger zone

This order defines the editing sequence for a single cue.

## Header Actions

The drawer header keeps only two top-level actions:

- `Save`
- `Close`

`Save` remains an explicit action.
`Close` stays fixed at the top-right edge of the drawer header.

## Section Spacing And Height Rules

- Section gap: `12 px`
- Drawer body uses one vertical scroll surface
- Header stays fixed
- Body scrolls when content exceeds visible height

### Basic Info

- Always visible
- Minimum height: `144 px`
- Contains display name and tags

### Hotkey

- Always visible
- Minimum height: `118 px`
- Stays above playback parameters because it is higher priority during live operation

### Playback Parameters

- Always visible
- Minimum height: `150 px`
- Volume and playback rate are both visible here by default

### Trim And Waveform

- Collapsed by default
- Collapsed state shows only section header and hint text
- Expanded state reveals fixed-height internal content blocks
- Waveform block height: `140 px`
- If expanded content exceeds available space, the drawer body scrolls instead of resizing surrounding sections

### Danger Zone

- Always last
- Minimum height: `104 px`
- Never moves above the primary edit sections

## Control Priority

### Default Visible

- Display name
- Tags
- Hotkey
- Volume
- Playback rate

### Secondary / On Demand

- Trim
- Waveform

Trim and waveform remain available but are folded behind an explicit expand action.

## Save / Close / Danger Placement

- `Save` stays in the top header area
- `Close` stays in the top header area
- `Duplicate clip` and `Delete cue` stay together inside the bottom danger zone

Dangerous actions may not appear in the top header or inside the primary edit sections.
They remain visually separated from the main single-cue editing path.

## Scroll Rule

The drawer does not create separate nested scroll regions for each section.
Only the drawer body scrolls.
The header remains fixed so the user can always reach `Save` and `Close`.
