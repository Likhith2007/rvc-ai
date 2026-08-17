import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Download, Volume2, VolumeX, RotateCcw, Sparkles, SlidersHorizontal, ArrowLeftRight } from 'lucide-react';
import { formatDuration } from '../utils/audioHelpers';

interface AudioPlayerABProps {
  sourceUrl: string;
  sourceName: string;
  convertedUrl?: string;
  convertedName?: string;
  modelName?: string;
  pitchShiftSemis?: number;
}

export const AudioPlayerAB: React.FC<AudioPlayerABProps> = ({
  sourceUrl,
  sourceName,
  convertedUrl,
  convertedName = 'RVC Converted Voice',
  modelName = 'RVC Model',
  pitchShiftSemis = 0,
}) => {
  const [activeTrack, setActiveTrack] = useState<'source' | 'converted'>(convertedUrl ? 'converted' : 'source');
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [volume, setVolume] = useState<number>(0.9);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [isLooping, setIsLooping] = useState<boolean>(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Active audio URL
  const activeUrl = activeTrack === 'converted' && convertedUrl ? convertedUrl : sourceUrl;

  useEffect(() => {
    if (convertedUrl) {
      setActiveTrack('converted');
    }
  }, [convertedUrl]);

  // Sync playback element
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.volume = isMuted ? 0 : volume;
    audio.playbackRate = playbackSpeed;
    audio.loop = isLooping;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleLoadedMetadata = () => {
      setDuration(audio.duration || 0);
    };

    const handleEnded = () => {
      if (!isLooping) {
        setIsPlaying(false);
      }
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [volume, isMuted, playbackSpeed, isLooping, activeUrl]);

  // Handle Play/Pause
  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().then(() => {
        setIsPlaying(true);
        drawWaveform();
      }).catch((e) => console.warn('Play interrupted', e));
    }
  };

  // Switch between Source and Converted while maintaining position
  const switchTrack = (target: 'source' | 'converted') => {
    if (target === 'converted' && !convertedUrl) return;
    const currentPos = audioRef.current ? audioRef.current.currentTime : 0;
    const wasPlaying = isPlaying;

    setActiveTrack(target);

    setTimeout(() => {
      if (audioRef.current) {
        audioRef.current.currentTime = currentPos;
        if (wasPlaying) {
          audioRef.current.play();
          setIsPlaying(true);
        }
      }
    }, 50);
  };

  // Scrub bar click
  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    const targetTime = ratio * duration;

    if (audioRef.current) {
      audioRef.current.currentTime = targetTime;
      setCurrentTime(targetTime);
    }
  };

  // Canvas visualizer animation
  const drawWaveform = () => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      if (!isPlaying) return;
      animFrameRef.current = requestAnimationFrame(render);

      ctx.fillStyle = '#070b13';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const numBars = 48;
      const barWidth = canvas.width / numBars;

      for (let i = 0; i < numBars; i++) {
        const timeOffset = (Date.now() / 150) + (i * 0.3);
        const amp = (Math.sin(timeOffset) * 0.4 + Math.cos(timeOffset * 1.5) * 0.3 + 0.3) * (canvas.height * 0.7);
        const barHeight = Math.max(4, amp);
        const y = (canvas.height - barHeight) / 2;

        const isPast = (i / numBars) <= (currentTime / Math.max(0.1, duration));
        
        ctx.fillStyle = isPast
          ? (activeTrack === 'converted' ? '#06b6d4' : '#6366f1')
          : '#1e293b';

        ctx.fillRect(i * barWidth + 2, y, barWidth - 4, barHeight);
      }
    };

    render();
  };

  useEffect(() => {
    if (isPlaying) {
      drawWaveform();
    } else if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
    }
  }, [isPlaying, currentTime, duration, activeTrack]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
      <audio ref={audioRef} src={activeUrl} />

      {/* Header Deck: A/B Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse"></span>
            <h4 className="text-base font-bold text-slate-900 tracking-tight">A/B Dual-Deck Audio Comparison</h4>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Switch seamlessly in real-time between original source vocals and transformed RVC output.
          </p>
        </div>

        {/* A/B Mode Toggle */}
        <div className="flex items-center rounded-xl bg-slate-100 p-1 border border-slate-200">
          <button
            id="btn-switch-source"
            onClick={() => switchTrack('source')}
            className={`flex items-center gap-2 rounded-lg px-4 py-1.5 text-xs font-semibold transition-all ${
              activeTrack === 'source'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>Original Source (A)</span>
          </button>

          <button
            id="btn-switch-converted"
            disabled={!convertedUrl}
            onClick={() => switchTrack('converted')}
            className={`flex items-center gap-2 rounded-lg px-4 py-1.5 text-xs font-semibold transition-all disabled:opacity-40 ${
              activeTrack === 'converted'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sparkles className="h-3 w-3 text-amber-300" />
            <span>RVC Output (B)</span>
          </button>
        </div>
      </div>

      {/* Active Track Metadata Badge */}
      <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-2.5 border border-slate-200 text-xs">
        <div className="flex items-center gap-2 truncate">
          <span className="font-semibold text-slate-500">Listening to:</span>
          <span className="font-bold text-slate-900 truncate">
            {activeTrack === 'converted' ? `${convertedName} (${modelName})` : sourceName}
          </span>
        </div>

        {activeTrack === 'converted' && pitchShiftSemis !== 0 && (
          <span className="rounded-md bg-white px-2 py-0.5 text-[11px] font-mono text-slate-700 border border-slate-200 shadow-xs shrink-0">
            Pitch: {pitchShiftSemis > 0 ? `+${pitchShiftSemis}` : pitchShiftSemis} st
          </span>
        )}
      </div>

      {/* Synchronized Waveform & Seek Bar */}
      <div className="space-y-2">
        <div
          onClick={handleSeek}
          className="group cursor-pointer relative h-20 w-full overflow-hidden rounded-xl border border-slate-800 bg-slate-950 flex items-center"
        >
          <canvas ref={canvasRef} width={500} height={80} className="h-full w-full object-cover" />

          {/* Scrub Needle Line */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg pointer-events-none transition-all"
            style={{ left: `${(currentTime / Math.max(0.1, duration)) * 100}%` }}
          >
            <div className="h-2 w-2 -ml-[3px] rounded-full bg-blue-400 shadow-md"></div>
          </div>
        </div>

        {/* Time Labels */}
        <div className="flex justify-between text-xs font-mono text-slate-500">
          <span>{formatDuration(currentTime)}</span>
          <span>{formatDuration(duration)}</span>
        </div>
      </div>

      {/* Playback Controls & Action Deck */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
        {/* Play / Skip / Speed */}
        <div className="flex items-center gap-3">
          <button
            id="btn-play-pause"
            onClick={togglePlay}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-900 text-white shadow-sm hover:bg-black active:scale-95 transition-all"
          >
            {isPlaying ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current ml-0.5" />}
          </button>

          {/* Speed Selector */}
          <div className="flex items-center rounded-xl bg-slate-100 p-1 border border-slate-200 text-[11px] font-mono">
            {[0.75, 1.0, 1.25, 1.5].map((spd) => (
              <button
                key={spd}
                onClick={() => setPlaybackSpeed(spd)}
                className={`rounded-lg px-2 py-1 transition-colors ${
                  playbackSpeed === spd ? 'bg-slate-900 text-white font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {spd}x
              </button>
            ))}
          </div>

          {/* Loop Toggle */}
          <button
            onClick={() => setIsLooping(!isLooping)}
            title="Toggle Loop"
            className={`flex h-8 w-8 items-center justify-center rounded-xl border text-xs transition-colors ${
              isLooping
                ? 'border-slate-900 bg-slate-900 text-white'
                : 'border-slate-200 bg-white text-slate-500 hover:text-slate-900'
            }`}
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Volume & Download */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsMuted(!isMuted)}
              className="text-slate-500 hover:text-slate-900"
            >
              {isMuted || volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={isMuted ? 0 : volume}
              onChange={(e) => {
                setVolume(Number(e.target.value));
                setIsMuted(false);
              }}
              className="w-20 accent-slate-900"
            />
          </div>

          {/* Download Converted Audio */}
          {convertedUrl && (
            <a
              id="btn-download-converted-audio"
              href={convertedUrl}
              download={`${modelName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_converted.wav`}
              className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-black active:scale-95 transition-all"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Download Master WAV</span>
            </a>
          )}
        </div>
      </div>
    </div>
  );
};
