# Native Shell Minimum Baseline

This document replaces the old "minimal bridge" idea.

## Baseline for V1

The native shell must directly own:

- fixed window composition
- cue grid rendering
- cue editor drawer
- playback transport
- output device selection
- drag/drop import
- file and folder picking
- global hotkey registration

## What Is Explicitly Removed

- launching the main board through WebView2
- treating web content as the default workspace
- defining a bridge as the critical path for normal user interaction

## Rule

If a user-facing interaction is core to V1, the first implementation should be native unless there is a strong technical reason not to do so.
