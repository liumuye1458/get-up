using System;
using System.Collections.Generic;

namespace CodeXSoundboard.Shell.WinUI.Core;

public sealed record AppBootstrapSnapshot(
    IReadOnlyList<CueCardRecord> CueCards,
    IReadOnlyList<TagRecord> Tags,
    AppSettingsRecord Settings);

public sealed record CueCardRecord(
    string Id,
    string ResourceId,
    string DisplayName,
    string ResourceName,
    string ResourcePath,
    string CardColor,
    string Hotkey,
    double Volume,
    double PlaybackRate,
    double TrimStartSeconds,
    double? TrimEndSeconds,
    int SortOrder,
    IReadOnlyList<string> Tags,
    bool IsMissing,
    bool HasHotkeyConflict);

public sealed record TagRecord(
    string Id,
    string Name,
    string Color,
    int CueCount);

public sealed record TagAssignmentRecord(
    string Name,
    string Color);

public sealed record CueEditorRecord(
    string CueId,
    string DisplayName,
    string CardColor,
    string Hotkey,
    double Volume,
    double PlaybackRate,
    double TrimStartSeconds,
    double? TrimEndSeconds,
    IReadOnlyList<TagAssignmentRecord> Tags);

public sealed record AppSettingsRecord(
    string Language,
    string OutputDeviceId,
    double GlobalVolume,
    bool GlobalShortcutsEnabled,
    bool RepeatPlaybackEnabled,
    string HotkeyToggleAccelerator,
    string PlaybackToggleAccelerator);

public sealed record ImportAudioResult(
    int ImportedCueCount,
    int ImportedResourceCount,
    int ReusedResourceCount,
    int SkippedPathCount);

public sealed record OutputDeviceRecord(
    string DeviceId,
    string Label,
    bool IsDefault);

public sealed record CueDuplicateRequest(
    string SourceCueId,
    string DisplayName,
    string CardColor,
    double TrimStartSeconds,
    double? TrimEndSeconds,
    double Volume,
    double PlaybackRate,
    IReadOnlyList<TagAssignmentRecord> Tags);

public sealed record CueHistorySnapshotRecord(
    string CueId,
    string ResourceId,
    string DisplayName,
    string CardColor,
    string Hotkey,
    double Volume,
    double PlaybackRate,
    double TrimStartSeconds,
    double? TrimEndSeconds,
    int SortOrder,
    IReadOnlyList<TagAssignmentRecord> Tags);

public sealed record HistoryEntryRecord(
    string Id,
    string OperationType,
    string TargetType,
    string TargetId,
    string TargetLabel,
    string Summary,
    DateTimeOffset CreatedAt,
    bool CanUndo,
    bool IsUndone,
    string UndoState,
    string UndoMessage);
