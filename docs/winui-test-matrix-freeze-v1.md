# WinUI Test Matrix Freeze V1

## Scope

This document converts the frozen main-window interaction spec into an executable test baseline.
Each test case keeps the same fixed fields:

- Case ID
- Scenario
- Preconditions
- Steps
- Expected Result
- End State
- Regression Required
- Severity If Failed

## 1. Main Path Matrix

| Case ID | Scenario | Preconditions | Steps | Expected Result | End State | Regression Required | Severity If Failed |
| --- | --- | --- | --- | --- | --- | --- | --- |
| MP-01 | Open app into main shell | Fresh app launch | 1. Start app | Main window opens at frozen shell layout. Imported cards are visible. Placeholder cards appear when no search is active. | `Ready` | Yes | Critical |
| MP-02 | Search filters grid | App open with imported cards | 1. Type a known cue keyword in search | Grid filters by title, hotkey, and tags. Non-matching imported cards disappear. Placeholder cards are hidden under active search. | `Ready` | Yes | High |
| MP-03 | Tag filter combines with search | App open with at least one matching tag | 1. Enter search text 2. Click one tag filter | Grid applies search and tag filter together. Only cards matching both stay visible. | `Ready` | Yes | High |
| MP-04 | Clear tag filter keeps search | Active search and active tag filter | 1. Click `All cue cards` | Tag filter clears. Search text remains. Grid stays filtered only by search. | `Ready` | Yes | Medium |
| MP-05 | Clear search restores default grid | Search active | 1. Clear search text | Imported cards return. Placeholder cards reappear because search is no longer active. | `Ready` | Yes | Medium |
| MP-06 | Left click starts playback | App open with one interactive card visible | 1. Left-click one cue card | Selected cue becomes active playback target. Card badge changes to `Playing`. Card emphasis updates immediately. | `Playing` | Yes | Critical |
| MP-07 | Bottom play/pause toggles playback | One cue already playing | 1. Click `Pause` 2. Click `Play` again | Playback toggles correctly. Status hint updates after each action. Card playback state follows the active session state. | `Playing` then `Playing` | Yes | High |
| MP-08 | Bottom volume control updates master level | App open | 1. Move master volume slider | Status hint reflects new master volume percentage. Playback session uses updated master level. | `Ready` or `Playing` | Yes | Medium |
| MP-09 | Repeat toggle updates repeat state | App open | 1. Toggle repeat on 2. Toggle repeat off | Repeat state changes and status hint updates both times. | `Ready` or `Playing` | Yes | Medium |

## 2. Secondary Path Matrix

| Case ID | Scenario | Preconditions | Steps | Expected Result | End State | Regression Required | Severity If Failed |
| --- | --- | --- | --- | --- | --- | --- | --- |
| SP-01 | Right-click opens drawer for one cue | App open with interactive card visible | 1. Right-click one card | Drawer opens. It binds to exactly that cue. Grid marks that cue as current editing target. | `Editing` | Yes | Critical |
| SP-02 | Edit basic info name | Drawer open on one cue | 1. Change cue name to a valid new value | Drawer enters `Unsaved changes`. Card title previews immediately. | `Draft` | Yes | High |
| SP-03 | Basic info invalid empty name blocks save | Drawer open on one cue | 1. Clear name field completely | Inline validation appears. `Save` is disabled. Grid keeps last valid title. | `Draft` | Yes | Critical |
| SP-04 | Edit tags in drawer | Drawer open on one cue | 1. Enter comma-separated tags | Tag chip preview updates in drawer. Grid data and tag/search basis update. Card body does not render tags directly. | `Draft` | Yes | Medium |
| SP-05 | Edit color in drawer | Drawer open on one cue | 1. Click one color swatch | Selected swatch updates immediately. Card accent previews immediately. | `Draft` | Yes | High |
| SP-06 | Record valid hotkey | Drawer open on one cue | 1. Click `Record hotkey` 2. Press valid modifier + key combination | Drawer exits recording mode. Hotkey preview updates in drawer and card. `Save` stays enabled if no conflict exists. | `Draft` | Yes | Critical |
| SP-07 | Hotkey conflict disables save | Drawer open on one cue and another cue already owns target shortcut | 1. Record a conflicting hotkey | Conflict message appears immediately. Pending hotkey stays visible. `Save` is disabled. | `Draft` | Yes | Critical |
| SP-08 | Edit playback parameters | Drawer open on one cue | 1. Change cue volume 2. Change playback rate | Numeric display updates immediately. Edit session preview updates immediately. `Save` stays required for commit. | `Draft` | Yes | High |
| SP-09 | Edit trim and waveform | Drawer open on one cue | 1. Expand trim section 2. Change trim start/end to legal values | Trim summary, input fields, and waveform preview stay synchronized. `Save` remains enabled if all validation passes. | `Draft` | Yes | Critical |
| SP-10 | Invalid trim blocks save | Drawer open on one cue | 1. Enter illegal trim range such as `start >= end` | Inline trim validation appears. `Save` is disabled. Waveform keeps last valid range. | `Draft` | Yes | Critical |
| SP-11 | Save commits current draft | Drawer open with valid unsaved edits | 1. Click `Save` | Header becomes `Saved`. Grid reflects committed state. Drawer remains bound to same cue. | `Editing` | Yes | Critical |
| SP-12 | Close with no unsaved edits | Drawer open with no draft changes | 1. Click `Close` | Drawer closes immediately. Grid clears editing marker. | `Ready` or `Playing` | Yes | High |
| SP-13 | Close with discard | Drawer open with unsaved changes | 1. Click `Close` 2. Confirm discard | Drawer closes. Grid rolls back to last committed state. Draft marker clears. | `Ready` or `Playing` | Yes | Critical |

