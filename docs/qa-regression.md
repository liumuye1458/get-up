# V1 Regression QA

## Current Phase Focus

The project is in stability lockdown.

Before any broader regression pass, verify the main path first:

1. click
2. playback
3. edit
4. undo

Current top-priority checks:

- Card click works on the first attempt with no swallowed click.
- Color editing works for every card, not just selected edge cases.
- Waveform editor is available and updates trim correctly.
- Playback-rate slider changes actual playback behavior.
- Modifier hotkeys register reliably and survive repeated use.

## Automated regression

Run:

```powershell
npm run test:regression
```

Coverage in `tests/regression.test.mjs`:

- Settings persistence after reopen
- Cue delete and undo restoration of:
  - cue row
  - tag bindings
  - managed library file
  - trash-based restore path
- Starter pack creation and repeated reuse behavior
- Backup export and restore round-trip for:
  - managed library files
  - cue metadata
  - persisted settings
  - single-file compressed backup package
- Backup compatibility inspection for legacy and newer schema versions
- Backup package integrity inspection and corrupted-package rejection
- Password-protected backup restore with required password gating
- Backup restore preview diff for cues, tags, and resources
- Expandable restore diff details for shared/incoming/current-only entries
- Searchable restore diff items by cue, tag, or resource name
- Export restore diff items as a text report
- Export restore diff items as CSV and JSON
- Bulk hotkey repair for duplicate and reserved shortcuts
- Imported-cue hotkey suggestions with non-conflicting assignments
- Tag-grouped hotkey suggestions
- Standalone tag manager with rename, recolor, and delete
- Undo history for tag merge and tag delete
- Batch merge from the standalone tag manager
- Batch delete and batch recolor from the standalone tag manager

## Manual E2E smoke check

### 1. Settings persistence

Steps:

1. Launch the app.
2. Change language.
3. Change master volume.
4. Toggle `Allow overlap`.
5. Toggle `Stop current playback when a new cue starts`.
6. Toggle `Warn on missing files`.
7. Toggle `Enable global shortcuts`.
8. Change output device if another output is available.
9. Close the app fully.
10. Relaunch the app.

Expected:

- All changed settings are restored from the previous session.
- The history policy text still renders in the left rail.
- Hotkey diagnostics still refresh after relaunch.

### 2. Delete confirmation + undo chain

Steps:

1. Import at least one playable audio file.
2. Select the cue.
3. Click `Delete cue`.
4. In the confirmation dialog, click `Cancel`.
5. Confirm the cue still exists and remains selected.
6. Click `Delete cue` again.
7. In the confirmation dialog, click `Delete now`.
8. Confirm the cue disappears from the board.
9. Confirm a new delete history entry appears in the left rail.
10. Click `Undo` on that delete history entry.

Expected:

- The first cancel path makes no data change.
- The confirmed delete removes the cue immediately.
- If the resource became unreferenced, it is moved out of the library and tracked by history.
- Undo restores the cue card with its original:
  - name
  - hotkey
  - tags
  - trim values
  - playback settings
- The restored cue plays normally.
- The history row switches to `undone` state and becomes non-clickable.

### 3. Optional edge check

Steps:

1. Delete a cue whose resource is shared by another cue.
2. Undo the delete.

Expected:

- Shared resource file is not removed during delete.
- Undo restores only the deleted cue card and does not duplicate the resource file.

### 4. First-run onboarding + starter pack

Steps:

1. Start with an empty data directory.
2. Launch the app.
3. Confirm the empty state shows both:
   - `Import audio`
   - `Create starter pack`
4. Click `Create starter pack`.

Expected:

- Empty state is replaced by demo cue cards.
- A new import history row is created for the starter pack.
- The created cues can be previewed immediately.

### 5. Large import progress feedback

Steps:

1. Prepare a folder with many audio files.
2. Drag the folder into the app.

Expected:

- A scanning state appears before import begins.
- A determinate progress bar appears during the actual import stage.
- Current file label updates while importing.
- Final import report still renders after progress completes.

### 6. Backup export + restore

Steps:

1. Import a few cues and change at least one setting.
2. Use `Export backup`.
3. Confirm a single `.cxsb` backup file is created.
4. Make a visible change in the live app:
   - delete a cue
   - or change a hotkey / language / tags
5. Use `Import backup`.
6. Choose the exported `.cxsb` package.
7. Confirm the destructive restore dialog.

Expected:

- The current library is replaced by the backup content.
- Cue cards, tags, settings, and managed files match the exported state.
- Missing-file diagnostics are refreshed after restore.
- Hotkey diagnostics are recalculated after restore.
- Backup export does not leave behind an unpacked folder structure.

### 7. Password-protected backup package

Steps:

