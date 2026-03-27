using NAudio.CoreAudioApi;
using NAudio.Wave;
using NAudio.Wave.SampleProviders;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;

namespace CodeXSoundboard.Shell.WinUI.Core;

public sealed class PlaybackService : IDisposable
{
    private readonly MMDeviceEnumerator _deviceEnumerator = new();
    private WasapiOut? _output;
    private AudioFileReader? _reader;
    private VolumeSampleProvider? _volumeProvider;
    private CueCardRecord? _currentCue;
    private string _selectedOutputDeviceId = string.Empty;
    private double _globalVolume = 0.8;
    private bool _repeatPlaybackEnabled;
    private bool _manualStop;
    private bool _disposed;

    public event EventHandler<PlaybackStateSnapshot>? PlaybackStateChanged;

    public IReadOnlyList<OutputDeviceRecord> GetOutputDevices()
    {
        var defaultDeviceId = string.Empty;
        try
        {
            defaultDeviceId = _deviceEnumerator.GetDefaultAudioEndpoint(DataFlow.Render, Role.Multimedia).ID;
        }
        catch
        {
            defaultDeviceId = string.Empty;
        }

        var devices = _deviceEnumerator
            .EnumerateAudioEndPoints(DataFlow.Render, DeviceState.Active)
            .Select(device => new OutputDeviceRecord(
                device.ID,
                device.FriendlyName,
                string.Equals(device.ID, defaultDeviceId, StringComparison.Ordinal)))
            .OrderByDescending(device => device.IsDefault)
            .ThenBy(device => device.Label, StringComparer.CurrentCultureIgnoreCase)
            .ToList();

        if (devices.Count == 0)
        {
            devices.Add(new OutputDeviceRecord(string.Empty, "Default output", true));
        }

        return devices;
    }

    public void SetOutputDevice(string? deviceId)
    {
        var nextDeviceId = deviceId ?? string.Empty;
        if (string.Equals(_selectedOutputDeviceId, nextDeviceId, StringComparison.Ordinal))
        {
            return;
        }

        _selectedOutputDeviceId = nextDeviceId;
        if (_currentCue is not null)
        {
            _ = PlayCueAsync(_currentCue);
        }
    }

    public void SetGlobalVolume(double volume)
    {
        _globalVolume = Math.Clamp(volume, 0, 1);
        if (_volumeProvider is not null && _currentCue is not null)
        {
            _volumeProvider.Volume = (float)Math.Clamp(_globalVolume * _currentCue.Volume, 0, 1);
        }

        RaisePlaybackState();
    }

    public void SetRepeatPlayback(bool isEnabled)
    {
        _repeatPlaybackEnabled = isEnabled;
        RaisePlaybackState();
    }

    public async Task PlayCueAsync(CueCardRecord cue)
    {
        ThrowIfDisposed();

        if (!File.Exists(cue.ResourcePath))
        {
            throw new FileNotFoundException("Audio resource was not found.", cue.ResourcePath);
        }

        StopActivePlaybackForReplacement();

        _currentCue = cue;
        _manualStop = false;
        _reader = new AudioFileReader(cue.ResourcePath);

        if (cue.TrimStartSeconds > 0)
        {
            _reader.CurrentTime = TimeSpan.FromSeconds(cue.TrimStartSeconds);
        }

        var sampleProvider = _reader.ToSampleProvider();
        if (cue.TrimEndSeconds is double trimEndSeconds && trimEndSeconds > cue.TrimStartSeconds)
        {
            sampleProvider = new OffsetSampleProvider(sampleProvider)
            {
                Take = TimeSpan.FromSeconds(trimEndSeconds - cue.TrimStartSeconds),
            };
        }

        if (Math.Abs(cue.PlaybackRate - 1.0) > 0.001)
        {
            sampleProvider = new RateAdjustedSampleProvider(
                ReadAllSamples(sampleProvider),
                sampleProvider.WaveFormat,
                (float)cue.PlaybackRate);
        }

        _volumeProvider = new VolumeSampleProvider(sampleProvider)
        {
            Volume = (float)Math.Clamp(_globalVolume * cue.Volume, 0, 1),
        };

        var outputDevice = ResolveOutputDevice();
        _output = outputDevice is null
            ? new WasapiOut(AudioClientShareMode.Shared, false, 50)
            : new WasapiOut(outputDevice, AudioClientShareMode.Shared, false, 50);

        _output.PlaybackStopped += HandlePlaybackStopped;
        _output.Init(_volumeProvider.ToWaveProvider());
        _output.Play();
        RaisePlaybackState();

        await Task.CompletedTask;
    }

