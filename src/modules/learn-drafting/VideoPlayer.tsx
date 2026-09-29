import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Maximize,
  Minimize,
  Pause,
  PictureInPicture,
  Play,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from 'lucide-react'

interface Props {
  src: string
  title: string
  startAt?: number
  onProgress?: (seconds: number) => void
  onEnded?: () => void
}

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]

function fmt(s: number): string {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

export default function VideoPlayer({ src, title, startAt = 0, onProgress, onEnded }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const progressBarRef = useRef<HTMLDivElement>(null)
  const hideControlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [muted, setMuted] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [fullscreen, setFullscreen] = useState(false)
  const [controlsVisible, setControlsVisible] = useState(true)
  const [buffered, setBuffered] = useState(0)
  const [showSpeedMenu, setShowSpeedMenu] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  // Seek to saved position on mount
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    const onLoaded = () => {
      if (startAt > 5) v.currentTime = startAt
      setDuration(v.duration || 0)
      setIsLoading(false)
    }
    v.addEventListener('loadedmetadata', onLoaded)
    return () => v.removeEventListener('loadedmetadata', onLoaded)
  }, [src, startAt])

  const togglePlay = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    if (v.paused) { v.play(); setPlaying(true) }
    else { v.pause(); setPlaying(false) }
  }, [])

  const handleTimeUpdate = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    setCurrentTime(v.currentTime)
    if (v.buffered.length > 0) setBuffered(v.buffered.end(v.buffered.length - 1))
    onProgress?.(v.currentTime)
  }, [onProgress])

  const seek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const bar = progressBarRef.current
    const v = videoRef.current
    if (!bar || !v) return
    const rect = bar.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    v.currentTime = ratio * (v.duration || 0)
  }, [])

  const skip = useCallback((secs: number) => {
    const v = videoRef.current
    if (!v) return
    v.currentTime = Math.max(0, Math.min(v.duration || 0, v.currentTime + secs))
  }, [])

  const changeVolume = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value)
    setVolume(val)
    if (videoRef.current) videoRef.current.volume = val
    setMuted(val === 0)
  }, [])

  const toggleMute = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    v.muted = !v.muted
    setMuted(v.muted)
  }, [])

  const setPlaybackSpeed = useCallback((s: number) => {
    setSpeed(s)
    setShowSpeedMenu(false)
    if (videoRef.current) videoRef.current.playbackRate = s
  }, [])

  const toggleFullscreen = useCallback(async () => {
    const el = containerRef.current
    if (!el) return
    if (!document.fullscreenElement) {
      await el.requestFullscreen()
      setFullscreen(true)
    } else {
      await document.exitFullscreen()
      setFullscreen(false)
    }
  }, [])

  const togglePiP = useCallback(async () => {
    const v = videoRef.current
    if (!v) return
    if (document.pictureInPictureElement) await document.exitPictureInPicture()
    else if (document.pictureInPictureEnabled) await v.requestPictureInPicture()
  }, [])

  const showControls = useCallback(() => {
    setControlsVisible(true)
    if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current)
    hideControlsTimer.current = setTimeout(() => {
      if (playing) setControlsVisible(false)
    }, 2800)
  }, [playing])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      switch (e.key) {
        case ' ': case 'k': e.preventDefault(); togglePlay(); break
        case 'ArrowRight': e.preventDefault(); skip(10); break
        case 'ArrowLeft': e.preventDefault(); skip(-10); break
        case 'f': e.preventDefault(); toggleFullscreen(); break
        case 'm': e.preventDefault(); toggleMute(); break
        case '>': setPlaybackSpeed(Math.min(2, speed + 0.25)); break
        case '<': setPlaybackSpeed(Math.max(0.5, speed - 0.25)); break
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [togglePlay, skip, toggleFullscreen, toggleMute, speed, setPlaybackSpeed])

  useEffect(() => {
    const handler = () => setFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0
  const bufferedPct = duration > 0 ? (buffered / duration) * 100 : 0

  if (!src) {
    return (
      <div className="ld-video-placeholder">
        <Play size={48} style={{ color: 'var(--gold)', opacity: 0.5 }} />
        <p>Video coming soon for this lesson</p>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className={`ld-player-wrap ${fullscreen ? 'ld-player-wrap--fs' : ''} ${!controlsVisible ? 'ld-player-wrap--hide-cursor' : ''}`}
      onMouseMove={showControls}
      onMouseLeave={() => { if (playing) setControlsVisible(false) }}
      onClick={(e) => { if ((e.target as HTMLElement).closest('.ld-player-controls')) return; togglePlay() }}
    >
      <video
        ref={videoRef}
        src={src}
        className="ld-video-el"
        onTimeUpdate={handleTimeUpdate}
        onEnded={() => { setPlaying(false); onEnded?.() }}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onWaiting={() => setIsLoading(true)}
        onCanPlay={() => setIsLoading(false)}
        playsInline
      />

      {isLoading && (
        <div className="ld-video-spinner">
          <div className="ld-spinner" />
        </div>
      )}

      {/* Big play button overlay when paused */}
      {!playing && !isLoading && (
        <div className="ld-play-overlay" onClick={togglePlay}>
          <div className="ld-play-circle">
            <Play size={32} fill="currentColor" />
          </div>
        </div>
      )}

      <div className={`ld-player-controls ${controlsVisible ? 'ld-player-controls--visible' : ''}`} onClick={(e) => e.stopPropagation()}>
        {/* Title bar */}
        <div className="ld-ctrl-title">{title}</div>

        {/* Progress bar */}
        <div
          ref={progressBarRef}
          className="ld-progress-track"
          onClick={seek}
        >
          <div className="ld-progress-buffered" style={{ width: `${bufferedPct}%` }} />
          <div className="ld-progress-played" style={{ width: `${progressPct}%` }}>
            <div className="ld-progress-thumb" />
          </div>
        </div>

        {/* Controls row */}
        <div className="ld-ctrl-row">
          <div className="ld-ctrl-left">
            <button className="ld-ctrl-btn" onClick={() => skip(-10)} title="Back 10s">
              <SkipBack size={18} />
            </button>
            <button className="ld-ctrl-btn ld-ctrl-btn--play" onClick={togglePlay}>
              {playing ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
            </button>
            <button className="ld-ctrl-btn" onClick={() => skip(10)} title="Forward 10s">
              <SkipForward size={18} />
            </button>

            <div className="ld-volume-group">
              <button className="ld-ctrl-btn" onClick={toggleMute}>
                {muted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={muted ? 0 : volume}
                onChange={changeVolume}
                className="ld-volume-slider"
                onClick={(e) => e.stopPropagation()}
              />
            </div>

            <span className="ld-time-display">
              {fmt(currentTime)} / {fmt(duration)}
            </span>
          </div>

          <div className="ld-ctrl-right">
            {/* Speed selector */}
            <div className="ld-speed-wrap">
              <button className="ld-ctrl-btn ld-speed-btn" onClick={() => setShowSpeedMenu((v) => !v)}>
                {speed}×
              </button>
              {showSpeedMenu && (
                <div className="ld-speed-menu">
                  {SPEEDS.map((s) => (
                    <button
                      key={s}
                      className={`ld-speed-option ${speed === s ? 'ld-speed-option--active' : ''}`}
                      onClick={() => setPlaybackSpeed(s)}
                    >
                      {s}×
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button className="ld-ctrl-btn" onClick={togglePiP} title="Picture in Picture">
              <PictureInPicture size={18} />
            </button>
            <button className="ld-ctrl-btn" onClick={toggleFullscreen} title="Fullscreen">
              {fullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
