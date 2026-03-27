using Microsoft.UI.Xaml.Controls;
using Microsoft.Web.WebView2.Core;
using System;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Threading.Tasks;

namespace CodeXSoundboard.Shell.WinUI.Bridge;

public sealed class WorkspaceBridgeHost
{
    public sealed class HostActions
    {
        public Func<Task<string[]>>? PickAudioFilesAsync { get; init; }
        public Func<Task>? OpenFloatingControlAsync { get; init; }
        public Func<Task>? FocusMainWindowAsync { get; init; }
        public Func<string, JsonNode?, Task>? ServiceCommandCompletedAsync { get; init; }
        public Action<JsonObject?>? ShellStateChanged { get; init; }
    }

    private readonly JsonSerializerOptions _jsonOptions = new(JsonSerializerDefaults.Web);
    private readonly WorkspaceServiceBridgeClient _serviceBridgeClient = new();
    private readonly HostActions _hostActions;
    private JsonObject? _lastShellState;
    private CoreWebView2? _coreWebView;

    public WorkspaceBridgeHost(HostActions? hostActions = null)
    {
        _hostActions = hostActions ?? new HostActions();
    }

    public async Task InitializeAsync(WebView2 webView)
    {
        await webView.EnsureCoreWebView2Async();
        _coreWebView = webView.CoreWebView2;
        _coreWebView.WebMessageReceived += OnWebMessageReceived;

        var bootstrapScriptPath = Path.Combine(AppContext.BaseDirectory, "webview", "bridge-bootstrap.js");
        if (File.Exists(bootstrapScriptPath))
        {
            var bootstrapScript = await File.ReadAllTextAsync(bootstrapScriptPath);
            await _coreWebView.AddScriptToExecuteOnDocumentCreatedAsync(bootstrapScript);
        }
    }

    private async void OnWebMessageReceived(CoreWebView2 sender, CoreWebView2WebMessageReceivedEventArgs args)
    {
        try
        {
            var raw = args.TryGetWebMessageAsString();
            if (string.IsNullOrWhiteSpace(raw))
            {
                return;
            }

            var message = JsonNode.Parse(raw)?.AsObject();
            if (message is null)
            {
                return;
            }

            if (message["event"]?.GetValue<string>() == "workspace.shell.state")
            {
                _lastShellState = message["payload"]?.AsObject();
                AppLogging.Write("Bridge received workspace.shell.state.");
                _hostActions.ShellStateChanged?.Invoke(_lastShellState);
                return;
            }

            var requestId = message["id"]?.GetValue<string>();
            var command = message["command"]?.GetValue<string>();

            if (string.IsNullOrWhiteSpace(requestId) || string.IsNullOrWhiteSpace(command))
            {
                return;
            }

            var response = await HandleCommandAsync(requestId!, command!, message["payload"]);
            sender.PostWebMessageAsJson(response.ToJsonString(_jsonOptions));
        }
        catch (Exception ex)
        {
            var fallback = new JsonObject
            {
                ["id"] = Guid.NewGuid().ToString("N"),
                ["ok"] = false,
                ["error"] = new JsonObject
                {
                    ["code"] = "bridge_failure",
                    ["message"] = ex.Message,
                },
            };

            sender.PostWebMessageAsJson(fallback.ToJsonString(_jsonOptions));
        }
    }

    private async Task<JsonObject> HandleCommandAsync(string requestId, string command, JsonNode? payload)
    {
        try
        {
            var result = await ResolveCommandAsync(command, payload);

            return new JsonObject
            {
                ["id"] = requestId,
                ["ok"] = true,
                ["result"] = result,
            };
        }
        catch (Exception ex)
        {
            return new JsonObject
            {
                ["id"] = requestId,
                ["ok"] = false,
                ["error"] = new JsonObject
                {
                    ["code"] = "bridge_command_failed",
                    ["message"] = ex.Message,
                },
            };
        }
    }

