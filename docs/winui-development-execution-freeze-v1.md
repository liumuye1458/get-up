# WinUI Development Execution Freeze V1

## Scope

This document converts the frozen main-window baseline into an engineering execution plan.
It fixes:

- task decomposition
- implementation order
- task completion definition
- defect handling order
- RC closure order

No new product scope is introduced here.

## 1. Development Task Table

| Task ID | Task Name | Scope | Depends On | Parallelizable |
| --- | --- | --- | --- | --- |
| DEV-01 | Shell Bootstrap | WinUI app bootstrap, DI root, window startup, fixed logical sizing, theme resources, base navigation shell | None | No |
| DEV-02 | Main Window Skeleton | Top bar, center grid host, right drawer host, bottom control strip, fixed column layout | DEV-01 | No |
| DEV-03 | Left Filter Rail | All cue cards entry, tag filter list, later area, search/filter state wiring | DEV-02 | Yes |
| DEV-04 | Cue Grid Rendering | Card template, column flow, empty state, placeholder state, card statuses | DEV-02 | Yes |
| DEV-05 | Bottom Playback Controls | Global hotkey toggle, play/pause, volume, repeat, status hint wiring | DEV-02 | Yes |
| DEV-06 | Drawer Shell | Drawer host, fixed header, section order, scroll behavior, save-state badge | DEV-02 | No |
| DEV-07 | Basic Info Editing | Name, tags, color, resource summary, preview/rollback behavior | DEV-06, DEV-04, DEV-03 | Yes |
| DEV-08 | Hotkey Editing | Recording flow, format, conflict check, clear, save boundary | DEV-06, DEV-04 | Yes |
| DEV-09 | Playback Parameter Editing | Per-cue volume, rate, preview state, save boundary | DEV-06, DEV-05 | Yes |
| DEV-10 | Trim And Waveform Editing | Trim inputs, validation, waveform sync, playback boundary | DEV-06, DEV-09 | No |
| DEV-11 | Card-Drawer Linkage | Editing marker, draft marker, switching confirmation, grid preview pushback | DEV-04, DEV-06, DEV-07, DEV-08, DEV-09, DEV-10 | No |
| DEV-12 | Danger Zone Actions | Duplicate, delete, confirmation flows, playback interaction, history write-in | DEV-11 | No |
| DEV-13 | History Integration | Save history, duplicate/delete history, future undo integration contract | DEV-11, DEV-12 | No |
| DEV-14 | Main Path Regression Pass | Main path, secondary path, danger path, edge path fixes against frozen matrix | DEV-03 through DEV-13 | No |
| DEV-15 | RC Hardening | Bug scrub, manual verification, packaging sanity, release candidate sign-off | DEV-14 | No |

## 2. Implementation Order

### Fixed Order

1. `DEV-01 Shell Bootstrap`
2. `DEV-02 Main Window Skeleton`
3. `DEV-04 Cue Grid Rendering`
4. `DEV-06 Drawer Shell`
5. `DEV-03 Left Filter Rail`
6. `DEV-05 Bottom Playback Controls`
7. `DEV-07 Basic Info Editing`
8. `DEV-08 Hotkey Editing`
9. `DEV-09 Playback Parameter Editing`
10. `DEV-10 Trim And Waveform Editing`
11. `DEV-11 Card-Drawer Linkage`
12. `DEV-12 Danger Zone Actions`
13. `DEV-13 History Integration`
14. `DEV-14 Main Path Regression Pass`
15. `DEV-15 RC Hardening`

### Dependency Rule

- `DEV-01` and `DEV-02` are mandatory foundation tasks.
- `DEV-04` must land before drawer-bound preview features because the drawer pushes state back into cards.
- `DEV-06` must land before any field-level drawer task.
- `DEV-07`, `DEV-08`, and `DEV-09` may run in parallel after `DEV-06`.
- `DEV-10` must wait for `DEV-09` because trim and playback parameter save/preview boundaries are coupled.
- `DEV-11` must wait until all major drawer edit tasks are stable.
- `DEV-12` must wait for `DEV-11`, because duplicate/delete act on the same grid-drawer state chain.
- `DEV-13` must wait for the normal edit path and danger path to be stable.
- `DEV-14` starts only after all feature tasks are merged.
- `DEV-15` starts only after `DEV-14` passes.

### Parallel Rule

- Allowed parallel cluster A:
  - `DEV-03 Left Filter Rail`
  - `DEV-04 Cue Grid Rendering`
  - `DEV-05 Bottom Playback Controls`
