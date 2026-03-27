# WinUI Basic Info Freeze V1

## Scope

This round freezes only the basic info section inside the right editor drawer.
It does not change drawer order, hotkey rules, or playback parameter rules.

## Name Field

- Control: single-line text box
- Height: `40 px`
- Width: full section width
- Maximum length: `48` characters
- Empty name is not allowed

### Long Name Handling

- Input stops at `48` characters
- The drawer keeps the full stored value
- The cue card uses single-line ellipsis when the visible width is exceeded

### Preview Rule

- Valid name edits update the drawer immediately
- Valid name edits update the cue card title immediately while the drawer is open
- Invalid empty name shows inline validation and keeps the last valid card title in the grid

## Tags Field

- Tags use free-form multi-value input
- Input form: one single-line text box with comma-separated values
- Tags are interpreted as multiple selected tags after parsing
- Selected tags are shown as compact chips in one horizontal preview row

### Empty State

- Empty tag input is allowed
- Empty tag input shows `No tags`

## Color Field

- Color uses `9` preset swatches
- Layout: fixed `3 x 3` grid
- Every cue has the same color entry position inside basic info
- The selected swatch uses a stronger outline

### Preview Rule

- Color changes update the drawer selection immediately
- Color changes update the cue card accent immediately while the drawer is open
- Closing without `Save` restores the previous saved color

## Resource Identification Info

The resource summary stays at the bottom of the basic info section and remains read-only.

### Fixed Read-Only Fields

- File name
- Source
- Duration

These fields may not displace name, tags, or color from the primary edit path.

## Save And Rollback Boundary

- Name, tags, and color changes preview immediately in the drawer
- Name and color preview immediately in the cue card grid
- Closing the drawer without `Save` discards pending basic info edits
- `Save` commits name, tags, and color to the cue card state used by the grid

This keeps preview fast while preserving an explicit commit boundary.
