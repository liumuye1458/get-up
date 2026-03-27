# WinUI Left Filter Freeze V1

## Scope

This round freezes only the left tag and filter area.
It does not freeze the internal layout of the editor drawer.
It does not change the center card sizing rules.

## Left Area Structure

The left area is split into three vertical zones:

1. Top fixed entry zone
2. Middle scrollable tag zone
3. Bottom fixed `Later` zone

The left rail itself stays fixed at `220 px`.

## Top Fixed Entry Zone

The top fixed zone keeps only the main-path entry:

- `All cue cards`

This entry resets tag filtering and returns the user to the default browsing scope.
It remains visible at all times and does not scroll with the tag list.

## Tag Zone

The tag zone is a flat single-level list.

- No grouping by `Common`
- No grouping by `Recent`
- No multi-section hierarchy inside tags
- No tree structure

Tags are shown as a simple vertical list with count labels.

## Tag Interaction Rules

- Single click toggles a tag filter
- Only one tag can be active at a time
- Clicking the active tag again clears the tag filter
- No multi-select
- No nested filter state

## Active Tag Expression

The currently active tag is expressed with a stronger fill and border than inactive tags.
Inactive tags remain visible but lower emphasis.

`All cue cards` uses the same active-state language as tags when no tag is selected.

## Search And Tag Relationship

Search and tag filtering work together.

- Tag filter reduces the candidate set
- Search then matches within that filtered set
- In practice the result is the intersection of both conditions

Search is not a replacement for tag filtering and does not cancel the active tag.

## Clear Filter Default State

Default browse state is:

- No active tag
- `All cue cards` active
- Search box empty

If the user clicks `All cue cards` while search text still exists, only the tag filter clears.
Search remains active until the user clears it from the top search box.

## Scrolling Rule

- Top entry zone stays fixed
- Bottom `Later` zone stays fixed
- Only the tag list scrolls
- The left rail does not become one large shared scroll surface

This keeps tag access stable even when tag count grows.

## Main Path Boundary

The main path inside the left rail contains only:

- `All cue cards`
- Tag list

No other interactive module entry is allowed inside the main-path area for V1.

## Later Zone

The `Later` zone exists only as a low-priority placeholder for future modules.

- It stays visually separated from the tag area
- It stays non-blocking
- It stays lower emphasis than the main path
- It must not compete with tag filtering for attention

Current `Later` entries remain disabled placeholders only.
