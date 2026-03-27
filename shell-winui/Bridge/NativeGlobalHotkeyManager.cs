using CodeXSoundboard.Shell.WinUI.Core;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Runtime.InteropServices;
using System.Threading.Tasks;
using Windows.System;

namespace CodeXSoundboard.Shell.WinUI.Bridge;

internal sealed class NativeGlobalHotkeyManager : IDisposable
{
    private const int WmHotkey = 0x0312;
    private const uint ModAlt = 0x0001;
    private const uint ModControl = 0x0002;
    private const uint ModShift = 0x0004;
    private const uint ModWin = 0x0008;
    private const uint ModNoRepeat = 0x4000;

    private readonly nint _windowHandle;
    private readonly SubclassProc _subclassProc;
    private readonly Dictionary<int, Action> _handlers = new();
    private readonly HashSet<int> _registeredIds = new();
    private int _nextHotkeyId = 1000;
    private bool _disposed;

    public NativeGlobalHotkeyManager(nint windowHandle)
    {
        _windowHandle = windowHandle;
        _subclassProc = HandleSubclassMessage;
        SetWindowSubclass(_windowHandle, _subclassProc, 1, nuint.Zero);
    }

    public void UpdateRegistrations(
        IReadOnlyDictionary<string, string> cueHotkeys,
        bool shortcutsEnabled,
        string hotkeyToggleAccelerator,
        string playbackToggleAccelerator,
        Func<string, Task> onCueTriggered,
        Func<string, Task> onControlTriggered)
    {
        ThrowIfDisposed();
        ClearRegistrations();

        var usedHotkeys = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        RegisterHotkey(hotkeyToggleAccelerator, () => _ = onControlTriggered("toggle-global-shortcuts"), usedHotkeys);
        RegisterHotkey(playbackToggleAccelerator, () => _ = onControlTriggered("toggle-playback-pause"), usedHotkeys);

        if (!shortcutsEnabled)
        {
            return;
        }

        foreach (var (hotkey, cueId) in cueHotkeys)
        {
            if (string.IsNullOrWhiteSpace(cueId))
            {
                continue;
            }

            RegisterHotkey(hotkey, () => _ = onCueTriggered(cueId), usedHotkeys);
        }
    }

    private void RegisterHotkey(string accelerator, Action action, HashSet<string> usedHotkeys)
    {
        var normalized = HotkeyNormalizer.Normalize(accelerator);
        if (string.IsNullOrWhiteSpace(normalized) || !usedHotkeys.Add(normalized))
        {
            return;
        }

        if (!TryParseHotkey(normalized, out var modifiers, out var virtualKey))
        {
            return;
        }

        var hotkeyId = _nextHotkeyId++;
        if (!RegisterHotKey(_windowHandle, hotkeyId, modifiers | ModNoRepeat, virtualKey))
        {
            return;
        }

        _registeredIds.Add(hotkeyId);
        _handlers[hotkeyId] = action;
    }

    private void ClearRegistrations()
    {
        foreach (var hotkeyId in _registeredIds)
        {
            UnregisterHotKey(_windowHandle, hotkeyId);
        }

        _registeredIds.Clear();
        _handlers.Clear();
    }

    private nint HandleSubclassMessage(nint hwnd, uint message, nuint wParam, nint lParam, nuint subclassId, nuint refData)
    {
        if (message == WmHotkey)
        {
            var hotkeyId = unchecked((int)wParam);
            if (_handlers.TryGetValue(hotkeyId, out var action))
            {
                action();
                return 1;
            }
        }

        return DefSubclassProc(hwnd, message, wParam, lParam);
    }

    private static bool TryParseHotkey(string accelerator, out uint modifiers, out uint virtualKey)
    {
        modifiers = 0;
        virtualKey = 0;

        var tokens = accelerator.Split('+', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        if (tokens.Length == 0)
        {
            return false;
        }

        foreach (var rawToken in tokens)
        {
            var token = rawToken.ToLowerInvariant();
            switch (token)
            {
                case "ctrl":
                    modifiers |= ModControl;
                    continue;
                case "alt":
                    modifiers |= ModAlt;
                    continue;
                case "shift":
                    modifiers |= ModShift;
                    continue;
                case "super":
                    modifiers |= ModWin;
                    continue;
            }

            if (!TryParseVirtualKey(token, out virtualKey))
            {
                return false;
            }
        }

        return virtualKey != 0;
    }

    private static bool TryParseVirtualKey(string token, out uint virtualKey)
    {
        virtualKey = 0;

        if (token.Length == 1 && char.IsLetter(token[0]))
        {
            virtualKey = char.ToUpperInvariant(token[0]);
            return true;
        }

        if (token.Length == 1 && char.IsDigit(token[0]))
        {
            virtualKey = token[0];
            return true;
        }

        if (token.StartsWith("f", StringComparison.OrdinalIgnoreCase) &&
            int.TryParse(token[1..], out var functionKey) &&
            functionKey is >= 1 and <= 24)
        {
            virtualKey = (uint)VirtualKey.F1 + (uint)(functionKey - 1);
            return true;
        }

        virtualKey = token switch
        {
            "space" => (uint)VirtualKey.Space,
            "enter" => (uint)VirtualKey.Enter,
            "tab" => (uint)VirtualKey.Tab,
            "esc" => (uint)VirtualKey.Escape,
            "escape" => (uint)VirtualKey.Escape,
            "backspace" => (uint)VirtualKey.Back,
            "delete" => (uint)VirtualKey.Delete,
            "insert" => (uint)VirtualKey.Insert,
            "home" => (uint)VirtualKey.Home,
            "end" => (uint)VirtualKey.End,
            "pageup" => (uint)VirtualKey.PageUp,
            "pagedown" => (uint)VirtualKey.PageDown,
            "up" => (uint)VirtualKey.Up,
            "down" => (uint)VirtualKey.Down,
            "left" => (uint)VirtualKey.Left,
            "right" => (uint)VirtualKey.Right,
            _ => 0,
        };

        return virtualKey != 0;
    }

    public void Dispose()
    {
        if (_disposed)
        {
            return;
        }

        ClearRegistrations();
        RemoveWindowSubclass(_windowHandle, _subclassProc, 1);
        _disposed = true;
    }

    private void ThrowIfDisposed()
    {
        if (_disposed)
        {
            throw new ObjectDisposedException(nameof(NativeGlobalHotkeyManager));
        }
    }

    private delegate nint SubclassProc(nint hwnd, uint message, nuint wParam, nint lParam, nuint subclassId, nuint refData);

    [DllImport("comctl32.dll", SetLastError = true)]
    private static extern bool SetWindowSubclass(
        nint hWnd,
        SubclassProc callback,
        nuint subclassId,
        nuint refData);

    [DllImport("comctl32.dll", SetLastError = true)]
    private static extern bool RemoveWindowSubclass(
        nint hWnd,
        SubclassProc callback,
        nuint subclassId);

    [DllImport("comctl32.dll")]
    private static extern nint DefSubclassProc(nint hWnd, uint message, nuint wParam, nint lParam);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool RegisterHotKey(nint hWnd, int id, uint fsModifiers, uint vk);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool UnregisterHotKey(nint hWnd, int id);
}