    private static float[] ReadAllSamples(ISampleProvider sampleProvider)
    {
        var sourceBuffer = new float[sampleProvider.WaveFormat.SampleRate * sampleProvider.WaveFormat.Channels];
        var collectedSamples = new List<float>();

        while (true)
        {
            var read = sampleProvider.Read(sourceBuffer, 0, sourceBuffer.Length);
            if (read <= 0)
            {
                break;
            }

            for (var index = 0; index < read; index++)
            {
                collectedSamples.Add(sourceBuffer[index]);
            }
        }

        return collectedSamples.ToArray();
    }

    public void TogglePauseResume()
    {
        ThrowIfDisposed();

        if (_output is null)
        {
            return;
        }

        if (_output.PlaybackState == PlaybackState.Playing)
        {
            _output.Pause();
        }
        else if (_output.PlaybackState == PlaybackState.Paused)
        {
            _output.Play();
        }

        RaisePlaybackState();
    }

    public void StopAll()
    {
        ThrowIfDisposed();
        StopActivePlayback(clearCurrentCue: true);
        RaisePlaybackState();
    }

    public PlaybackStateSnapshot GetCurrentState()
    {
        return new PlaybackStateSnapshot(
            _currentCue?.Id ?? string.Empty,
            _currentCue?.DisplayName ?? string.Empty,
            _output?.PlaybackState == PlaybackState.Playing,
            _output?.PlaybackState == PlaybackState.Paused,
            _globalVolume,
            _repeatPlaybackEnabled);
    }

    private MMDevice? ResolveOutputDevice()
    {
        if (string.IsNullOrWhiteSpace(_selectedOutputDeviceId))
        {
            return null;
        }

        try
        {
            return _deviceEnumerator.GetDevice(_selectedOutputDeviceId);
        }
        catch
        {
            return null;
        }
    }

    private async void HandlePlaybackStopped(object? sender, StoppedEventArgs e)
    {
        if (sender is not WasapiOut stoppedOutput || !ReferenceEquals(stoppedOutput, _output))
        {
            return;
        }

        var shouldRepeat = !_manualStop && _repeatPlaybackEnabled && _currentCue is not null;
        var cueToRepeat = _currentCue;

        ReleasePlaybackResources(resetCurrentCue: !shouldRepeat);
        RaisePlaybackState();

        if (shouldRepeat && cueToRepeat is not null)
        {
            try
            {
                await PlayCueAsync(cueToRepeat);
            }
            catch
            {
                StopAll();
            }
        }
    }

    private void StopActivePlayback(bool clearCurrentCue)
    {
        _manualStop = true;
        if (_output is not null)
        {
            _output.Stop();
        }
        else
        {
            ReleasePlaybackResources(resetCurrentCue: clearCurrentCue);
        }

        if (clearCurrentCue)
        {
            _currentCue = null;
        }
    }

    private void StopActivePlaybackForReplacement()
    {
        if (_output is null)
        {
            ReleasePlaybackResources(resetCurrentCue: false);
            return;
        }

        _manualStop = true;
        _output.PlaybackStopped -= HandlePlaybackStopped;
        _output.Stop();
        ReleasePlaybackResources(resetCurrentCue: false);
    }

    private void ReleasePlaybackResources(bool resetCurrentCue)
    {
        if (_output is not null)
        {
            _output.PlaybackStopped -= HandlePlaybackStopped;
            _output.Dispose();
            _output = null;
        }

        _reader?.Dispose();
        _reader = null;
        _volumeProvider = null;
        _manualStop = false;

        if (resetCurrentCue)
        {
            _currentCue = null;
        }
    }

    private void RaisePlaybackState()
    {
        PlaybackStateChanged?.Invoke(this, GetCurrentState());
    }

    private void ThrowIfDisposed()
    {
        if (_disposed)
        {
            throw new ObjectDisposedException(nameof(PlaybackService));
        }
    }

    public void Dispose()
    {
        if (_disposed)
        {
            return;
        }

        ReleasePlaybackResources(resetCurrentCue: true);
        _deviceEnumerator.Dispose();
        _disposed = true;
    }
}

public sealed record PlaybackStateSnapshot(
    string ActiveCueId,
    string ActiveCueName,
    bool IsPlaying,
    bool IsPaused,
    double GlobalVolume,
    bool RepeatPlaybackEnabled);