    private async Task<JsonNode?> ResolveCommandAsync(string command, JsonNode? payload)
    {
        var result = command switch
        {
            "workspace.bootstrap.read" => await InvokeServiceCommandAsync(command, payload),
            "workspace.library.read" => await InvokeServiceCommandAsync(command, payload),
            "workspace.library.import" => await InvokeServiceCommandAsync(command, payload),
            "workspace.library.cleanup" => await InvokeServiceCommandAsync(command, payload),
            "workspace.settings.update" => await InvokeServiceCommandAsync(command, payload),
            "workspace.cue.update" => await InvokeServiceCommandAsync(command, payload),
            "workspace.cue.tags.replace" => await InvokeServiceCommandAsync(command, payload),
            "workspace.cue.tags.batch" => await InvokeServiceCommandAsync(command, payload),
            "workspace.cue.reorder" => await InvokeServiceCommandAsync(command, payload),
            "workspace.cue.delete" => await InvokeServiceCommandAsync(command, payload),
            "workspace.tag.rename" => await InvokeServiceCommandAsync(command, payload),
            "workspace.tag.delete" => await InvokeServiceCommandAsync(command, payload),
            "workspace.tag.color.update" => await InvokeServiceCommandAsync(command, payload),
            "workspace.tag.color.batch" => await InvokeServiceCommandAsync(command, payload),
            "workspace.tag.merge" => await InvokeServiceCommandAsync(command, payload),
            "workspace.tag.delete.batch" => await InvokeServiceCommandAsync(command, payload),
            "workspace.tag.rename.rule" => await InvokeServiceCommandAsync(command, payload),
            "workspace.history.list" => await InvokeServiceCommandAsync(command, payload),
            "workspace.history.undo" => await InvokeServiceCommandAsync(command, payload),
            "workspace.diagnostics.read" => await InvokeServiceCommandAsync(command, payload),
            "workspace.shortcuts.repair" => await InvokeServiceCommandAsync(command, payload),
            "workspace.shortcuts.assign" => await InvokeServiceCommandAsync(command, payload),
            "workspace.host.pick-audio" => await PickAudioFilesAsync(),
            "workspace.host.check-files" => CheckFiles(payload),
            "workspace.host.open-floating" => await OpenFloatingControlAsync(),
            "workspace.host.focus-main" => await FocusMainWindowAsync(),
            _ => throw new InvalidOperationException($"Unsupported WinUI bridge command: {command}"),
        };

        if (!command.StartsWith("workspace.host.", StringComparison.Ordinal))
        {
            await NotifyServiceCommandCompletedAsync(command, result);
        }

        return result;
    }

    private Task<JsonNode?> InvokeServiceCommandAsync(string command, JsonNode? payload)
    {
        return _serviceBridgeClient.InvokeAsync(command, payload, CreateStorageContext(), PostBridgeEventAsync);
    }

    private static JsonObject CreateStorageContext()
    {
        var dataRoot = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "Code X Soundboard",
            "WinUIShell");

        return new JsonObject
        {
            ["mode"] = "installed",
            ["dataRoot"] = dataRoot,
        };
    }

    private static JsonObject CheckFiles(JsonNode? payload)
    {
        var missing = new JsonArray();
        var paths = payload?["paths"]?.AsArray();

        if (paths is not null)
        {
            foreach (var filePath in paths
                .Select(node => node?.GetValue<string>())
                .Where(path => !string.IsNullOrWhiteSpace(path)))
            {
                if (!File.Exists(filePath))
                {
                    missing.Add(filePath);
                }
            }
        }

        return new JsonObject
        {
            ["missing"] = missing,
        };
    }

    private async Task<JsonArray> PickAudioFilesAsync()
    {
        if (_hostActions.PickAudioFilesAsync is null)
        {
            return new JsonArray();
        }

        var paths = await _hostActions.PickAudioFilesAsync();
        var result = new JsonArray();

        foreach (var filePath in paths.Where(path => !string.IsNullOrWhiteSpace(path)))
        {
            result.Add(filePath);
        }

        return result;
    }

    private async Task<JsonNode?> OpenFloatingControlAsync()
    {
        if (_hostActions.OpenFloatingControlAsync is not null)
        {
            await _hostActions.OpenFloatingControlAsync();
        }

        return null;
    }

    private async Task<JsonNode?> FocusMainWindowAsync()
    {
        if (_hostActions.FocusMainWindowAsync is not null)
        {
            await _hostActions.FocusMainWindowAsync();
        }

        return null;
    }

    public Task PublishShortcutTriggeredAsync(string cueId)
    {
        AppLogging.Write($"Bridge publishing workspace.shortcut.triggered for cue '{cueId}'.");
        return PostBridgeEventAsync("workspace.shortcut.triggered", new JsonObject
        {
            ["soundId"] = cueId,
        });
    }

    public Task PublishHostCommandAsync(string command, JsonNode? payload = null)
    {
        AppLogging.Write($"Bridge publishing workspace.host.command '{command}'.");
        return PostBridgeEventAsync("workspace.host.command", new JsonObject
        {
            ["command"] = command,
            ["payload"] = payload?.DeepClone(),
        });
    }

    private Task PostBridgeEventAsync(string eventName, JsonNode? payload)
    {
        if (_coreWebView is null)
        {
            return Task.CompletedTask;
        }

        var message = new JsonObject
        {
            ["event"] = eventName,
            ["payload"] = payload?.DeepClone(),
        };

        _coreWebView.PostWebMessageAsJson(message.ToJsonString(_jsonOptions));
        return Task.CompletedTask;
    }

    private Task NotifyServiceCommandCompletedAsync(string command, JsonNode? result)
    {
        if (_hostActions.ServiceCommandCompletedAsync is null)
        {
            return Task.CompletedTask;
        }

        return _hostActions.ServiceCommandCompletedAsync(command, result?.DeepClone());
    }
}