## 3. Danger Path Matrix

| Case ID | Scenario | Preconditions | Steps | Expected Result | End State | Regression Required | Severity If Failed |
| --- | --- | --- | --- | --- | --- | --- | --- |
| DP-01 | Duplicate committed cue | Drawer open on one cue with no unsaved changes | 1. Click `Duplicate as new cue` | New cue is created from committed source state. Hotkey is cleared. Title gets copy suffix. Drawer rebinds to new cue. Grid refreshes immediately. History records duplicate. | `Editing` | Yes | Critical |
| DP-02 | Duplicate with unsaved changes requires discard decision | Drawer open with unsaved changes | 1. Click `Duplicate as new cue` | Standard discard confirmation appears before duplication proceeds. Cancel leaves current draft untouched. Confirm discards current draft and then duplicates committed state. | `Draft` or `Editing` | Yes | High |
| DP-03 | Delete committed cue | Drawer open on one cue | 1. Click `Delete cue` 2. Confirm delete | Cue is removed from grid. Drawer closes immediately. History records delete. | Remaining cues `Ready` or `Playing` | Yes | Critical |
| DP-04 | Delete currently playing cue | Drawer open on currently playing cue | 1. Click `Delete cue` 2. Confirm delete | Active playback stops immediately. Playback state clears before grid refresh. Cue is removed. Drawer closes. History records delete. | Remaining cues `Ready` | Yes | Critical |
| DP-05 | Duplicate/delete sync surfaces | Drawer open on one cue | 1. Execute duplicate or delete | Card grid, drawer binding, playback state, and history list all update according to frozen danger-path rules. | Depends on action | Yes | Critical |

## 4. History Path Matrix

| Case ID | Scenario | Preconditions | Steps | Expected Result | End State | Regression Required | Severity If Failed |
| --- | --- | --- | --- | --- | --- | --- | --- |
| HP-01 | Save creates history entry | Drawer open with valid unsaved edits | 1. Click `Save` | Committed edit enters history. Grid reflects committed state. | `Editing` or `Ready` | Yes | High |
| HP-02 | Duplicate creates history entry | Drawer open on one cue | 1. Click `Duplicate as new cue` | Duplicate action enters history immediately after execution. | `Editing` | Yes | High |
| HP-03 | Delete creates history entry | Drawer open on one cue | 1. Click `Delete cue` 2. Confirm | Delete action enters history immediately after execution. | Remaining cues `Ready` or `Playing` | Yes | High |
| HP-04 | Discard does not create history entry | Drawer open with unsaved changes | 1. Click `Close` 2. Confirm discard | Draft is rolled back. No history entry is created. | `Ready` or `Playing` | Yes | High |
| HP-05 | Undo refreshes all linked surfaces | At least one committed history entry exists and undo support is available | 1. Trigger one undo | Grid restores the prior committed cue state. Open drawer refreshes to restored state if bound to affected cue. Playback state also refreshes if restored state changes active cue availability. | Restored `Ready` / `Playing` / `Editing` | Yes | Critical |

## 5. Edge Path Matrix

| Case ID | Scenario | Preconditions | Steps | Expected Result | End State | Regression Required | Severity If Failed |
| --- | --- | --- | --- | --- | --- | --- | --- |
| EP-01 | Open drawer during active search | Search active and at least one matching cue visible | 1. Right-click visible filtered cue | Drawer opens for selected cue. Search remains active in background. Save or discard updates the filtered grid correctly. | `Editing` or `Draft` | Yes | Medium |
| EP-02 | Delete current card under tag filter | Tag filter active and one filtered cue open in drawer | 1. Delete cue and confirm | Grid refreshes under same tag filter. If no cards remain, filtered empty state appears. | `Ready` | Yes | High |
| EP-03 | Save while cue is playing | Currently playing cue is open in drawer | 1. Edit valid fields 2. Click `Save` | Name/color/hotkey commit immediately to grid. Hotkey registration rebuilds for future triggers. Trim does not restart current playback and applies next trigger. | `Playing` + `Editing` if drawer stays open | Yes | Critical |
| EP-04 | Close/discard while cue is playing | Currently playing cue has unsaved drawer edits | 1. Click `Close` 2. Confirm discard | Playback continues with old committed state. Grid preview rolls back immediately. | `Playing` | Yes | High |
| EP-05 | Switch cards with unsaved edits | Drawer open on cue A with unsaved changes and cue B visible | 1. Right-click cue B | Discard confirmation appears. Confirm rolls cue A back and opens cue B. Cancel keeps cue A bound. | `Draft` or `Editing` | Yes | Critical |

## 6. End-State Reference

| State | Meaning | Retained Signals | Cleared Signals |
| --- | --- | --- | --- |
| `Ready` | Non-playing cue with no open drawer and no draft | Search/tag filter context | Editing marker, draft marker |
| `Playing` | Current active playback cue | Playback badge and playback emphasis | Draft marker if playback priority is active |
| `Draft` | Cue bound to drawer with unsaved changes | Drawer binding, preview emphasis, unsaved header state | Saved state, ready-only visuals |
| `Editing` | Cue bound to drawer with no unsaved changes | Drawer binding, editing marker | Draft marker |

## Regression Rule

- `Regression Required = Yes` means the case must be rerun for every RC cut and every bug fix touching the same path.
- `Severity If Failed` is the default release-blocking hint:
  - `Critical`: blocks RC or release
  - `High`: blocks merge unless explicitly waived
  - `Medium`: may merge with tracked follow-up only if risk is contained

This document is the frozen hand-test, regression, and RC acceptance baseline for the main window.
