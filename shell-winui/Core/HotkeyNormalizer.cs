using System;
using System.Collections.Generic;
using System.Linq;

namespace CodeXSoundboard.Shell.WinUI.Core;

internal static class HotkeyNormalizer
{
    private static readonly HashSet<string> ModifierTokens = new(StringComparer.OrdinalIgnoreCase)
    {
        "ctrl",
        "alt",
        "shift",
        "super",
        "win",
    };

    public static string Normalize(string? accelerator)
    {
        return TryNormalizeValid(accelerator, out var normalized)
            ? normalized
            : string.Empty;
    }

    public static bool TryNormalizeValid(string? accelerator, out string normalized)
    {
        normalized = string.Empty;

        if (string.IsNullOrWhiteSpace(accelerator))
        {
            return false;
        }

        var tokens = accelerator
            .Split('+', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(token => token.ToLowerInvariant())
            .ToList();

        if (tokens.Count == 0)
        {
            return false;
        }

        var modifiers = new[] { "ctrl", "alt", "shift", "super", "win" }
            .Where(tokens.Contains)
            .Select(token => token == "win" ? "super" : token)
            .Distinct()
            .ToList();

        var keyToken = tokens.LastOrDefault(token => !ModifierTokens.Contains(token));
        if (string.IsNullOrWhiteSpace(keyToken) || !IsSupportedKey(keyToken))
        {
            return false;
        }

        modifiers.Add(keyToken);
        normalized = string.Join('+', modifiers);
        return true;
    }

    public static bool HasConflict(string? accelerator, IReadOnlyDictionary<string, int> counts)
    {
        return TryNormalizeValid(accelerator, out var normalized)
            && counts.TryGetValue(normalized, out var count)
            && count > 1;
    }

    private static bool IsSupportedKey(string token)
    {
        if (token.Length == 1 && char.IsLetterOrDigit(token[0]))
        {
            return true;
        }

        if (token.StartsWith("f", StringComparison.OrdinalIgnoreCase)
            && int.TryParse(token[1..], out var functionKey)
            && functionKey is >= 1 and <= 24)
        {
            return true;
        }

        return token is
            "space" or
            "enter" or
            "tab" or
            "esc" or
            "escape" or
            "backspace" or
            "delete" or
            "insert" or
            "home" or
            "end" or
            "pageup" or
            "pagedown" or
            "up" or
            "down" or
            "left" or
            "right";
    }
}
