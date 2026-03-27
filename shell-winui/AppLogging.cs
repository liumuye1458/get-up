using System;
using System.IO;

namespace CodeXSoundboard.Shell.WinUI;

internal static class AppLogging
{
    private static readonly object SyncRoot = new();

    public static string LogPath
    {
        get
        {
            var root = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "Code X Soundboard",
                "WinUIShell",
                "logs");
            Directory.CreateDirectory(root);
            return Path.Combine(root, "winui-shell.log");
        }
    }

    public static void Write(string message)
    {
        lock (SyncRoot)
        {
            File.AppendAllText(
                LogPath,
                $"[{DateTimeOffset.Now:yyyy-MM-dd HH:mm:ss.fff zzz}] {message}{Environment.NewLine}");
        }
    }

    public static void WriteException(string context, Exception exception)
    {
        Write($"{context}: {exception}");
    }
}
