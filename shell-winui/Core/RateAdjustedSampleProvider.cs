using NAudio.Wave;
using System;

namespace CodeXSoundboard.Shell.WinUI.Core;

internal sealed class RateAdjustedSampleProvider : ISampleProvider
{
    private readonly float[] _samples;
    private readonly int _channels;
    private readonly float _rate;
    private double _sourceFramePosition;

    public RateAdjustedSampleProvider(float[] samples, WaveFormat waveFormat, float rate)
    {
        _samples = samples;
        WaveFormat = waveFormat;
        _channels = waveFormat.Channels;
        _rate = Math.Clamp(rate, 0.25f, 4f);
    }

    public WaveFormat WaveFormat { get; }

    public int Read(float[] buffer, int offset, int count)
    {
        if (_samples.Length == 0 || count <= 0)
        {
            return 0;
        }

        var totalSourceFrames = _samples.Length / _channels;
        var outputFramesRequested = count / _channels;
        var outputFramesWritten = 0;

        while (outputFramesWritten < outputFramesRequested)
        {
            var sourceFrameIndex = (int)_sourceFramePosition;
            if (sourceFrameIndex >= totalSourceFrames)
            {
                break;
            }

            var nextSourceFrameIndex = Math.Min(sourceFrameIndex + 1, totalSourceFrames - 1);
            var fraction = (float)(_sourceFramePosition - sourceFrameIndex);

            for (var channel = 0; channel < _channels; channel++)
            {
                var baseSample = _samples[(sourceFrameIndex * _channels) + channel];
                var nextSample = _samples[(nextSourceFrameIndex * _channels) + channel];
                buffer[offset + (outputFramesWritten * _channels) + channel] =
                    baseSample + ((nextSample - baseSample) * fraction);
            }

            outputFramesWritten++;
            _sourceFramePosition += _rate;
        }

        return outputFramesWritten * _channels;
    }
}
