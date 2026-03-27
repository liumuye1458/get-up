# Current Stage Development Rule

The project is now in the stability lockdown phase.

This is not a feature development phase.

## Allowed

- Fix clearly identified defects.
- Keep the main path smooth and reliable.
- Stabilize repeated real usage of:
  - click
  - playback
  - edit
  - undo

## Not Allowed

- No new features.
- No page structure changes.
- No layout optimization work.
- No module refactors.

## Priority Order

1. Card click must work on the first attempt. No swallowed clicks.
2. Color editing must work for all cards.
3. Waveform editing must be restored.
4. Playback rate must use a slider and must actually take effect.
5. Hotkeys must support modifier combinations and register stably.

## Goal

The goal is not "more features".

The goal is "continuous use without failure".