- Allowed parallel cluster B:
  - `DEV-07 Basic Info Editing`
  - `DEV-08 Hotkey Editing`
  - `DEV-09 Playback Parameter Editing`

No task may change frozen structure or interaction rules while parallel work is in progress.

## 3. Task Completion Definition

### DEV-01 Shell Bootstrap

- Completion standard:
  - App launches into WinUI shell without WebView/Electron dependency
  - Fixed logical size and minimum size rules are active
  - Project structure and startup path are stable
- Test matrix:
  - `MP-01`
- Manual verification:
  - Launch app twice from clean state
  - Confirm fixed window sizing and startup shell consistency
- High risk:
  - Yes

### DEV-02 Main Window Skeleton

- Completion standard:
  - Top, left, center, right, and bottom regions are present with frozen dimensions
  - Drawer host opens and closes structurally
- Test matrix:
  - `MP-01`, `SP-01`
- Manual verification:
  - Resize within allowed limits
  - Confirm no structural drift in three-column shell
- High risk:
  - Yes

### DEV-03 Left Filter Rail

- Completion standard:
  - Search and tag filtering follow frozen combined-filter rules
  - Later area stays downgraded and non-disruptive
- Test matrix:
  - `MP-02`, `MP-03`, `MP-04`, `MP-05`, `EP-01`, `EP-02`
- Manual verification:
  - Filter to zero results
  - Clear filters in different orders
- High risk:
  - Medium

### DEV-04 Cue Grid Rendering

- Completion standard:
  - Card size, spacing, states, empty state, and placeholder state match frozen grid rules
  - Card states can represent `Ready`, `Playing`, `Draft`, and `Editing`
- Test matrix:
  - `MP-01`, `MP-06`, `SP-01`, `SP-11`, `EP-05`
- Manual verification:
  - Confirm no card resizing logic beyond column count changes
  - Confirm state visuals remain readable under DPI scaling
- High risk:
  - Yes

### DEV-05 Bottom Playback Controls

- Completion standard:
  - Global hotkey toggle, play/pause, master volume, repeat, and status hint behave as frozen
- Test matrix:
  - `MP-07`, `MP-08`, `MP-09`
- Manual verification:
  - Toggle controls in idle and active playback states
- High risk:
  - Medium

### DEV-06 Drawer Shell

- Completion standard:
  - Drawer header, save-state badge, section order, scroll behavior, and fixed header rules are implemented
- Test matrix:
  - `SP-01`, `SP-12`, `SP-13`
- Manual verification:
  - Scroll body with long content
  - Confirm header stays fixed
- High risk:
  - Yes

### DEV-07 Basic Info Editing

- Completion standard:
  - Name, tags, color, and resource info follow frozen validation, preview, and rollback rules
- Test matrix:
  - `SP-02`, `SP-03`, `SP-04`, `SP-05`, `SP-11`, `SP-13`
- Manual verification:
  - Empty name
  - Long name truncation on card
  - Color rollback after discard
- High risk:
  - High

### DEV-08 Hotkey Editing

- Completion standard:
  - Recording, formatting, conflict handling, clear action, and save boundary follow frozen rules
- Test matrix:
  - `SP-06`, `SP-07`, `SP-11`
- Manual verification:
  - Valid combo
  - Invalid single key
  - Conflict against another cue
- High risk:
  - Critical

### DEV-09 Playback Parameter Editing

- Completion standard:
  - Per-cue volume/rate controls, live preview, and save boundary follow frozen rules
- Test matrix:
  - `SP-08`, `EP-03`
- Manual verification:
  - Edit while idle
  - Edit while active playback is running
- High risk:
  - High

### DEV-10 Trim And Waveform Editing

- Completion standard:
  - Trim input, waveform sync, validation, snap, and playback boundary follow frozen rules
- Test matrix:
  - `SP-09`, `SP-10`, `EP-03`, `EP-04`
- Manual verification:
  - Illegal ranges
  - Valid ranges
  - Discard after trim preview
- High risk:
  - Critical

### DEV-11 Card-Drawer Linkage

- Completion standard:
  - Editing marker, draft marker, switch-card confirmation, and preview pushback are stable
- Test matrix:
  - `SP-01`, `SP-11`, `SP-13`, `EP-01`, `EP-05`
- Manual verification:
  - Open cue A, draft, switch to cue B
  - Save then close
  - Discard then reopen
- High risk:
  - Critical

### DEV-12 Danger Zone Actions

