using System;
using System.Diagnostics;
using System.IO;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Threading.Tasks;

namespace CodeXSoundboard.Shell.WinUI.Bridge;

public sealed class WorkspaceServiceBridgeClient
{
    private readonly JsonSerializerOptions _jsonOptions = new(JsonSerializerDefaults.Web);

    public async Task<JsonNode?> InvokeAsync(
        string command,
        JsonNode? payload,
        JsonObject context,
        Func<string, JsonNode?, Task>? onEvent = null)
    {
        var scriptPath = ResolveWorkerScriptPath();
        if (!File.Exists(scriptPath))
        {
            throw new FileNotFoundException("WinUI bridge worker script was not found.", scriptPath);
        }

        var workingDirectory = ResolveWorkerWorkingDirectory(scriptPath);

        using var process = new Process();
        process.StartInfo = new ProcessStartInfo
        {
            FileName = ResolveNodeExecutable(),
            Arguments = $"\"{scriptPath}\"",
            WorkingDirectory = workingDirectory,
            RedirectStandardInput = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true,
            StandardOutputEncoding = Encoding.UTF8,
            StandardErrorEncoding = Encoding.UTF8,
        };

        if (!process.Start())
        {
            throw new InvalidOperationException("Failed to start the WinUI workspace bridge worker.");
        }

        var request = new JsonObject
        {
            ["command"] = command,
            ["payload"] = payload?.DeepClone(),
            ["context"] = context.DeepClone(),
        };

        await process.StandardInput.WriteAsync(request.ToJsonString(_jsonOptions));
        await process.StandardInput.FlushAsync();
        process.StandardInput.Close();

        string? resultLine = null;
        while (true)
        {
            var line = await process.StandardOutput.ReadLineAsync();
            if (line is null)
            {
                break;
            }

            if (string.IsNullOrWhiteSpace(line))
            {
                continue;
            }

            var envelope = JsonNode.Parse(line)?.AsObject();
            if (envelope is null)
            {
                continue;
            }

            var type = envelope["type"]?.GetValue<string>();
            if (type == "event")
            {
                if (onEvent is not null)
                {
                    var eventName = envelope["event"]?.GetValue<string>() ?? string.Empty;
                    await onEvent(eventName, envelope["payload"]?.DeepClone());
                }

                continue;
            }

            if (type == "result")
            {
                resultLine = line;
            }
        }

        var stderr = await process.StandardError.ReadToEndAsync();
        await process.WaitForExitAsync();

        if (string.IsNullOrWhiteSpace(resultLine))
        {
            throw new InvalidOperationException(
                string.IsNullOrWhiteSpace(stderr)
                    ? "WinUI bridge worker returned no output."
                    : stderr.Trim());
        }

        var parsed = JsonNode.Parse(resultLine)?.AsObject();
        if (parsed is null)
        {
            throw new InvalidOperationException("WinUI bridge worker returned invalid JSON.");
        }

        var ok = parsed["ok"]?.GetValue<bool>() ?? false;
        if (!ok)
        {
            var message = parsed["error"]?["message"]?.GetValue<string>()
                ?? (!string.IsNullOrWhiteSpace(stderr) ? stderr.Trim() : "Unknown bridge worker failure");
            throw new InvalidOperationException(message);
        }

        return parsed["result"]?.DeepClone();
    }

    private static string ResolveWorkerScriptPath()
    {
        var current = new DirectoryInfo(AppContext.BaseDirectory);

        while (current is not null)
        {
            var candidate = Path.Combine(current.FullName, "scripts", "winui-bridge-worker.mjs");
            var nodeModules = Path.Combine(current.FullName, "node_modules");

            if (File.Exists(candidate) && Directory.Exists(nodeModules))
            {
                return candidate;
            }

            current = current.Parent;
        }

        return Path.Combine(AppContext.BaseDirectory, "scripts", "winui-bridge-worker.mjs");
    }

    private static string ResolveNodeExecutable()
    {
        var configuredNodePath = Environment.GetEnvironmentVariable("CODEX_NODE_PATH");
        if (!string.IsNullOrWhiteSpace(configuredNodePath))
        {
            return configuredNodePath;
        }

        var bundledNodePath = Path.Combine(AppContext.BaseDirectory, "tools", "node", "node.exe");
        if (File.Exists(bundledNodePath))
        {
            return bundledNodePath;
        }

        return "node";
    }

    private static string ResolveWorkerWorkingDirectory(string scriptPath)
    {
        var scriptDirectory = Path.GetDirectoryName(scriptPath);
        if (string.IsNullOrWhiteSpace(scriptDirectory))
        {
            return AppContext.BaseDirectory;
        }

        return Directory.GetParent(scriptDirectory)?.FullName ?? AppContext.BaseDirectory;
    }
}
