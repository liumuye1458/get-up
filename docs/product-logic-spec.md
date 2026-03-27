# Code X Soundboard Product Logic Spec

## Status

- This document is the authoritative product logic specification for the next development round.
- It is implementation-agnostic.
- It supersedes ad hoc discussion history as the primary source of truth.
- It does not assume Electron, WinUI, WebView2, or any specific UI stack.
- It defines what the product must do, how it should behave, and what the core interaction model is.

## 1. Product Positioning

### Core Definition

Code X Soundboard is a Windows live-stream sound effects tool.

It is not a backend management system.

It is not a media asset organizer first.

It is an operator tool for live use.

### Primary Usage Scenario

- TikTok live streaming
- MC / host / operator switching between live software, chat windows, and control surfaces
- Fast sound triggering while the soundboard is not always the focused application

### Primary Goal

Enable the user to:

1. find a sound quickly
2. trigger it immediately
3. keep global control over playback, hotkeys, and output state

## 2. Product Principles

### Principle A: Home view serves trigger speed

The default view must prioritize:

- search
- category switching
- cue recognition
- single-click trigger

### Principle B: Management features are secondary

Low-frequency capabilities must not occupy the main trigger area.

These include:

- settings
- backup/restore
- history
- diagnostics
- resource maintenance
- tag system management

### Principle C: Tool layout must stay stable

The application must use a fixed tool-shell layout:

- fixed top bar
- fixed left navigation
- fixed bottom control dock
- center workspace only changes content

### Principle D: Card first, form second

A cue card is first a trigger button, not a metadata card.

### Principle E: Right-click enters editing

Direct actions use left click.

Configuration and editing use right click.

## 3. Global Layout

The application is structured as:

1. top fixed status bar
2. left fixed navigation bar
3. bottom fixed playback/control dock
4. center workspace

Only the center workspace changes between library and management sections.

The top, left, and bottom areas remain fixed and visible at all times.

## 4. Top Bar

### Purpose

Global identity and high-frequency search.

### Required Elements

- software name
- sound search input
- window close button

### Optional Native Window Controls

- minimize
- maximize / restore

### Excluded Elements

The top bar must not carry:

- backup controls
- history lists
- diagnostics
- tag editing tools
- large settings blocks

## 5. Left Navigation

### Purpose

Persistent module switching.

### Required Navigation Entries

1. My Sounds
2. Tags
3. Backup
4. History
5. Diagnostics
6. Resources
7. Settings

### Rules

- Left navigation only exposes module entry points.
- It must not become a content panel.
- It must not carry detail views permanently.

### Workspace Switching Rule

Selecting an item in the left navigation changes the center workspace only.

The top bar, left navigation, and bottom dock remain unchanged.

## 6. Bottom Control Dock

### Purpose

Persistent live-operation controls.

### Required Controls

1. output device selector
2. global hotkey enable/disable control
3. global playback/pause control
4. stop all playback
5. global volume control
6. repeat playback toggle
7. floating control entry

### Output Device

- Must be shown directly in the bottom dock.
- Must use a dropdown selection model.
- Must reuse the app-wide output selection logic.
- It is a runtime control, not a settings-only item.

### Global Hotkey Toggle

- Must be shown in the bottom dock.
- Default hotkey: `Shift+Z`
- Left click: toggle global shortcuts on/off
- Right click: edit this control's hotkey

### Global Playback/Pause

- Must be shown in the bottom dock.
- Default hotkey: `Shift+Space`
- Left click: toggle playback/pause
- Right click: edit this control's hotkey

### Stop All

- Must stop all active cue playback immediately.

### Volume

- Must control global playback volume.

### Repeat Playback

- Must be shown as a dock control.
- Acts as a global playback behavior option.

### Global Hotkey Rules

The bottom-dock control hotkeys are not cue hotkeys.

They are global control hotkeys.

They must:

- participate in conflict checks
- not silently overwrite cue hotkeys
- not silently overwrite each other

## 7. Center Workspace

### Default Section

The default section is `My Sounds`.

### My Sounds Workspace Structure

From top to bottom:

