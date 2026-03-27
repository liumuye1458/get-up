using Microsoft.Data.Sqlite;
using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;

namespace CodeXSoundboard.Shell.WinUI.Core;

public sealed class SoundboardRepository
{
    private static readonly HashSet<string> SupportedAudioExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".mp3",
        ".wav",
        ".ogg",
        ".aac",
        ".flac",
        ".m4a",
        ".webm",
    };

    private readonly string _dataRoot;
    private readonly string _libraryRoot;
    private readonly string _databasePath;
    private readonly JsonSerializerOptions _jsonOptions = new(JsonSerializerDefaults.Web);

    public SoundboardRepository()
    {
        _dataRoot = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "Code X Soundboard",
            "NativeShell");
        _libraryRoot = Path.Combine(_dataRoot, "library");
        _databasePath = Path.Combine(_dataRoot, "soundboard.db");
    }

    public Task InitializeAsync()
    {
        Directory.CreateDirectory(_dataRoot);
        Directory.CreateDirectory(_libraryRoot);

        using var connection = OpenConnection();
        using var command = connection.CreateCommand();
        command.CommandText =
            """
            PRAGMA foreign_keys = ON;

            CREATE TABLE IF NOT EXISTS audio_resources (
                id TEXT PRIMARY KEY,
                content_hash TEXT NOT NULL UNIQUE,
                original_name TEXT NOT NULL,
                file_extension TEXT NOT NULL,
                storage_relative_path TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS cue_cards (
                id TEXT PRIMARY KEY,
                resource_id TEXT NOT NULL,
                display_name TEXT NOT NULL,
                card_color TEXT,
                hotkey TEXT,
                volume REAL NOT NULL DEFAULT 1.0,
                playback_rate REAL NOT NULL DEFAULT 1.0,
                trim_start REAL NOT NULL DEFAULT 0,
                trim_end REAL,
                sort_order INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                FOREIGN KEY(resource_id) REFERENCES audio_resources(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS tags (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL UNIQUE,
                color TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS cue_tag_links (
                cue_id TEXT NOT NULL,
                tag_id TEXT NOT NULL,
                PRIMARY KEY(cue_id, tag_id),
                FOREIGN KEY(cue_id) REFERENCES cue_cards(id) ON DELETE CASCADE,
                FOREIGN KEY(tag_id) REFERENCES tags(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS app_settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS history_entries (
                id TEXT PRIMARY KEY,
                operation_type TEXT NOT NULL,
                target_type TEXT NOT NULL,
                target_id TEXT NOT NULL,
                target_label TEXT NOT NULL,
                summary TEXT NOT NULL,
                created_at TEXT NOT NULL,
                can_undo INTEGER NOT NULL,
                undo_payload TEXT,
                undone_at TEXT
            );
            """;
        command.ExecuteNonQuery();
        EnsureCueCardColorColumn(connection);

        SeedDefaultSetting(connection, "language", "zh-CN");
        SeedDefaultSetting(connection, "outputDeviceId", string.Empty);
        SeedDefaultSetting(connection, "globalVolume", "0.8");
        SeedDefaultSetting(connection, "globalShortcutsEnabled", "1");
        SeedDefaultSetting(connection, "repeatPlaybackEnabled", "0");
        SeedDefaultSetting(connection, "hotkeyToggleAccelerator", "Shift+Z");
        SeedDefaultSetting(connection, "playbackToggleAccelerator", "Shift+Space");

        return Task.CompletedTask;
    }

    private static void EnsureCueCardColorColumn(SqliteConnection connection)
    {
        using var command = connection.CreateCommand();
        command.CommandText = "PRAGMA table_info(cue_cards);";
        using var reader = command.ExecuteReader();

        while (reader.Read())
        {
            if (string.Equals(reader.GetString(1), "card_color", StringComparison.OrdinalIgnoreCase))
            {
                return;
            }
        }

        using var alter = connection.CreateCommand();
        alter.CommandText = "ALTER TABLE cue_cards ADD COLUMN card_color TEXT;";
        alter.ExecuteNonQuery();
    }

    public Task<AppBootstrapSnapshot> LoadSnapshotAsync()
    {
        using var connection = OpenConnection();
        var settings = LoadSettings(connection);
        var cueTags = LoadCueTags(connection);
        var hotkeyCounts = LoadHotkeyCounts(connection);

        var cueCards = new List<CueCardRecord>();
        using (var command = connection.CreateCommand())
        {
            command.CommandText =
                """
                SELECT
                    cue.id,
                    cue.resource_id,
                    cue.display_name,
                    cue.card_color,
                    cue.hotkey,
                    cue.volume,
                    cue.playback_rate,
                    cue.trim_start,
                    cue.trim_end,
                    cue.sort_order,
                    resource.original_name,
                    resource.storage_relative_path
                FROM cue_cards AS cue
                INNER JOIN audio_resources AS resource
                    ON resource.id = cue.resource_id
                ORDER BY cue.sort_order ASC, cue.created_at ASC;
                """;

            using var reader = command.ExecuteReader();
            while (reader.Read())
            {
                var cueId = reader.GetString(0);
                var resourcePath = Path.Combine(_dataRoot, reader.GetString(11));
                cueCards.Add(new CueCardRecord(
                    cueId,
                    reader.GetString(1),
                    reader.GetString(2),
                    reader.IsDBNull(3) ? string.Empty : reader.GetString(3),
                    reader.GetString(10),
                    resourcePath,
                    reader.IsDBNull(4) ? string.Empty : reader.GetString(4),
                    reader.GetDouble(5),
                    reader.GetDouble(6),
                    reader.GetDouble(7),
                    reader.IsDBNull(8) ? null : reader.GetDouble(8),
                    reader.GetInt32(9),
                    cueTags.TryGetValue(cueId, out var cueTagNames) ? cueTagNames : Array.Empty<string>(),
                    !File.Exists(resourcePath),
                    HotkeyNormalizer.HasConflict(reader.IsDBNull(4) ? null : reader.GetString(4), hotkeyCounts)));
            }
        }

        var tags = new List<TagRecord>();
        using (var command = connection.CreateCommand())
        {
            command.CommandText =
                """
                SELECT
                    tag.id,
                    tag.name,
                    tag.color,
                    COUNT(link.cue_id) AS cue_count
                FROM tags AS tag
                LEFT JOIN cue_tag_links AS link
                    ON link.tag_id = tag.id
                GROUP BY tag.id, tag.name, tag.color
                ORDER BY tag.name COLLATE NOCASE ASC;
                """;

            using var reader = command.ExecuteReader();
            while (reader.Read())
            {
                tags.Add(new TagRecord(
                    reader.GetString(0),
                    reader.GetString(1),
                    reader.GetString(2),
                    reader.GetInt32(3)));
            }
        }

        return Task.FromResult(new AppBootstrapSnapshot(
            cueCards,
            tags,
            new AppSettingsRecord(
                settings.GetValueOrDefault("language", "zh-CN"),
                settings.GetValueOrDefault("outputDeviceId", string.Empty),
                ParseDouble(settings.GetValueOrDefault("globalVolume", "0.8"), 0.8),
                settings.GetValueOrDefault("globalShortcutsEnabled", "1") != "0",
                settings.GetValueOrDefault("repeatPlaybackEnabled", "0") == "1",
                settings.GetValueOrDefault("hotkeyToggleAccelerator", "Shift+Z"),
                settings.GetValueOrDefault("playbackToggleAccelerator", "Shift+Space"))));
    }

    public Task UpdateSettingAsync(string key, string value)
    {
        using var connection = OpenConnection();
        UpsertSetting(connection, key, value);
        return Task.CompletedTask;
    }

    public Task<IReadOnlyList<HistoryEntryRecord>> ListHistoryAsync(int limit = 100)
    {
        using var connection = OpenConnection();
        var rawEntries = LoadHistoryEnvelopes(connection, limit);
        var result = EvaluateHistoryEntries(connection, rawEntries);
        return Task.FromResult<IReadOnlyList<HistoryEntryRecord>>(result);
    }

    public Task<bool> UndoHistoryEntryAsync(string historyEntryId)
    {
        using var connection = OpenConnection();
        using var transaction = connection.BeginTransaction();

        var rawEntries = LoadHistoryEnvelopes(connection, 500, transaction);
        var evaluatedEntries = EvaluateHistoryEntries(connection, rawEntries, transaction)
            .ToDictionary(entry => entry.Id, StringComparer.OrdinalIgnoreCase);

        if (!evaluatedEntries.TryGetValue(historyEntryId, out var evaluatedEntry) || !evaluatedEntry.CanUndo)
        {
            return Task.FromResult(false);
        }

        var envelope = rawEntries.First(entry => string.Equals(entry.Id, historyEntryId, StringComparison.OrdinalIgnoreCase));

        switch (envelope.OperationType)
        {
            case HistoryOperationCueEdit:
            {
                var payload = Deserialize<CueEditUndoPayload>(envelope.UndoPayload);
                RestoreCueSnapshot(connection, transaction, payload.PreviousCue);
                break;
            }
            case HistoryOperationCueDelete:
            {
                var payload = Deserialize<CueDeleteUndoPayload>(envelope.UndoPayload);
                RestoreCueSnapshot(connection, transaction, payload.DeletedCue);
                break;
            }
            case HistoryOperationCueDuplicate:
            {
                var payload = Deserialize<CueDuplicateUndoPayload>(envelope.UndoPayload);
                DeleteCueInternal(connection, transaction, payload.CreatedCueId);
                break;
            }
            default:
                return Task.FromResult(false);
        }

        MarkHistoryEntryUndone(connection, transaction, envelope.Id);
        InsertHistoryEntry(
            connection,
            transaction,
            HistoryOperationUndo,
            envelope.TargetType,
            envelope.TargetId,
            envelope.TargetLabel,
            $"Undid: {envelope.Summary}",
            canUndo: false,
            undoPayload: null);

        transaction.Commit();
        return Task.FromResult(true);
    }

    public Task<ImportAudioResult> ImportAudioPathsAsync(IEnumerable<string> inputPaths)
    {
        var uniqueFiles = EnumerateAudioFiles(inputPaths).Distinct(StringComparer.OrdinalIgnoreCase).ToList();
        var skippedPathCount = uniqueFiles.Count(path => !File.Exists(path));
        var nextSortOrder = GetNextSortOrder();
        var importedCueCount = 0;
        var importedResourceCount = 0;
        var reusedResourceCount = 0;

        using var connection = OpenConnection();
        using var transaction = connection.BeginTransaction();

        foreach (var filePath in uniqueFiles.Where(File.Exists))
        {
            var hash = ComputeContentHash(filePath);
            var resource = FindResourceByHash(connection, hash, transaction);
            string resourceId;

            if (resource is null)
            {
                resourceId = Guid.NewGuid().ToString("N");
                var extension = Path.GetExtension(filePath);
                var relativePath = Path.Combine("library", $"{resourceId}{extension}");
                var targetPath = Path.Combine(_dataRoot, relativePath);
                Directory.CreateDirectory(Path.GetDirectoryName(targetPath)!);
                File.Copy(filePath, targetPath, overwrite: false);

                using var resourceCommand = connection.CreateCommand();
                resourceCommand.Transaction = transaction;
                resourceCommand.CommandText =
                    """
                    INSERT INTO audio_resources (
                        id,
                        content_hash,
                        original_name,
                        file_extension,
                        storage_relative_path,
                        created_at
                    ) VALUES (
                        $id,
                        $contentHash,
                        $originalName,
                        $fileExtension,
                        $storageRelativePath,
                        $createdAt
                    );
                    """;
                resourceCommand.Parameters.AddWithValue("$id", resourceId);
                resourceCommand.Parameters.AddWithValue("$contentHash", hash);
                resourceCommand.Parameters.AddWithValue("$originalName", Path.GetFileName(filePath));
                resourceCommand.Parameters.AddWithValue("$fileExtension", extension);
                resourceCommand.Parameters.AddWithValue("$storageRelativePath", relativePath);
                resourceCommand.Parameters.AddWithValue("$createdAt", DateTimeOffset.UtcNow.ToString("O"));
                resourceCommand.ExecuteNonQuery();

                importedResourceCount++;
            }
            else
            {
                resourceId = resource.Value.ResourceId;
                reusedResourceCount++;
            }

            InsertCueCard(
                connection,
                transaction,
                Guid.NewGuid().ToString("N"),
                resourceId,
                Path.GetFileNameWithoutExtension(filePath),
                string.Empty,
                string.Empty,
                1.0,
                1.0,
                0,
                null,
                nextSortOrder++);

            importedCueCount++;
        }

        transaction.Commit();

        return Task.FromResult(new ImportAudioResult(
            importedCueCount,
            importedResourceCount,
            reusedResourceCount,
            skippedPathCount));
    }

    public Task SaveCueAsync(CueEditorRecord editor)
    {
        var normalizedEditor = NormalizeEditor(editor);

        using var connection = OpenConnection();
        using var transaction = connection.BeginTransaction();
        var previousCue = GetCueSnapshot(connection, transaction, normalizedEditor.CueId)
            ?? throw new InvalidOperationException($"Cue '{normalizedEditor.CueId}' was not found.");

        using (var updateCue = connection.CreateCommand())
        {
            updateCue.Transaction = transaction;
            updateCue.CommandText =
                """
                UPDATE cue_cards
                SET
                    display_name = $displayName,
                    card_color = $cardColor,
                    hotkey = $hotkey,
                    volume = $volume,
                    playback_rate = $playbackRate,
                    trim_start = $trimStart,
                    trim_end = $trimEnd
                WHERE id = $cueId;
                """;
            updateCue.Parameters.AddWithValue("$displayName", normalizedEditor.DisplayName);
            updateCue.Parameters.AddWithValue("$cardColor", string.IsNullOrWhiteSpace(normalizedEditor.CardColor) ? DBNull.Value : normalizedEditor.CardColor);
            updateCue.Parameters.AddWithValue("$hotkey", string.IsNullOrWhiteSpace(normalizedEditor.Hotkey) ? DBNull.Value : normalizedEditor.Hotkey);
            updateCue.Parameters.AddWithValue("$volume", normalizedEditor.Volume);
            updateCue.Parameters.AddWithValue("$playbackRate", normalizedEditor.PlaybackRate);
            updateCue.Parameters.AddWithValue("$trimStart", normalizedEditor.TrimStartSeconds);
            updateCue.Parameters.AddWithValue("$trimEnd", normalizedEditor.TrimEndSeconds is double trimEnd
                ? trimEnd
                : DBNull.Value);
            updateCue.Parameters.AddWithValue("$cueId", normalizedEditor.CueId);
            updateCue.ExecuteNonQuery();
        }

        ReplaceCueTags(connection, transaction, normalizedEditor.CueId, normalizedEditor.Tags);
        var currentCue = GetCueSnapshot(connection, transaction, normalizedEditor.CueId)
            ?? throw new InvalidOperationException($"Cue '{normalizedEditor.CueId}' was not found after update.");

        if (!AreCueSnapshotsEqual(previousCue, currentCue))
        {
            InsertHistoryEntry(
                connection,
                transaction,
                HistoryOperationCueEdit,
                "cue",
                currentCue.CueId,
                currentCue.DisplayName,
                BuildCueEditSummary(previousCue, currentCue),
                canUndo: true,
                undoPayload: new CueEditUndoPayload(previousCue));
        }

        transaction.Commit();

        return Task.CompletedTask;
    }

    public Task DeleteCueAsync(string cueId)
    {
        using var connection = OpenConnection();
        using var transaction = connection.BeginTransaction();
        var deletedCue = GetCueSnapshot(connection, transaction, cueId);
        if (deletedCue is not null)
        {
            DeleteCueInternal(connection, transaction, cueId);
            InsertHistoryEntry(
                connection,
                transaction,
                HistoryOperationCueDelete,
                "cue",
                deletedCue.CueId,
                deletedCue.DisplayName,
                $"Deleted cue \"{deletedCue.DisplayName}\"",
                canUndo: true,
                undoPayload: new CueDeleteUndoPayload(deletedCue));
        }

        transaction.Commit();
        return Task.CompletedTask;
    }

    public Task<string> DuplicateCueSegmentAsync(CueDuplicateRequest request)
    {
        var tags = request.Tags
            .Select(tag => new TagAssignmentRecord(tag.Name, NormalizeColor(tag.Color, tag.Name)))
            .ToList();

        using var connection = OpenConnection();
        using var transaction = connection.BeginTransaction();

        string resourceId;
        using (var sourceCue = connection.CreateCommand())
        {
            sourceCue.Transaction = transaction;
            sourceCue.CommandText = "SELECT resource_id FROM cue_cards WHERE id = $cueId LIMIT 1;";
            sourceCue.Parameters.AddWithValue("$cueId", request.SourceCueId);

            var result = sourceCue.ExecuteScalar();
            if (result is not string foundResourceId || string.IsNullOrWhiteSpace(foundResourceId))
            {
                throw new InvalidOperationException("Source cue was not found.");
            }

            resourceId = foundResourceId;
        }

        var nextSortOrder = GetNextSortOrder();
        var newCueId = Guid.NewGuid().ToString("N");

        InsertCueCard(
            connection,
            transaction,
            newCueId,
            resourceId,
            string.IsNullOrWhiteSpace(request.DisplayName) ? "New Segment" : request.DisplayName.Trim(),
            request.CardColor,
            string.Empty,
            Math.Clamp(request.Volume, 0, 1),
            Math.Clamp(request.PlaybackRate, 0.25, 4),
            Math.Max(0, request.TrimStartSeconds),
            request.TrimEndSeconds is double trimEnd && trimEnd > request.TrimStartSeconds ? trimEnd : null,
            nextSortOrder);

        ReplaceCueTags(connection, transaction, newCueId, tags);
        InsertHistoryEntry(
            connection,
            transaction,
            HistoryOperationCueDuplicate,
            "cue",
            newCueId,
            string.IsNullOrWhiteSpace(request.DisplayName) ? "New Segment" : request.DisplayName.Trim(),
            $"Created duplicate cue \"{(string.IsNullOrWhiteSpace(request.DisplayName) ? "New Segment" : request.DisplayName.Trim())}\"",
            canUndo: true,
            undoPayload: new CueDuplicateUndoPayload(newCueId));
        transaction.Commit();

        return Task.FromResult(newCueId);
    }

    private CueHistorySnapshotRecord? GetCueSnapshot(
        SqliteConnection connection,
        SqliteTransaction? transaction,
        string cueId)
    {
        using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText =
            """
            SELECT
                id,
                resource_id,
                display_name,
                card_color,
                hotkey,
                volume,
                playback_rate,
                trim_start,
                trim_end,
                sort_order
            FROM cue_cards
            WHERE id = $cueId
            LIMIT 1;
            """;
        command.Parameters.AddWithValue("$cueId", cueId);

        using var reader = command.ExecuteReader();
        if (!reader.Read())
        {
            return null;
        }

        return new CueHistorySnapshotRecord(
            reader.GetString(0),
            reader.GetString(1),
            reader.GetString(2),
            reader.IsDBNull(3) ? string.Empty : reader.GetString(3),
            reader.IsDBNull(4) ? string.Empty : reader.GetString(4),
            reader.GetDouble(5),
            reader.GetDouble(6),
            reader.GetDouble(7),
            reader.IsDBNull(8) ? null : reader.GetDouble(8),
            reader.GetInt32(9),
            LoadCueTagAssignments(connection, transaction, cueId));
    }

    private List<TagAssignmentRecord> LoadCueTagAssignments(
        SqliteConnection connection,
        SqliteTransaction? transaction,
        string cueId)
    {
        using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText =
            """
            SELECT
                tag.name,
                tag.color
            FROM cue_tag_links AS link
            INNER JOIN tags AS tag
                ON tag.id = link.tag_id
            WHERE link.cue_id = $cueId
            ORDER BY tag.name COLLATE NOCASE ASC;
            """;
        command.Parameters.AddWithValue("$cueId", cueId);

        var tags = new List<TagAssignmentRecord>();
        using var reader = command.ExecuteReader();
        while (reader.Read())
        {
            tags.Add(new TagAssignmentRecord(
                reader.GetString(0),
                reader.GetString(1)));
        }

        return tags;
    }

    private void RestoreCueSnapshot(
        SqliteConnection connection,
        SqliteTransaction transaction,
        CueHistorySnapshotRecord cue)
    {
        using (var deleteExisting = connection.CreateCommand())
        {
            deleteExisting.Transaction = transaction;
            deleteExisting.CommandText = "DELETE FROM cue_cards WHERE id = $cueId;";
            deleteExisting.Parameters.AddWithValue("$cueId", cue.CueId);
            deleteExisting.ExecuteNonQuery();
        }

        InsertCueCard(
            connection,
            transaction,
            cue.CueId,
            cue.ResourceId,
            cue.DisplayName,
            cue.CardColor,
            cue.Hotkey,
            cue.Volume,
            cue.PlaybackRate,
            cue.TrimStartSeconds,
            cue.TrimEndSeconds,
            cue.SortOrder);

        ReplaceCueTags(connection, transaction, cue.CueId, cue.Tags);
    }

    private static void DeleteCueInternal(
        SqliteConnection connection,
        SqliteTransaction transaction,
        string cueId)
    {
        using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = "DELETE FROM cue_cards WHERE id = $cueId;";
        command.Parameters.AddWithValue("$cueId", cueId);
        command.ExecuteNonQuery();
    }

    private void InsertHistoryEntry(
        SqliteConnection connection,
        SqliteTransaction transaction,
        string operationType,
        string targetType,
        string targetId,
        string targetLabel,
        string summary,
        bool canUndo,
        object? undoPayload)
    {
        using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText =
            """
            INSERT INTO history_entries (
                id,
                operation_type,
                target_type,
                target_id,
                target_label,
                summary,
                created_at,
                can_undo,
                undo_payload,
                undone_at
            ) VALUES (
                $id,
                $operationType,
                $targetType,
                $targetId,
                $targetLabel,
                $summary,
                $createdAt,
                $canUndo,
                $undoPayload,
                NULL
            );
            """;
        command.Parameters.AddWithValue("$id", Guid.NewGuid().ToString("N"));
        command.Parameters.AddWithValue("$operationType", operationType);
        command.Parameters.AddWithValue("$targetType", targetType);
        command.Parameters.AddWithValue("$targetId", targetId);
        command.Parameters.AddWithValue("$targetLabel", targetLabel);
        command.Parameters.AddWithValue("$summary", summary);
        command.Parameters.AddWithValue("$createdAt", DateTimeOffset.UtcNow.ToString("O"));
        command.Parameters.AddWithValue("$canUndo", canUndo ? 1 : 0);
        command.Parameters.AddWithValue("$undoPayload", undoPayload is null
            ? DBNull.Value
            : JsonSerializer.Serialize(undoPayload, _jsonOptions));
        command.ExecuteNonQuery();
    }

    private static void MarkHistoryEntryUndone(
        SqliteConnection connection,
        SqliteTransaction transaction,
        string historyEntryId)
    {
        using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText =
            """
            UPDATE history_entries
            SET undone_at = $undoneAt
            WHERE id = $id;
            """;
        command.Parameters.AddWithValue("$undoneAt", DateTimeOffset.UtcNow.ToString("O"));
        command.Parameters.AddWithValue("$id", historyEntryId);
        command.ExecuteNonQuery();
    }

    private List<HistoryEntryEnvelope> LoadHistoryEnvelopes(
        SqliteConnection connection,
        int limit,
        SqliteTransaction? transaction = null)
    {
        using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText =
            """
            SELECT
                id,
                operation_type,
                target_type,
                target_id,
                target_label,
                summary,
                created_at,
                can_undo,
                undo_payload,
                undone_at
            FROM history_entries
            ORDER BY created_at DESC
            LIMIT $limit;
            """;
        command.Parameters.AddWithValue("$limit", Math.Max(1, limit));

        var result = new List<HistoryEntryEnvelope>();
        using var reader = command.ExecuteReader();
        while (reader.Read())
        {
            result.Add(new HistoryEntryEnvelope(
                reader.GetString(0),
                reader.GetString(1),
                reader.GetString(2),
                reader.GetString(3),
                reader.GetString(4),
                reader.GetString(5),
                DateTimeOffset.Parse(reader.GetString(6), CultureInfo.InvariantCulture),
                reader.GetInt32(7) == 1,
                reader.IsDBNull(8) ? string.Empty : reader.GetString(8),
                reader.IsDBNull(9) ? null : reader.GetString(9)));
        }

        return result;
    }

    private List<HistoryEntryRecord> EvaluateHistoryEntries(
        SqliteConnection connection,
        IReadOnlyList<HistoryEntryEnvelope> envelopes,
        SqliteTransaction? transaction = null)
    {
        var latestUndoCandidateId = envelopes
            .Where(IsUndoCandidate)
            .Select(entry => entry.Id)
            .FirstOrDefault();

        var result = new List<HistoryEntryRecord>(envelopes.Count);
        foreach (var envelope in envelopes)
        {
            var evaluation = EvaluateUndoAvailability(connection, envelope, latestUndoCandidateId, transaction);
            result.Add(new HistoryEntryRecord(
                envelope.Id,
                envelope.OperationType,
                envelope.TargetType,
                envelope.TargetId,
                envelope.TargetLabel,
                envelope.Summary,
                envelope.CreatedAt,
                evaluation.CanUndo,
                !string.IsNullOrWhiteSpace(envelope.UndoneAt),
                evaluation.State,
                evaluation.Message));
        }

        return result;
    }

    private UndoAvailabilityEvaluation EvaluateUndoAvailability(
        SqliteConnection connection,
        HistoryEntryEnvelope envelope,
        string? latestUndoCandidateId,
        SqliteTransaction? transaction)
    {
        if (!envelope.CanUndo)
        {
            return new UndoAvailabilityEvaluation(false, UndoStateRecorded, "Recorded for audit only.");
        }

        if (!string.IsNullOrWhiteSpace(envelope.UndoneAt))
        {
            return new UndoAvailabilityEvaluation(false, UndoStateUndone, "This record has already been undone.");
        }

        if (!string.Equals(envelope.Id, latestUndoCandidateId, StringComparison.OrdinalIgnoreCase))
        {
            return new UndoAvailabilityEvaluation(false, UndoStateBlocked, "A newer undoable operation exists. Undo must proceed from newest to oldest.");
        }

        return envelope.OperationType switch
        {
            HistoryOperationCueEdit => EvaluateCueEditUndo(connection, envelope, transaction),
            HistoryOperationCueDelete => EvaluateCueDeleteUndo(connection, envelope, transaction),
            HistoryOperationCueDuplicate => EvaluateCueDuplicateUndo(connection, envelope, transaction),
            _ => new UndoAvailabilityEvaluation(false, UndoStateRecorded, "This record type is not part of the undo chain."),
        };
    }

    private UndoAvailabilityEvaluation EvaluateCueEditUndo(
        SqliteConnection connection,
        HistoryEntryEnvelope envelope,
        SqliteTransaction? transaction)
    {
        var cueExists = GetCueSnapshot(connection, transaction, envelope.TargetId) is not null;
        return cueExists
            ? new UndoAvailabilityEvaluation(true, UndoStateAvailable, "Latest safe undo point.")
            : new UndoAvailabilityEvaluation(false, UndoStateInvalid, "The cue no longer exists in its expected current form.");
    }

    private UndoAvailabilityEvaluation EvaluateCueDeleteUndo(
        SqliteConnection connection,
        HistoryEntryEnvelope envelope,
        SqliteTransaction? transaction)
    {
        var cueExists = GetCueSnapshot(connection, transaction, envelope.TargetId) is not null;
        return !cueExists
            ? new UndoAvailabilityEvaluation(true, UndoStateAvailable, "Latest safe undo point.")
            : new UndoAvailabilityEvaluation(false, UndoStateInvalid, "The deleted cue id is already present, so restore would collide.");
    }

    private UndoAvailabilityEvaluation EvaluateCueDuplicateUndo(
        SqliteConnection connection,
        HistoryEntryEnvelope envelope,
        SqliteTransaction? transaction)
    {
        var cueExists = GetCueSnapshot(connection, transaction, envelope.TargetId) is not null;
        return cueExists
            ? new UndoAvailabilityEvaluation(true, UndoStateAvailable, "Latest safe undo point.")
            : new UndoAvailabilityEvaluation(false, UndoStateInvalid, "The duplicated cue is already missing, so this undo can no longer be applied.");
    }

    private static bool IsUndoCandidate(HistoryEntryEnvelope envelope)
    {
        return envelope.CanUndo
            && string.IsNullOrWhiteSpace(envelope.UndoneAt)
            && envelope.OperationType is HistoryOperationCueEdit or HistoryOperationCueDelete or HistoryOperationCueDuplicate;
    }

    private SqliteConnection OpenConnection()
    {
        var connection = new SqliteConnection(new SqliteConnectionStringBuilder
        {
            DataSource = _databasePath,
        }.ToString());
        connection.Open();

        using var pragma = connection.CreateCommand();
        pragma.CommandText = "PRAGMA foreign_keys = ON;";
        pragma.ExecuteNonQuery();

        return connection;
    }

    private static CueEditorRecord NormalizeEditor(CueEditorRecord editor)
    {
        var displayName = string.IsNullOrWhiteSpace(editor.DisplayName)
            ? "Untitled Cue"
            : editor.DisplayName.Trim();
        var trimStart = Math.Max(0, editor.TrimStartSeconds);
        double? trimEnd = editor.TrimEndSeconds is double endValue && endValue > trimStart
            ? endValue
            : null;

        return editor with
        {
            DisplayName = displayName,
            CardColor = string.IsNullOrWhiteSpace(editor.CardColor)
                ? string.Empty
                : NormalizeColor(editor.CardColor, displayName),
            Hotkey = editor.Hotkey.Trim(),
            Volume = Math.Clamp(editor.Volume, 0, 1),
            PlaybackRate = Math.Clamp(editor.PlaybackRate, 0.25, 4),
            TrimStartSeconds = trimStart,
            TrimEndSeconds = trimEnd,
            Tags = editor.Tags
                .Where(tag => !string.IsNullOrWhiteSpace(tag.Name))
                .GroupBy(tag => tag.Name.Trim(), StringComparer.OrdinalIgnoreCase)
                .Select(group =>
                {
                    var representative = group.First();
                    var normalizedName = representative.Name.Trim();
                    return new TagAssignmentRecord(
                        normalizedName,
                        NormalizeColor(representative.Color, normalizedName));
                })
                .OrderBy(tag => tag.Name, StringComparer.CurrentCultureIgnoreCase)
                .ToList(),
        };
    }

    private static void ReplaceCueTags(
        SqliteConnection connection,
        SqliteTransaction transaction,
        string cueId,
        IReadOnlyList<TagAssignmentRecord> tags)
    {
        using (var deleteExisting = connection.CreateCommand())
        {
            deleteExisting.Transaction = transaction;
            deleteExisting.CommandText = "DELETE FROM cue_tag_links WHERE cue_id = $cueId;";
            deleteExisting.Parameters.AddWithValue("$cueId", cueId);
            deleteExisting.ExecuteNonQuery();
        }

        foreach (var tag in tags)
        {
            var tagId = UpsertTag(connection, transaction, tag.Name, tag.Color);

            using var insertLink = connection.CreateCommand();
            insertLink.Transaction = transaction;
            insertLink.CommandText =
                """
                INSERT INTO cue_tag_links (cue_id, tag_id)
                VALUES ($cueId, $tagId)
                ON CONFLICT(cue_id, tag_id) DO NOTHING;
                """;
            insertLink.Parameters.AddWithValue("$cueId", cueId);
            insertLink.Parameters.AddWithValue("$tagId", tagId);
            insertLink.ExecuteNonQuery();
        }
    }

    private static string UpsertTag(
        SqliteConnection connection,
        SqliteTransaction transaction,
        string tagName,
        string tagColor)
    {
        using var findExisting = connection.CreateCommand();
        findExisting.Transaction = transaction;
        findExisting.CommandText = "SELECT id FROM tags WHERE name = $name LIMIT 1;";
        findExisting.Parameters.AddWithValue("$name", tagName);

        var existingId = findExisting.ExecuteScalar() as string;
        if (!string.IsNullOrWhiteSpace(existingId))
        {
            using var updateExisting = connection.CreateCommand();
            updateExisting.Transaction = transaction;
            updateExisting.CommandText = "UPDATE tags SET color = $color WHERE id = $id;";
            updateExisting.Parameters.AddWithValue("$color", tagColor);
            updateExisting.Parameters.AddWithValue("$id", existingId);
            updateExisting.ExecuteNonQuery();
            return existingId;
        }

        var tagId = Guid.NewGuid().ToString("N");
        using var insertTag = connection.CreateCommand();
        insertTag.Transaction = transaction;
        insertTag.CommandText =
            """
            INSERT INTO tags (id, name, color, created_at)
            VALUES ($id, $name, $color, $createdAt);
            """;
        insertTag.Parameters.AddWithValue("$id", tagId);
        insertTag.Parameters.AddWithValue("$name", tagName);
        insertTag.Parameters.AddWithValue("$color", tagColor);
        insertTag.Parameters.AddWithValue("$createdAt", DateTimeOffset.UtcNow.ToString("O"));
        insertTag.ExecuteNonQuery();

        return tagId;
    }

    private static void InsertCueCard(
        SqliteConnection connection,
        SqliteTransaction transaction,
        string cueId,
        string resourceId,
        string displayName,
        string cardColor,
        string hotkey,
        double volume,
        double playbackRate,
        double trimStart,
        double? trimEnd,
        int sortOrder)
    {
        using var cueCommand = connection.CreateCommand();
        cueCommand.Transaction = transaction;
        cueCommand.CommandText =
            """
            INSERT INTO cue_cards (
                id,
                resource_id,
                display_name,
                card_color,
                hotkey,
                volume,
                playback_rate,
                trim_start,
                trim_end,
                sort_order,
                created_at
            ) VALUES (
                $id,
                $resourceId,
                $displayName,
                $cardColor,
                $hotkey,
                $volume,
                $playbackRate,
                $trimStart,
                $trimEnd,
                $sortOrder,
                $createdAt
            );
            """;
        cueCommand.Parameters.AddWithValue("$id", cueId);
        cueCommand.Parameters.AddWithValue("$resourceId", resourceId);
        cueCommand.Parameters.AddWithValue("$displayName", displayName);
        cueCommand.Parameters.AddWithValue("$cardColor", string.IsNullOrWhiteSpace(cardColor) ? DBNull.Value : cardColor);
        cueCommand.Parameters.AddWithValue("$hotkey", string.IsNullOrWhiteSpace(hotkey) ? DBNull.Value : hotkey);
        cueCommand.Parameters.AddWithValue("$volume", volume);
        cueCommand.Parameters.AddWithValue("$playbackRate", playbackRate);
        cueCommand.Parameters.AddWithValue("$trimStart", trimStart);
        cueCommand.Parameters.AddWithValue("$trimEnd", trimEnd is double trimEndValue ? trimEndValue : DBNull.Value);
        cueCommand.Parameters.AddWithValue("$sortOrder", sortOrder);
        cueCommand.Parameters.AddWithValue("$createdAt", DateTimeOffset.UtcNow.ToString("O"));
        cueCommand.ExecuteNonQuery();
    }

    private static Dictionary<string, string> LoadSettings(SqliteConnection connection)
    {
        var result = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        using var command = connection.CreateCommand();
        command.CommandText = "SELECT key, value FROM app_settings;";

        using var reader = command.ExecuteReader();
        while (reader.Read())
        {
            result[reader.GetString(0)] = reader.GetString(1);
        }

        return result;
    }

    private static Dictionary<string, List<string>> LoadCueTags(SqliteConnection connection)
    {
        var result = new Dictionary<string, List<string>>(StringComparer.OrdinalIgnoreCase);
        using var command = connection.CreateCommand();
        command.CommandText =
            """
            SELECT
                link.cue_id,
                tag.name
            FROM cue_tag_links AS link
            INNER JOIN tags AS tag
                ON tag.id = link.tag_id
            ORDER BY tag.name COLLATE NOCASE ASC;
            """;

        using var reader = command.ExecuteReader();
        while (reader.Read())
        {
            var cueId = reader.GetString(0);
            if (!result.TryGetValue(cueId, out var tags))
            {
                tags = new List<string>();
                result[cueId] = tags;
            }

            tags.Add(reader.GetString(1));
        }

        return result;
    }

    private static Dictionary<string, int> LoadHotkeyCounts(SqliteConnection connection)
    {
        var result = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        using var command = connection.CreateCommand();
        command.CommandText = "SELECT hotkey FROM cue_cards WHERE hotkey IS NOT NULL AND TRIM(hotkey) <> '';";

        using var reader = command.ExecuteReader();
        while (reader.Read())
        {
            var normalized = HotkeyNormalizer.Normalize(reader.GetString(0));
            if (string.IsNullOrWhiteSpace(normalized))
            {
                continue;
            }

            result[normalized] = result.GetValueOrDefault(normalized) + 1;
        }

        return result;
    }

    private static IEnumerable<string> EnumerateAudioFiles(IEnumerable<string> inputPaths)
    {
        foreach (var inputPath in inputPaths.Where(path => !string.IsNullOrWhiteSpace(path)))
        {
            if (File.Exists(inputPath))
            {
                if (SupportedAudioExtensions.Contains(Path.GetExtension(inputPath)))
                {
                    yield return Path.GetFullPath(inputPath);
                }

                continue;
            }

            if (!Directory.Exists(inputPath))
            {
                continue;
            }

            foreach (var filePath in Directory.EnumerateFiles(inputPath, "*.*", SearchOption.AllDirectories))
            {
                if (SupportedAudioExtensions.Contains(Path.GetExtension(filePath)))
                {
                    yield return Path.GetFullPath(filePath);
                }
            }
        }
    }

    private static (string ResourceId, string RelativePath)? FindResourceByHash(
        SqliteConnection connection,
        string hash,
        SqliteTransaction transaction)
    {
        using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText =
            """
            SELECT
                id,
                storage_relative_path
            FROM audio_resources
            WHERE content_hash = $contentHash
            LIMIT 1;
            """;
        command.Parameters.AddWithValue("$contentHash", hash);

        using var reader = command.ExecuteReader();
        return reader.Read()
            ? (reader.GetString(0), reader.GetString(1))
            : null;
    }

    private int GetNextSortOrder()
    {
        using var connection = OpenConnection();
        using var command = connection.CreateCommand();
        command.CommandText = "SELECT COALESCE(MAX(sort_order), -1) + 1 FROM cue_cards;";
        return Convert.ToInt32(command.ExecuteScalar(), CultureInfo.InvariantCulture);
    }

    private static void SeedDefaultSetting(SqliteConnection connection, string key, string value)
    {
        using var command = connection.CreateCommand();
        command.CommandText =
            """
            INSERT INTO app_settings (key, value)
            VALUES ($key, $value)
            ON CONFLICT(key) DO NOTHING;
            """;
        command.Parameters.AddWithValue("$key", key);
        command.Parameters.AddWithValue("$value", value);
        command.ExecuteNonQuery();
    }

    private static void UpsertSetting(SqliteConnection connection, string key, string value)
    {
        using var command = connection.CreateCommand();
        command.CommandText =
            """
            INSERT INTO app_settings (key, value)
            VALUES ($key, $value)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value;
            """;
        command.Parameters.AddWithValue("$key", key);
        command.Parameters.AddWithValue("$value", value);
        command.ExecuteNonQuery();
    }

    private static string ComputeContentHash(string filePath)
    {
        using var stream = File.OpenRead(filePath);
        var hash = SHA256.HashData(stream);
        return Convert.ToHexString(hash);
    }

    private static double ParseDouble(string raw, double fallback)
    {
        return double.TryParse(raw, NumberStyles.Float, CultureInfo.InvariantCulture, out var value)
            ? value
            : fallback;
    }

    private static string NormalizeColor(string color, string tagName)
    {
        if (!string.IsNullOrWhiteSpace(color))
        {
            var trimmed = color.Trim();
            if (trimmed.Length == 7 && trimmed[0] == '#' && trimmed.Skip(1).All(IsHexDigit))
            {
                return trimmed.ToUpperInvariant();
            }
        }

        return GenerateColorFromName(tagName);
    }

    private static bool IsHexDigit(char value)
    {
        return value is >= '0' and <= '9'
            or >= 'a' and <= 'f'
            or >= 'A' and <= 'F';
    }

    private static string GenerateColorFromName(string tagName)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(tagName));
        var red = 80 + (bytes[0] % 120);
        var green = 80 + (bytes[1] % 120);
        var blue = 80 + (bytes[2] % 120);
        return $"#{red:X2}{green:X2}{blue:X2}";
    }

    private static bool AreCueSnapshotsEqual(CueHistorySnapshotRecord left, CueHistorySnapshotRecord right)
    {
        return left.CueId == right.CueId
            && left.ResourceId == right.ResourceId
            && left.DisplayName == right.DisplayName
            && left.CardColor == right.CardColor
            && left.Hotkey == right.Hotkey
            && Math.Abs(left.Volume - right.Volume) < 0.0001
            && Math.Abs(left.PlaybackRate - right.PlaybackRate) < 0.0001
            && Math.Abs(left.TrimStartSeconds - right.TrimStartSeconds) < 0.0001
            && Nullable.Equals(left.TrimEndSeconds, right.TrimEndSeconds)
            && left.SortOrder == right.SortOrder
            && left.Tags.SequenceEqual(right.Tags);
    }

    private static string BuildCueEditSummary(CueHistorySnapshotRecord previous, CueHistorySnapshotRecord current)
    {
        var changedFields = new List<string>();

        if (!string.Equals(previous.DisplayName, current.DisplayName, StringComparison.Ordinal))
        {
            changedFields.Add("name");
        }

        if (!string.Equals(previous.CardColor, current.CardColor, StringComparison.OrdinalIgnoreCase))
        {
            changedFields.Add("color");
        }

        if (!string.Equals(previous.Hotkey, current.Hotkey, StringComparison.Ordinal))
        {
            changedFields.Add("hotkey");
        }

        if (Math.Abs(previous.Volume - current.Volume) > 0.0001)
        {
            changedFields.Add("volume");
        }

        if (Math.Abs(previous.PlaybackRate - current.PlaybackRate) > 0.0001)
        {
            changedFields.Add("rate");
        }

        if (Math.Abs(previous.TrimStartSeconds - current.TrimStartSeconds) > 0.0001
            || !Nullable.Equals(previous.TrimEndSeconds, current.TrimEndSeconds))
        {
            changedFields.Add("trim");
        }

        if (!previous.Tags.SequenceEqual(current.Tags))
        {
            changedFields.Add("tags");
        }

        return changedFields.Count == 0
            ? $"Edited cue \"{current.DisplayName}\""
            : $"Edited cue \"{current.DisplayName}\" ({string.Join(", ", changedFields)})";
    }

    private T Deserialize<T>(string payload)
    {
        var result = JsonSerializer.Deserialize<T>(payload, _jsonOptions);
        if (result is null)
        {
            throw new InvalidOperationException($"Failed to deserialize history payload for {typeof(T).Name}.");
        }

        return result;
    }

    private const string HistoryOperationCueEdit = "cue.edit";
    private const string HistoryOperationCueDelete = "cue.delete";
    private const string HistoryOperationCueDuplicate = "cue.duplicate";
    private const string HistoryOperationUndo = "undo";
    private const string UndoStateAvailable = "available";
    private const string UndoStateBlocked = "blocked";
    private const string UndoStateInvalid = "invalid";
    private const string UndoStateUndone = "undone";
    private const string UndoStateRecorded = "recorded";

    private sealed record HistoryEntryEnvelope(
        string Id,
        string OperationType,
        string TargetType,
        string TargetId,
        string TargetLabel,
        string Summary,
        DateTimeOffset CreatedAt,
        bool CanUndo,
        string UndoPayload,
        string? UndoneAt);

    private sealed record UndoAvailabilityEvaluation(bool CanUndo, string State, string Message);

    private sealed record CueEditUndoPayload(CueHistorySnapshotRecord PreviousCue);
    private sealed record CueDeleteUndoPayload(CueHistorySnapshotRecord DeletedCue);
    private sealed record CueDuplicateUndoPayload(string CreatedCueId);
}