1. Import at least one cue so the library is non-empty.
2. Use `Export backup`.
3. Enter a password and matching confirmation, then finish export.
4. Confirm a single `.cxsb` file is created.
5. Open `Import backup` and choose that protected package.
6. Confirm the preview indicates password protection and keeps restore disabled until a password is entered.
7. Enter a wrong password and try restore.
8. Re-open the protected package preview if needed, then enter the correct password and restore.

Expected:

- Protected backups show both compatibility and integrity state in preview.
- Restore remains disabled until a password is provided.
- Wrong passwords are blocked before any partial restore occurs.
- Correct passwords allow a full restore of cues, tags, settings, and managed files.

### 8. Bulk hotkey repair

Steps:

1. Create several problematic hotkeys:
   - duplicate one hotkey across two cues
   - assign a reserved shortcut like `Alt+F4`
   - assign a single-key shortcut like `1`
2. Open `Repair hotkeys` from the diagnostics area or hotkey alert strip.
3. Toggle specific repair scopes on and off.
4. Run `Auto-assign safe hotkeys`.
5. Re-open the repair dialog and run `Clear selected hotkeys` on one scope.

Expected:

- Scope counts match the currently detected problem groups.
- Auto-assign replaces only the selected problem cues.
- New assignments avoid duplicates and reserved shortcuts.
- Clear removes hotkeys only from the selected scope.
- The alert strip and inspector warnings update immediately after each repair pass.

### 9. Backup compatibility prompt

Steps:

1. Export a backup from the current app.
2. Open `Import backup`.
3. Choose the exported backup folder.
4. Confirm the restore dialog shows:
   - backup format version
   - backup schema version
   - current schema version
   - selected backup path
5. Verify the restore button remains enabled for a compatible backup.

Expected:

- The compatibility block appears before any destructive restore happens.
- Compatible backups show a ready state.
- Older backups show a warning state instead of a hard block.
- Newer unsupported backups show a blocked state and disable the restore action.

### 10. Corrupted backup package

Steps:

1. Export a `.cxsb` backup package.
2. Make a damaged copy of that file by truncating or editing it externally.
3. Open `Import backup`.
4. Choose the damaged package.

Expected:

- The preview still opens if possible, but integrity status is shown separately from version compatibility.
- Damaged or unreadable packages show a failed integrity state.
- Restore action is disabled when integrity validation fails.
- The app does not partially restore data from a damaged package.

### 11. Suggested hotkeys after import

Steps:

1. Import multiple audio files in one batch.
2. Open the import report.
3. Confirm a suggested hotkey block appears.
4. Review several proposed cue-name / hotkey pairs.
5. Uncheck one or more suggested cues to skip them.
5. Change the hotkey suggestion strategy in settings.
6. Import another batch and verify suggestions reflect the new strategy.
7. Click `Apply suggested hotkeys`.

Expected:

- Suggestions appear only for newly imported cues without existing hotkeys.
- Suggested hotkeys do not duplicate existing assignments.
- Suggestions follow the configured strategy for modifier groups and key families.
- Unchecked suggestions are skipped and remain without new hotkeys.
- Applying suggestions updates the imported cues immediately.
- The suggestion block disappears after successful apply.

### 12. Tag-grouped hotkey suggestions

Steps:

1. In settings, change `Hotkey suggestion grouping mode` to `Tag`.
2. Import a batch of audio files and assign at least two different tags across the newly created cues.
3. Trigger a new suggestion pass by importing another batch or clearing and reopening the current import report.
4. Review the suggestion list.
5. Uncheck one suggestion from one tag group and apply the remaining suggestions.

Expected:

- Suggestion rows show their tag group label when grouping is enabled.
- Suggestions are clustered by the first tag on each cue.
- Skipped suggestions remain unassigned while checked items are applied.
- Applied suggestions still avoid duplicates and reserved shortcuts across groups.

### 13. Backup restore diff preview

Steps:

1. Prepare a live library with at least:
   - one cue name that exists only in the current library
   - one cue name that also exists in the backup
2. Export a backup from a different library state, or import a known backup package with overlapping and non-overlapping cue names.
3. Open `Import backup`.
4. Choose the backup package and wait for the preview dialog.

Expected:

- The preview shows a dedicated restore-diff block before confirmation.
- The diff is grouped into:
  - cue cards
  - tags
  - resources
- Each group shows current count, backup count, shared count, and sample names for:
  - only in backup
  - only in current library
- If the backup is older and does not contain a preview catalog, the dialog shows a graceful “preview unavailable” message instead of failing.

### 14. Enhanced bulk tag operations

Steps:

1. Select multiple cue cards with partially overlapping tags.
2. Confirm the bulk panel shows:
   - common tags
   - selected tag inventory with per-tag coverage counts