1. category/tag strip
2. cue card grid

### Default Card Count

- Default visible set should be `40` cards.
- Do not force the user into density configuration before use.

### Import

- Primary import method is drag-and-drop into the workspace.
- File picker can exist as secondary import.
- Drag-and-drop is the main import path.

## 8. Cue Card Logic

### Cue Card Role

A cue card is a trigger button for a playable sound entry.

### Default Left-Click Behavior

- Single click directly plays the cue.

No double-click-to-play.

No select-then-play primary flow.

### Default Right-Click Behavior

- Opens cue editing entry path
- Right click is the primary edit/configure interaction

### Card Information Density

Cards must be minimal by default.

### Required Visible Data

- display name
- hotkey
- essential status

### Allowed Essential Status

- playing
- missing file
- hotkey conflict / invalid hotkey

### Data That Must Not Be Permanently Shown On The Card

- waveform
- file path
- detailed tags block
- duration
- playback rate
- trim range
- resource metadata

### Card Feedback

The playing card must visibly indicate active playback.

This indication must be:

- obvious
- lightweight
- non-disruptive

## 9. Cue Editing

### Entry

Cue editing is entered by right click on a card.

### Editing Container

Cue editing may use a drawer, panel, or context sheet, but it must remain single-cue scoped.

### Cue Editing Scope

Cue editing covers:

- cue display name
- tags
- tag colors for cue-attached tags
- cue hotkey
- playback rate
- volume
- trim start
- trim end
- waveform trim editing

### Cue Editing Exclusions

Cue editing must not absorb:

- global settings
- backup logic
- diagnostics center
- resource maintenance
- tag system governance

### Danger Actions

These must be low-priority and confirmed:

- delete cue
- destructive replacements

## 10. Data Model

### Audio Resource

Represents one physical audio file stored in the managed library.

Rules:

- stored once
- deduplicated by content hash
- referenced by stable `resourceId`
- physical filename is storage-oriented, not user-facing

### Cue Card

Represents one playable sound entry.

Rules:

- one resource can be referenced by multiple cue cards
- each cue card stores independent:
  - display name
  - tags
  - hotkey
  - playback rate
  - volume
  - trim start
  - trim end
  - sort order

### Tag

Represents a user-defined classification label.

Rules:

- free input
- deduplicated by name
- default color auto-generated from tag name
- user may override color

### Settings

Represents app-wide behavior.

Includes:

- language
- output device
- overlap/interruption policy
- global volume
- global shortcuts enabled
- hotkey suggestion strategy
- repeat playback behavior
- other global preferences

### History Entry

Represents one important completed operation.

Examples:

- import
- delete
- tag merge
- tag delete
- restore

### Backup Package

Represents a full-library backup artifact.

Contains:

- data model state
- managed library state
- metadata required for compatibility and integrity checks

## 11. Import Rules

### Supported Inputs

- individual audio files
- folders

### Folder Import

- recursively scans supported audio files

### Supported Formats

- mp3
- wav
- ogg
- aac
- flac
- m4a
- webm

### Managed Library Rule

Imported files are copied into the managed local library.

### Deduplication Rule

- deduplicate by content hash
- if the same content is imported again, reuse the existing resource
- multiple cue cards may still be created from the same resource

### Initial Cue Generation

Newly imported files should generate cue cards using source filename as initial display name.

## 12. Playback Rules

### Global Behavior

Default behavior:

- new cue interrupts current playback

### Playback Parameters

Cue playback must honor:

- cue playback rate
- cue volume
- trim start
- trim end
- current output device

### Output Device Rule

Output device is app-wide in V1.

### Trim Rule

Trim is non-destructive.

Source audio is not rewritten during normal cue editing.

## 13. Search and Filtering

### Search Scope

Search must cover:

- cue display name
- tag name
- original resource name

### Category / Tag Filtering

The My Sounds workspace must provide a light category/tag strip for fast narrowing.

This strip is for filtering only, not tag management.

## 14. Management Modules

The following modules live behind left navigation and change the center workspace only.

### 14.1 Tags

Purpose:

- govern the tag system

