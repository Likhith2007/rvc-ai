import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Play, Pause, RotateCcw, CheckCircle2, AlertCircle, Sparkles, Volume2 } from 'lucide-react';
import { formatDuration, audioBufferToWav } from '../utils/audioHelpers';

interface AudioRecorderProps {
  onRecordingComplete: (blob: Blob, durationSec: number) => void;
  targetMinDurationSec?: number; // 180 (3 min)
  targetMaxDurationSec?: number; // 420 (7 min)
}

export const AudioRecorder: React.FC<AudioRecorderProps> = ({
  onRecordingComplete,
  targetMinDurationSec = 180,
  targetMaxDurationSec = 420,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedDuration, setRecordedDuration] = useState(0);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const timerIntervalRef = useRef<any>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopRecordingCleanup();
      if (audioElementRef.current) {
        audioElementRef.current.pause();
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: 1,
          sampleRate: 48000,
        },
      });

      audioChunksRef.current = [];
      setElapsedSeconds(0);
      setRecordedBlob(null);
      setIsPlayingPreview(false);

      // Web Audio Analyser for live visualizer
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      audioCtxRef.current = audioCtx;
      analyserRef.current = analyser;

      // MediaRecorder setup
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';
      const mediaRecorder = new MediaRecorder(stream, { mimeType });

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const rawBlob = new Blob(audioChunksRef.current, { type: mimeType });
        // Decode to clean WAV
        try {
          const arrayBuf = await rawBlob.arrayBuffer();
          const decodedAudio = await audioCtx.decodeAudioData(arrayBuf);
          const wavBlob = audioBufferToWav(decodedAudio);
          setRecordedBlob(wavBlob);
          setRecordedDuration(decodedAudio.duration);
        } catch {
          setRecordedBlob(rawBlob);
          setRecordedDuration(elapsedSeconds);
        }
      };

      mediaRecorder.start(250);
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
      setIsPaused(false);

      // Start elapsed timer
      timerIntervalRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);

      // Start visualizer animation
      drawVisualizer();
    } catch (err) {
      console.error('Failed to access microphone:', err);
      alert('Microphone access is required for voice dataset recording.');
    }
  };

  const pauseResumeRecording = () => {
    if (!mediaRecorderRef.current) return;
    if (isPaused) {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      timerIntervalRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      clearInterval(timerIntervalRef.current);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
    }
    stopRecordingCleanup();
    setIsRecording(false);
    setIsPaused(false);
  };

  const stopRecordingCleanup = () => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
  };

  const resetRecording = () => {
    stopRecording();
    setRecordedBlob(null);
    setElapsedSeconds(0);
    setRecordedDuration(0);
    setIsPlayingPreview(false);
  };

  const drawVisualizer = () => {
    if (!canvasRef.current || !analyserRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const render = () => {
      animFrameRef.current = requestAnimationFrame(render);
      analyser.getByteFrequencyData(dataArray);

      ctx.fillStyle = '#090d16';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / bufferLength) * 2.2;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * canvas.height * 0.85;

        // Gradient for active bars
        const grad = ctx.createLinearGradient(0, canvas.height, 0, canvas.height - barHeight);
        grad.addColorStop(0, '#06b6d4');
        grad.addColorStop(0.5, '#6366f1');
        grad.addColorStop(1, '#a855f7');

        ctx.fillStyle = grad;
        ctx.fillRect(x, canvas.height - barHeight, barWidth - 1, barHeight);

        x += barWidth;
      }
    };

    render();
  };

  const togglePreviewPlay = () => {
    if (!recordedBlob) return;
    if (!audioElementRef.current) {
      audioElementRef.current = new Audio(URL.createObjectURL(recordedBlob));
      audioElementRef.current.onended = () => setIsPlayingPreview(false);
    }

    if (isPlayingPreview) {
      audioElementRef.current.pause();
      setIsPlayingPreview(false);
    } else {
      audioElementRef.current.play();
      setIsPlayingPreview(true);
    }
  };

  // Duration progress calculation (Optimal is 3-7 mins: 180s - 420s)
  const durationProgress = Math.min(100, (elapsedSeconds / targetMinDurationSec) * 100);
  const isOptimalDuration = elapsedSeconds >= targetMinDurationSec && elapsedSeconds <= targetMaxDurationSec;
  const isOverDuration = elapsedSeconds > targetMaxDurationSec;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Mic className="h-4.5 w-4.5 text-slate-900" />
            <h3 className="text-base font-bold text-slate-900">Live Voice Recorder</h3>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Recommended dataset length: <span className="text-slate-900 font-semibold">3 to 7 minutes</span> of clear speech or singing.
          </p>
        </div>

        {/* Status Gauge */}
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-2xl font-mono font-bold text-slate-900 tracking-wider">
              {formatDuration(isRecording ? elapsedSeconds : recordedDuration || 0)}
            </div>
            <div className="text-[11px] text-slate-500 flex items-center gap-1 justify-end">
              {isOptimalDuration ? (
                <span className="text-emerald-600 flex items-center gap-1 font-semibold">
                  <CheckCircle2 className="h-3 w-3" /> Optimal Length
                </span>
              ) : isOverDuration ? (
                <span className="text-amber-600 flex items-center gap-1 font-semibold">
                  <AlertCircle className="h-3 w-3" /> Ample Duration
                </span>
              ) : (
                <span className="text-slate-400">Target: 3:00 - 7:00</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Recommended Duration Progress Meter */}
      <div className="mt-4">
        <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5 font-medium">
          <span>Dataset Progress</span>
          <span>
            {elapsedSeconds < targetMinDurationSec
              ? `${Math.round(durationProgress)}% (Need ${formatDuration(targetMinDurationSec - elapsedSeconds)} more for best RVC quality)`
              : 'Target Met (Ready for RVC v2 training)'}
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 border border-slate-200">
          <div
            className={`h-full transition-all duration-300 ${
              isOptimalDuration
                ? 'bg-emerald-500'
                : isOverDuration
                ? 'bg-blue-500'
                : 'bg-slate-900'
            }`}
            style={{ width: `${Math.min(100, (elapsedSeconds / targetMinDurationSec) * 100)}%` }}
          />
        </div>
      </div>

      {/* Visualizer Canvas */}
      <div className="mt-4 relative overflow-hidden rounded-xl border border-slate-800 bg-slate-950 h-28 flex items-center justify-center">
        {isRecording ? (
          <canvas ref={canvasRef} width={640} height={112} className="h-full w-full object-cover" />
        ) : recordedBlob ? (
          <div className="flex flex-col items-center gap-2 text-slate-400">
            <CheckCircle2 className="h-8 w-8 text-emerald-400" />
            <span className="text-xs font-medium text-slate-300">
              Recording captured ({formatDuration(recordedDuration)})
            </span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-slate-500">
            <Volume2 className="h-8 w-8 text-slate-600 animate-pulse" />
            <span className="text-xs">Click Start Recording when ready to speak</span>
          </div>
        )}

        {isRecording && (
          <div className="absolute top-3 left-3 flex items-center gap-2 rounded-full bg-rose-950/80 px-2.5 py-0.5 text-[11px] font-semibold text-rose-300 border border-rose-800/60 backdrop-blur-sm">
            <span className="h-2 w-2 rounded-full bg-rose-500 animate-ping"></span>
            <span>{isPaused ? 'PAUSED' : 'RECORDING'}</span>
          </div>
        )}
      </div>

      {/* Recording Controls */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {!isRecording && !recordedBlob && (
            <button
              id="btn-start-record"
              onClick={startRecording}
              className="flex items-center gap-2 rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-rose-700 active:scale-95 transition-all"
            >
              <Mic className="h-4 w-4" />
              <span>Start Recording</span>
            </button>
          )}

          {isRecording && (
            <>
              <button
                id="btn-pause-record"
                onClick={pauseResumeRecording}
                className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-all shadow-sm"
              >
                {isPaused ? <Play className="h-4 w-4 text-emerald-600" /> : <Pause className="h-4 w-4 text-amber-600" />}
                <span>{isPaused ? 'Resume' : 'Pause'}</span>
              </button>

              <button
                id="btn-stop-record"
                onClick={stopRecording}
                className="flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-black shadow-sm transition-all"
              >
                <Square className="h-4 w-4 fill-current" />
                <span>Finish Recording</span>
              </button>
            </>
          )}

          {recordedBlob && !isRecording && (
            <>
              <button
                id="btn-preview-record"
                onClick={togglePreviewPlay}
                className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-200 transition-all"
              >
                {isPlayingPreview ? <Pause className="h-4 w-4 text-slate-700" /> : <Play className="h-4 w-4 text-slate-700 fill-current" />}
                <span>{isPlayingPreview ? 'Pause Preview' : 'Play Preview'}</span>
              </button>

              <button
                id="btn-reset-record"
                onClick={resetRecording}
                className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-all"
              >
                <RotateCcw className="h-4 w-4" />
                <span>Re-record</span>
              </button>
            </>
          )}
        </div>

        {recordedBlob && !isRecording && (
          <button
            id="btn-use-recording"
            onClick={() => onRecordingComplete(recordedBlob, recordedDuration)}
            className="flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-black active:scale-95 transition-all"
          >
            <CheckCircle2 className="h-4 w-4" />
            <span>Use Recording as Dataset</span>
          </button>
        )}
      </div>
    </div>
  );
};