3. Click an inventory tag chip once.
4. Confirm it is staged into the bulk tag input.
5. Click the same chip again.
6. Confirm it is removed from the staged input.
7. Click a common-tag chip.
8. Confirm that tag is removed from every selected cue.
9. Click `Clear all tags`.

Expected:

- Inventory chips reflect how many selected cues already contain each tag.
- Clicking an inventory chip toggles that tag in the bulk input without immediately mutating data.
- Clicking a common-tag chip removes that tag from all selected cues in one action.
- `Clear all tags` removes every tag from the selected cues.
- Selection stays intact after each batch-tag action.

### 15. Expandable backup restore diff details

Steps:

1. Open `Import backup` and choose a package that has both overlapping and non-overlapping names.
2. In the restore preview, locate the diff groups for cue cards, tags, and resources.
3. Click `Show details` on each group.
4. Review the full itemized lists for:
   - only in backup
   - only in current library
   - shared by name
5. Click `Hide details`.

Expected:

- Each group expands independently.
- Expanded state reveals the full itemized names, not just sample chips.
- Collapsing returns to the compact sample view.
- Large lists remain scrollable within the dialog and do not break layout.

### 16. Backup restore diff search

Steps:

1. Open `Import backup` and choose a package with multiple differing cue, tag, and resource names.
2. In the restore preview, enter a partial name into the diff search field.
3. Try a cue name, a tag name, and a resource name.
4. Try a keyword that matches nothing.

Expected:

- Search filters diff items across all three sections.
- Matching items remain grouped under cue cards, tags, and resources.
- “No matching items” appears for empty columns.
- A fully unmatched keyword shows a clear no-results message instead of an empty broken layout.

### 17. Backup restore diff text export

Steps:

1. Open `Import backup` and choose a package with visible differences.
2. Optionally enter a diff-search keyword.
3. Click `Export text report`.
4. Save the report to a `.txt` file.
5. Open the exported file externally.

Expected:

- Export uses the current filtered diff view.
- The text report includes:
  - selected backup path
  - version summary
  - current diff-search keyword
  - cue/tag/resource sections
  - incoming/current-only/shared item lists
- Export success shows a visible status message.

### 18. Backup restore diff CSV / JSON export

Steps:

1. Open `Import backup` and choose a package with visible differences.
2. Optionally enter a diff-search keyword.
3. Click `Export CSV`, save the file, and open it externally.
4. Click `Export JSON`, save the file, and open it externally.

Expected:

- CSV export contains flat rows with section, bucket, and name columns.
- JSON export contains structured metadata plus per-section incoming/current-only/shared arrays.
- Both exports reflect the current diff-search filter.
- Successful export shows the saved path in the app status line.

### 19. Standalone tag manager

Steps:

1. Ensure the library contains several tags used by multiple cues.
2. Open the right-side tag manager panel.
3. Search for a tag by name.
4. Select a tag row and rename it.
5. Change its color using the palette.
6. Select a tag that is used by multiple cues and delete it.

Expected:

- The tag manager works without changing the currently selected cue.
- Search filters the tag list immediately.
- Rename updates all cues that reference that tag.
- Renaming into an existing tag name merges references instead of creating duplicates.
- Color changes propagate everywhere that tag appears.
- Deleting a tag removes it from all affected cues and updates the board immediately.

### 20. Tag merge/delete undo history

Steps:

1. In the tag manager, rename one tag to the exact name of another existing tag.
2. Confirm the two tags merge in the board.
3. Open the history panel and locate the new tag history entry.
4. Click `Undo`.
5. Delete a tag from the tag manager.
6. Confirm another tag history entry appears.
7. Click `Undo` on that delete entry.

Expected:

- Tag merge creates a dedicated history entry.
- Undo after merge restores the original two-tag state and affected cue bindings.
- Tag delete creates a dedicated history entry.
- Undo after delete restores the deleted tag and its bindings without disturbing unrelated tags.

### 21. Batch tag merge from tag manager

Steps:

1. In the tag manager, select multiple tags using the row checkboxes.
2. Enter a target tag name in the rename field.
3. Click `Merge selected tags`.
4. Confirm the selected tags collapse into a single target tag.
5. Open history and click `Undo` on the batch-merge entry.

Expected:

- Batch merge creates one history entry for the grouped operation.
- All selected tags are consolidated into the target tag name.
- Cue bindings move to the merged target without duplicates.
- Undo restores the original tags and their bindings.

### 22. Batch tag recolor and delete from tag manager

Steps:

