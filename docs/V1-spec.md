# Code X Soundboard V1

## Product Scope

### Target
- Windows desktop soundboard for TikTok live workflows.
- Local-first and offline-first operation.
- Fast trigger-based playback with global shortcuts.
- Native, standalone desktop application from day one.
- Stable interaction and fixed shell layout take priority over web portability.

### Non-Negotiable Architecture Principles
- No WebView2, Electron renderer, or embedded browser is part of the primary V1 product path.
- Title bar, navigation, board workspace, cue editor drawer, and bottom transport are native desktop UI.
- Business logic, storage, playback, and shortcut handling execute through native desktop services.
- The layout is intentionally fixed to reduce runtime drift and interaction instability.

### Architecture Rule (Non-negotiable)
- UI Layer: WinUI ONLY
- Business Layer: C#/.NET ONLY
- Storage: SQLite (local)
- Audio / Hotkey: Native implementation

NO:
- WebView2
- React runtime
- Electron runtime

### Current Stage Rule
- The current stage is stability lockdown, not feature expansion.
- Do not add new features.
- Do not adjust page structure.
- Do not optimize layout.
- Do not refactor modules.
- Only fix confirmed problems on the main path: click -> playback -> edit -> undo.
- Current highest-priority fixes are:
  - first-click reliability
  - card color editing
  - waveform editing
  - playback-rate slider behavior
  - stable modifier hotkeys

### V1 Core Features
- Import audio by dragging files or folders.
- Folder import scans recursively for supported audio files.
- Imported files are copied into a managed local library.
- File deduplication is based on content hash.
- One audio resource can be referenced by multiple cue cards.
- Cue cards support independent display name, tags, tag color, hotkey, playback rate, volume, start time, and end time.
- Global shortcuts work when the app is unfocused.
- Default playback policy interrupts current playback when a new cue is triggered.
- Waveform editor supports drag selection plus exact time input.
- Search covers cue card name, tag names, and original resource name.
- Grid layout is the only V1 board view.
- Output device selection remains available.
- Language is switchable in settings and defaults to `zh-CN`.

### Explicit V1 Exclusions
- Loop playback.
- Hold-to-play / release-to-stop.
- List view.
- Batch editing.
- Pinyin search.
- Online library / download features.
- Theme marketplace or advanced skinning.

## Domain Model

### Audio Resource
- Represents one physical audio file stored in the managed library.
- Uses stable `resourceId`.
- Uses content hash for deduplication.
- Physical filename is storage-oriented, not user-facing.
- Stores metadata such as duration, channels, sample rate, imported path, and file size.

### Cue Card
- Represents one playable sound entry shown in the grid.
- References one `resourceId`.
- Owns user-facing properties:
  - display name
  - hotkey
  - playback rate
  - volume
  - trim start
  - trim end
  - sort order

### Tag
- User-defined classification item.
- Default color is derived deterministically from tag name.
- User can override tag color manually.

## Storage Strategy

### Installed Build
- App data root: `%LOCALAPPDATA%/Code X Soundboard/NativeShell`.
- Managed library: `%LOCALAPPDATA%/Code X Soundboard/NativeShell/library`.
- Database: `%LOCALAPPDATA%/Code X Soundboard/NativeShell/soundboard.db`.
- Waveform cache: `%LOCALAPPDATA%/Code X Soundboard/NativeShell/waveforms`.

### Portable Build
- Not part of the native-first V1 baseline.
- If added later, it must preserve the same native shell behavior and fixed layout.

## Import Rules
- Accept direct file drag and folder drag.
- Supported formats in V1: `mp3`, `wav`, `ogg`, `aac`, `flac`, `m4a`, `webm`.
- Files are hashed before insert.
- If hash already exists, reuse the existing resource and optionally create a new cue card.
- Physical library filename uses `resourceId + extension`.
- Card display name is initialized from source filename without extension.

## Playback Rules
- Default behavior stops current playback before starting another cue.
- Global hotkeys can be enabled or paused.
- Output device can be chosen per app, not per cue, in V1.
- Cue playback rate and cue volume apply to both preview and trigger playback.
- Trim start/end are non-destructive and do not rewrite source audio in V1.

