# WinUI Card Grid Freeze V1

## Scope

This round freezes only the cue card area inside the center workspace.
It does not freeze the left tag/filter rail or the internal form layout of the right editor drawer.

## Frozen Card Information Hierarchy

Each imported cue card contains exactly three user-facing information items:

1. Name
2. Hotkey
3. Status

No additional information is shown inside the V1 card body.
The card does not show tags, resource filename, duration, waveform, volume, or trim data.

## Card Internal Layout

- Card size remains `180 x 92`
- Internal padding remains compact
- Name is the primary line at the top
- Name is single-line and truncates when too long
- Hotkey sits on the lower-left edge
- Status sits on the lower-right edge as a compact badge
- The card body does not introduce extra rows or secondary metadata blocks

## Playing Card Expression

The only active card state in the grid is the currently playing card.

- Active expression is static
- No pulse
- No zoom
- No shake
- No animated glow

Playing state is expressed through:

- A stronger border
- A slightly brighter background
- Status badge text changes to `Playing`

Non-playing imported cards show status badge text `Ready`.

## Click Hierarchy

- Left click: play cue
- Right click: open editor drawer
- No intermediate click mode
- No selection-first interaction
- No double-click requirement

If a card is not an imported cue card, left and right click do nothing.

## Grid Column Rule

- Card width never changes
- Card height never changes
- Card gap remains `10`
- The grid may add or remove columns based on available width
- The grid may never resize cards to fit width

This keeps the cue recognition model stable across window sizes and DPI scales.

## Card Types

### Imported Card

- Full visual priority
- Interactive
- Shows name, hotkey, and status
- Left click plays
- Right click opens editor

### Placeholder Card

- Lower visual priority than imported cards
- Non-interactive
- Uses muted contrast
- Keeps the same card size as imported cards
- Exists only to reserve future card space in the grid language

### Empty State

- Not a card
- Appears only when there are no imported cards to show
- Non-interactive
- Communicates absence of imported cue cards or search results

## Active State Rule

The grid does not keep a persistent selected state.
The only emphasized state is the currently playing card.
Opening the editor drawer by right click does not create a separate selected-card style in the grid.
