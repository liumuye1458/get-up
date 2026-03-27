import { useCallback, useEffect, useRef, useState } from 'react'
import WaveSurfer from 'wavesurfer.js'
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.esm.js'

type WaveformEditorProps = {
  cueId: string
  audioPath: string
  trimStartMs: number
  trimEndMs: number | null
  durationMs: number | null
  labels: {
    waveform: string
    start: string
    end: string
    segment: string
    loading: string
    untilEnd: string
  }
  onChange: (trimStartMs: number, trimEndMs: number | null) => void
}

type RegionLike = {
  start: number
  end: number
  on: (eventName: string, callback: () => void) => void
  remove?: () => void
}

type RegionsPluginLike = {
  addRegion: (options: {
    start: number
    end: number
    drag: boolean
    resize: boolean
    color: string
  }) => RegionLike
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function toFileUrl(filePath: string) {
  const normalized = filePath.replaceAll('\\', '/')
  return encodeURI(`file:///${normalized}`)
}

function toSeconds(ms: number | null) {
  return ms == null ? '' : (ms / 1000).toFixed(3)
}

function fromSeconds(value: string) {
  if (!value.trim()) {
    return null
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed * 1000)) : null
}

function formatSegment(trimStartMs: number, trimEndMs: number | null, durationMs: number | null) {
  const effectiveEnd = trimEndMs ?? durationMs

  if (effectiveEnd == null) {
    return '--'
  }

  return ((effectiveEnd - trimStartMs) / 1000).toFixed(3) + 's'
}

export function WaveformEditor({
  cueId,
  audioPath,
  trimStartMs,
  trimEndMs,
  durationMs,
  labels,
  onChange,
}: WaveformEditorProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const waveSurferRef = useRef<WaveSurfer | null>(null)
  const regionsPluginRef = useRef<RegionsPluginLike | null>(null)
  const regionRef = useRef<RegionLike | null>(null)
  const [loadedDurationMs, setLoadedDurationMs] = useState<number | null>(durationMs)
  const [isLoading, setIsLoading] = useState(true)

  const syncRegion = useCallback(
    (nextStartMs: number, nextEndMs: number | null) => {
      const wavesurfer = waveSurferRef.current
      const regions = regionsPluginRef.current

      if (!wavesurfer || !regions) {
        return
      }

      const durationSeconds = wavesurfer.getDuration()

      if (!durationSeconds || Number.isNaN(durationSeconds)) {
        return
      }

      if (regionRef.current?.remove) {
        regionRef.current.remove()
      }

      const start = clamp(nextStartMs / 1000, 0, durationSeconds)
      const rawEnd = nextEndMs == null ? durationSeconds : nextEndMs / 1000
      const end = clamp(Math.max(rawEnd, start + 0.05), 0.05, durationSeconds)
      const region = regions.addRegion({
        start,
        end,
        drag: true,
        resize: true,
        color: 'rgba(43, 109, 243, 0.18)',
      })

      region.on('update-end', () => {
        const updatedStart = Math.round(region.start * 1000)
        const updatedEnd = Math.round(region.end * 1000)
        onChange(updatedStart, updatedEnd)
      })

      regionRef.current = region
    },
    [onChange],
  )

  useEffect(() => {
    if (!containerRef.current) {
      return
    }

    const regions = RegionsPlugin.create()
    const wavesurfer = WaveSurfer.create({
      container: containerRef.current,
      url: toFileUrl(audioPath),
      height: 128,
      waveColor: '#bcd1ff',
      progressColor: '#2b6df3',
      cursorColor: '#ff7b2c',
      barWidth: 2,
      barGap: 1,
      barRadius: 3,
      normalize: true,
      plugins: [regions],
    })

    waveSurferRef.current = wavesurfer
    regionsPluginRef.current = regions as unknown as RegionsPluginLike

    wavesurfer.on('ready', () => {
      const nextDurationMs = Math.round(wavesurfer.getDuration() * 1000)
      setLoadedDurationMs(nextDurationMs)
      setIsLoading(false)
      syncRegion(trimStartMs, trimEndMs)
    })

    wavesurfer.on('error', () => {
      setIsLoading(false)
    })

    return () => {
      regionRef.current = null
      regionsPluginRef.current = null
      waveSurferRef.current = null
      wavesurfer.destroy()
    }
  }, [audioPath, cueId, syncRegion, trimEndMs, trimStartMs])

  useEffect(() => {
    if (!isLoading) {
      syncRegion(trimStartMs, trimEndMs)
    }
  }, [isLoading, syncRegion, trimEndMs, trimStartMs])

  const effectiveDurationMs = loadedDurationMs ?? durationMs ?? null

  function handleStartInput(value: string) {
    const nextStartMs = fromSeconds(value)
    const safeStartMs = nextStartMs ?? 0
    const upperBound = trimEndMs ?? effectiveDurationMs ?? safeStartMs
    onChange(Math.min(safeStartMs, upperBound), trimEndMs)
  }

  function handleEndInput(value: string) {
    const nextEndMs = fromSeconds(value)

    if (nextEndMs == null) {
      onChange(trimStartMs, null)
      return
    }

    const safeEndMs = Math.max(nextEndMs, trimStartMs + 50)
    onChange(trimStartMs, safeEndMs)
  }

  return (
    <section className="panel waveform-panel">
      <div className="waveform-header">
        <div>
          <p className="eyebrow">{labels.waveform}</p>
          <strong>{formatSegment(trimStartMs, trimEndMs, effectiveDurationMs)}</strong>
        </div>
        <span className="muted small">{isLoading ? labels.loading : ''}</span>
      </div>

      <div className="waveform-surface" ref={containerRef} />

      <div className="waveform-grid">
        <label className="field">
          <span>{labels.start}</span>
          <input
            type="number"
            step="0.001"
            min="0"
            value={toSeconds(trimStartMs)}
            onChange={(event) => handleStartInput(event.target.value)}
          />
        </label>

        <label className="field">
          <span>{labels.end}</span>
          <input
            type="number"
            step="0.001"
            min="0"
            placeholder={labels.untilEnd}
            value={toSeconds(trimEndMs)}
            onChange={(event) => handleEndInput(event.target.value)}
          />
        </label>

        <div className="field waveform-segment">
          <span>{labels.segment}</span>
          <div className="waveform-value">{formatSegment(trimStartMs, trimEndMs, effectiveDurationMs)}</div>
        </div>
      </div>
    </section>
  )
}