## Main Screens

### Library Board
- Left rail: import, search, tag filter, transport, status.
- Center: cue card grid.
- Right rail: selected cue inspector and settings.
- Top title/search/status strip and bottom playback bar remain fixed native regions.
- The board does not reflow into browser-style responsive shells in V1.

### Cue Inspector
- Edit display name.
- Record hotkey.
- Edit tags.
- Adjust playback rate.
- Adjust cue volume.
- Edit trim with waveform + numeric fields.
- Preview selected segment.

### Settings
- Language.
- Output device.
- Global shortcut enable / pause.
- Missing file warning.

## Database Schema

### `app_meta`
- `key` TEXT PRIMARY KEY
- `value` TEXT NOT NULL

### `settings`
- `key` TEXT PRIMARY KEY
- `value` TEXT NOT NULL

### `audio_resources`
- `id` TEXT PRIMARY KEY
- `sha256` TEXT NOT NULL UNIQUE
- `storage_filename` TEXT NOT NULL
- `source_extension` TEXT NOT NULL
- `original_filename` TEXT NOT NULL
- `original_path` TEXT
- `mime_type` TEXT
- `duration_ms` INTEGER
- `sample_rate` INTEGER
- `channels` INTEGER
- `size_bytes` INTEGER NOT NULL
- `created_at` TEXT NOT NULL
- `updated_at` TEXT NOT NULL

### `cue_cards`
- `id` TEXT PRIMARY KEY
- `resource_id` TEXT NOT NULL REFERENCES `audio_resources(id)` ON DELETE CASCADE
- `name` TEXT NOT NULL
- `hotkey` TEXT NOT NULL DEFAULT ''
- `playback_rate` REAL NOT NULL DEFAULT 1.0
- `volume` REAL NOT NULL DEFAULT 1.0
- `trim_start_ms` INTEGER NOT NULL DEFAULT 0
- `trim_end_ms` INTEGER
- `sort_order` INTEGER NOT NULL DEFAULT 0
- `created_at` TEXT NOT NULL
- `updated_at` TEXT NOT NULL

### `tags`
- `id` TEXT PRIMARY KEY
- `name` TEXT NOT NULL UNIQUE
- `color` TEXT
- `color_mode` TEXT NOT NULL DEFAULT 'auto'
- `created_at` TEXT NOT NULL
- `updated_at` TEXT NOT NULL

### `cue_card_tags`
- `cue_card_id` TEXT NOT NULL REFERENCES `cue_cards(id)` ON DELETE CASCADE
- `tag_id` TEXT NOT NULL REFERENCES `tags(id)` ON DELETE CASCADE
- PRIMARY KEY (`cue_card_id`, `tag_id`)

## Module Layers

### Native WinUI Shell
- Window lifecycle and fixed shell composition.
- Native title bar, navigation, workspace, drawer, and transport controls.
- Native drag/drop, file pickers, and floating control window.

### Native Desktop Services
- Global shortcut registration.
- Storage path resolution.
- Database access.
- File import and managed library operations.
- Playback engine and output-device control.

### Shared Domain Layer
- Type definitions.
- Settings defaults.
- Persistence and playback contracts used by native shell modules.

## Open-Source Dependencies
- Windows App SDK / WinUI 3: native desktop shell and controls.
- `Microsoft.Data.Sqlite`: local relational persistence.
- `NAudio`: playback and device integration.
- `music-metadata`: audio metadata parsing where needed for import/inspection.

## Delivery Stages

### Stage 1
- Freeze native shell layout and storage paths.
- Add database initialization.
- Add native desktop bootstrap.

### Stage 2
- Build managed import pipeline with deduplication.
- Replace direct file-path cue model with resource/cue model.
- Lock down native drag/drop, file picking, and playback control flow.

### Stage 3
- Complete native board UI and inspector around the new model.
- Add waveform trim editor and hotkey recorder.

### Stage 4
- Add cleanup flows, migration, validation, and packaging polish.
- Remove transitional web-embedded assets from the shipping path.