- Completion standard:
  - Duplicate/delete positions, confirmation flows, playback interaction, and drawer/grid feedback match frozen danger rules
- Test matrix:
  - `DP-01`, `DP-02`, `DP-03`, `DP-04`, `DP-05`, `EP-02`
- Manual verification:
  - Duplicate with and without unsaved edits
  - Delete current playing cue
- High risk:
  - Critical

### DEV-13 History Integration

- Completion standard:
  - Save, duplicate, and delete create correct history entries
  - Discard stays out of history
  - Undo refresh contract is implemented or cleanly stubbed behind one state source
- Test matrix:
  - `HP-01`, `HP-02`, `HP-03`, `HP-04`, `HP-05`
- Manual verification:
  - Inspect history ordering
  - Undo after each history-producing action
- High risk:
  - Critical

### DEV-14 Main Path Regression Pass

- Completion standard:
  - All frozen test matrix cases pass in one continuous regression run
  - No structural drift is introduced while fixing failures
- Test matrix:
  - `MP-*`, `SP-*`, `DP-*`, `HP-*`, `EP-*`
- Manual verification:
  - Full hand-run of frozen matrix
- High risk:
  - Critical

### DEV-15 RC Hardening

- Completion standard:
  - RC candidate passes mandatory matrix subset
  - No critical or high release blockers remain
  - Packaging and startup sanity checks pass
- Test matrix:
  - Mandatory RC subset listed below
- Manual verification:
  - Fresh install or clean-run startup
  - Smoke pass on edited cues, duplicate, delete, and discard
- High risk:
  - Critical

## 4. Defect Fix Order Rule

### Immediate Fix

- Must be fixed immediately:
  - crashes
  - data loss
  - wrong cue deleted or duplicated
  - hotkey conflict bypass
  - trim validation bypass
  - save/rollback inconsistency
  - drawer/grid state mismatch
  - playback state corruption
  - any failure in a `Critical` test case

### Same-Phase Fix

- Must be fixed before phase sign-off:
  - incorrect visual state for `Playing`, `Draft`, `Editing`, `Ready`
  - search/tag filter mismatch
  - drawer header/save-state mismatch
  - duplicate/delete feedback inconsistency
  - any failure in a `High` test case

### Deferrable

- May be deferred only if structure and interaction rules stay intact:
  - non-blocking copy text polish
  - minor spacing/alignment defects
  - cosmetic color inconsistencies that do not break state readability
  - any `Medium` case issue with explicit tracking and contained risk

### Structural Freeze Rule

- During implementation, bug fixing may not reopen frozen layout or interaction design.
- No bug fix may be used as a reason to redesign structure unless the frozen spec is provably unimplementable.
- If a frozen rule is genuinely unimplementable, work pauses and the freeze document must be updated explicitly before code changes continue.

## 5. RC Closure Order

### Entry To RC

The project may enter RC only after:

1. `DEV-01` through `DEV-13` are complete
2. `DEV-14` has passed
3. No open `Critical` defects remain
4. No open `High` defects remain in main, secondary, danger, or history paths

### Mandatory RC Test Subset

- Main path:
  - `MP-01`, `MP-02`, `MP-03`, `MP-06`, `MP-07`
- Secondary path:
  - `SP-01`, `SP-03`, `SP-06`, `SP-07`, `SP-09`, `SP-10`, `SP-11`, `SP-13`
- Danger path:
  - `DP-01`, `DP-03`, `DP-04`, `DP-05`
- History path:
  - `HP-01`, `HP-02`, `HP-03`, `HP-04`
- Edge path:
  - `EP-01`, `EP-02`, `EP-03`, `EP-04`, `EP-05`

### Modules Allowed To Be Postponed

- Only items outside the frozen main-window path may be postponed.
- Examples:
  - later-area low-priority modules
  - non-essential backup/history management UI beyond frozen scope
  - non-blocking polish work

### Issues That May Not Enter RC

- Any crash in app launch, grid interaction, drawer interaction, duplicate/delete, or save flow
- Any mismatch between card state and drawer state
- Any failure where discard does not roll back correctly
- Any failure where delete or duplicate affects the wrong cue
- Any failure where playing cue state is not cleaned correctly after delete
- Any hotkey conflict or trim validation bypass
- Any failure in mandatory RC test subset without explicit spec update

## Execution Rule

- Development proceeds task-by-task in the frozen order above.
- Parallel work is allowed only inside the explicitly allowed clusters.
- Regression is rerun after every high-risk task merge.
- RC starts only after the frozen execution plan and frozen matrix are both satisfied.
