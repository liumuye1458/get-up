# WinUI Main Window Freeze V1

## Scope

This document freezes only the main window shell for the native desktop rebuild.
It does not freeze the internal details of the tag area, cue card content rules, or editor drawer form layout.

## Native Stack

- `C#`
- `.NET 8`
- `WinUI 3 Desktop`
- No `Electron`
- No `WebView`
- No web-shell layout model

## Window Rules

- Default logical size: `1600 x 980`
- Minimum logical size: `1280 x 800`
- The app uses fixed logical sizes plus Windows DPI scaling
- Sizes are not recalculated from screen resolution
- No responsive page reflow
- No fluid card resizing
- Only the number of cue card columns may change with available width

## Main Layout

- Top toolbar: minimal only
- Main body: three-column shell
- Bottom toolbar: fixed and always visible

## Body Columns

- Left navigation rail: `220 px`, fixed
- Center work area: adaptive to remaining width
- Right editor drawer: `420 px`, fixed
- When the editor drawer is closed, it does not reserve layout space

## Cue Card Grid

- Cue card width: `180 px`
- Cue card height: `92 px`
- Cue card spacing: `10 px`
- Card size does not change with window size
- Grid only adds or removes columns based on available width

## Top Toolbar

Only these elements are allowed:

- Product name
- Search box
- Window control area

## Bottom Toolbar

Only these elements are allowed:

- Global hotkey toggle
- Play / pause
- Volume
- Repeat playback
- Status hint

## Current Implementation Note

The current WinUI shell applies the window size rules in logical units and converts them to physical pixels using the current Windows DPI.
This matches the agreed desktop strategy for `100%`, `125%`, `150%`, and `200%` system scaling.