1. In the tag manager, select multiple tags with the row checkboxes.
2. Click one of the preset color swatches in the batch tool area.
3. Confirm all selected tags update color across the board.
4. Click `Reset selected colors`.
5. Confirm the selected tags return to auto color mode.
6. Click `Delete selected tags`.
7. Confirm a batch-delete history entry appears.
8. Click `Undo` on that history entry.

Expected:

- Batch recolor applies the chosen color to every selected tag.
- Reset returns all selected tags to auto color mode.
- Batch delete removes all selected tags from affected cues.
- Batch delete creates a single grouped history entry.
- Undo restores the deleted tags and their cue bindings.

### 23. Tag manager usage and recent sorting

Steps:

1. Ensure the library contains several tags with different cue counts.
2. Open the tag manager and switch sort mode to `Most used`.
3. Confirm tags used by more cues move to the top.
4. Change tags on one cue so an existing tag is re-applied or newly attached.
5. Switch sort mode to `Recently used`.
6. Confirm the tag touched in step 4 rises to the top of the list.
7. Switch back to `A-Z`.

Expected:

- `Most used` sorts descending by the number of cues using each tag.
- Changing cue-tag bindings refreshes the touched tag's recent timestamp.
- `Recently used` sorts descending by the latest tag activity.
- The selected sort mode remains the same after closing and reopening the app.
- `A-Z` returns the list to alphabetical order.

### 24. Backup diff export summary header

Steps:

1. Open backup restore preview with a backup that has cue, tag, and resource differences.
2. Enter a diff search keyword so the visible diff list is filtered.
3. Export the diff report as `TXT`.
4. Export the diff report as `CSV`.
5. Export the diff report as `JSON`.

Expected:

- Every export begins with a summary header for the current filtered view.
- TXT includes summary title, matched-section count, total counts, and per-section count lines before detailed item lists.
- CSV begins with summary rows before item rows.
- JSON includes a structured `summary` object alongside section details.
- Exported counts match the active diff-search filter, not the unfiltered backup catalog.

### 25. Backup diff summary header in restore preview

Steps:

1. Open backup restore preview with a backup that has multiple cue, tag, and resource differences.
2. Type a diff search keyword to reduce the visible result set.
3. Check the summary area above the diff groups.
4. Clear the search keyword and check the summary again.

Expected:

- The restore preview shows a visible summary header before the detailed diff groups.
- The summary shows matched-section count, total counts, and per-section counts.
- The summary updates immediately when the diff-search keyword changes.
- The summary numbers match the currently visible filtered diff view.

### 26. Selective restore exclusions from backup preview

Steps:

1. Open backup restore preview with visible incoming-only, current-only, and shared diff items.
2. Tick several cue/tag/resource names across the diff columns.
3. Confirm the exclusion counter increases.
4. Run restore.
5. Reopen the board and compare the restored library against the preview choices.

Expected:

- Checked diff items are treated as exclusions for the restore process.
- Excluding backup-only items prevents their related backup content from being restored.
- Excluding current-only or shared items keeps the current library version where applicable.
- `Clear exclusions` resets the selection counter and removes all checked states.

### 27. Tag manager rule-based batch rename

Steps:

1. In the tag manager, select multiple tags.
2. Use the batch rename rule block to set find/replace, prefix/suffix, case mode, and whitespace options.
3. Verify the preview list updates before applying.
4. Click the batch rename apply button.
5. Open history and undo the new tag entry.

Expected:

- Preview updates immediately as the rename rule changes.
- Only tags whose resulting name changes are applied.
- Resulting names are merged when the rule produces duplicates.
- The operation creates a grouped undoable history entry.

### 28. Restore exclusion templates

Steps:

1. Open backup restore preview with several diff items available.
2. Tick a mixed set of cue, tag, and resource exclusions.
3. Enter a template name in the exclusion-template block.
4. Click `Save template`.
5. Clear exclusions.
6. Click the saved template chip.
7. Delete the same template.

Expected:

- Saving the template persists it immediately without closing the dialog.
- Clearing exclusions resets the checked diff items.
- Applying the saved template re-checks the same diff items.
- The active template chip highlights when its selection matches the current exclusion state.
- Deleting the template removes it from the list and prevents further reuse.

### 29. Tag rule-rename warnings

Steps:

1. In the tag manager, select several tags including:
   - one that would become empty under the rule
   - one that would stay unchanged
   - one that would collide with an existing unselected tag
   - two that would collapse into the same renamed value
2. Adjust the rule-based rename fields until all four cases appear in preview.
3. Review the warning block before applying.

Expected:

- The warning block appears only when at least one risky or no-op case exists.
- Empty-result tags are called out as skipped.
- Unchanged tags are called out as no-op writes.
- Existing-tag collisions are explained as merges into tags outside the current selection.
- In-selection duplicate results are explained as merges within the current selection.