Includes:

- search tags
- rename
- merge
- delete
- recolor
- batch rename by rule

Excludes:

- single-cue tag editing
- homepage filtering logic

### 14.2 Backup

Purpose:

- full-library save and restore

Backup and restore must remain separate flows.

#### Export Flow

1. choose export
2. optional password
3. export
4. result

#### Restore Flow

1. select backup package
2. run checks
3. preview
4. choose restore mode / exclusions
5. confirm
6. execute
7. result summary

#### Restore Modes

Must explicitly support:

- full restore
- selective restore

#### Restore Requirements

Before confirmation, show:

- what will be overwritten
- what will be preserved
- current restore mode
- active exclusions

After restore, show:

- restore summary
- result details

If restore fails, show:

- explicit failure type

Backup module must not absorb:

- diagnostics
- resource cleanup
- cue editing

### 14.3 History

Purpose:

- show important operations
- allow limited undo

Must include records for:

- imports
- deletes
- tag operations
- restore operations

Undo should be supported for:

- imports
- deletes
- tag operations

Restore operations may be recorded without being regular one-click undo entries.

History must not become a general debug log browser.

### 14.4 Diagnostics

Purpose:

- detect issues
- provide repair entry points

Problem classes:

- missing files
- hotkey conflicts
- output/playback anomalies

Rules:

- diagnostics identifies problems
- diagnostics provides repair actions or jump-off points
- diagnostics does not become settings
- diagnostics does not become resource maintenance
- diagnostics does not become full cue editing

### 14.5 Resources

Purpose:

- maintain the managed audio library itself

Includes:

- library status
- unreferenced resources
- data directories
- cache information
- cleanup actions

Rules:

- resources module handles library maintenance only
- it does not own diagnostics
- it does not own backup/restore
- it does not own cue editing

### 14.6 Settings

Purpose:

- manage global system behavior

Includes:

- language
- output defaults
- playback behavior
- global shortcut behavior
- hotkey strategy
- session preferences

Rules:

- settings only govern global rules
- they do not own cue-level editing
- they do not own tag governance
- they do not own diagnostics workflows

## 15. Floating Control

### Purpose

Optional floating helper for out-of-focus operation.

### Scope

Must remain lightweight.

May include:

- hotkey on/off state
- key system status
- minimal abnormal state

Must not become:

- a second homepage
- a second management center
- a card trigger wall

## 16. Defaults

### Global Hotkeys

- global shortcut toggle: `Shift+Z`
- playback/pause toggle: `Shift+Space`

### Language

- default: `zh-CN`

### Card Presentation

- grid view
- default visible set: `40`

### Playback Policy

- interrupt current playback when triggering a new cue

## 17. Non-Functional Requirements

### Platform

- Windows only

### Persistence

The app must persist:

- cues
- resources
- tags
- settings
- history
- backup metadata

### Reopen Behavior

When the app is reopened, prior state must remain available.

### Performance

The main trigger path must remain responsive with large cue libraries.

### Offline

Core operation must work offline.

### Packaging

Must support a distributable desktop build.

## 18. Explicit Anti-Goals

The product must not drift into:

- backend management dashboard behavior
- multi-pane permanent admin clutter in the trigger view
- cue cards overloaded with metadata
- configuration-first homepage
- visually fixed shell but logically non-functional placeholder behavior

## 19. Delivery Rule For The Next Development Round

The next implementation round should be judged by this rule:

If the fixed shell opens but the library, card rendering, playback path, and dock controls are not truly connected to business logic, then the product is not considered working.

In other words:

- visible shell alone does not count
- card rendering must be real
- search/filter must be real
- playback must be real
- import must be real
- bottom-dock controls must be real

## 20. Suggested Development Order For Restart

When restarting in a new conversation, the recommended order is:

1. boot and load library snapshot
2. render category strip and cue grid
3. enable single-click playback
4. enable drag-and-drop import
5. wire bottom dock controls
6. wire right-click cue editing
7. wire left navigation modules one by one
8. finish packaging and final QA

This order should be preferred over shell-only or architecture-only milestones.
