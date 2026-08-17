import React, { useState, useRef } from 'react';
import { Wand2, UploadCloud, Sparkles, Sliders, CheckCircle2, Play, RefreshCw, Layers, Music, Mic, FileAudio, ArrowRight, Volume2 } from 'lucide-react';
import { RvcModel, ConversionJob, ConversionConfig, PitchAlgorithm } from '../types';
import { AudioPlayerAB } from './AudioPlayerAB';

interface VoiceConverterProps {
  models: RvcModel[];
  selectedModelId: string | null;
  onSelectModelId: (id: string) => void;
  onConvertAudio: (modelId: string, file: File, config: ConversionConfig) => Promise<ConversionJob>;
  conversions: ConversionJob[];
}

export const VoiceConverter: React.FC<VoiceConverterProps> = ({
  models,
  selectedModelId,
  onSelectModelId,
  onConvertAudio,
  conversions,
}) => {
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [pitchShiftSemis, setPitchShiftSemis] = useState<number>(0);
  const [indexRatio, setIndexRatio] = useState<number>(0.75);
  const [pitchAlgorithm, setPitchAlgorithm] = useState<PitchAlgorithm>('rmvpe');
  const [protectVoiceless, setProtectVoiceless] = useState<number>(0.33);
  const [volumeEnvelope, setVolumeEnvelope] = useState<number>(1.0);
  const [resampleRate, setResampleRate] = useState<number>(0);
  const [cleanOutput, setCleanOutput] = useState<boolean>(true);

  const [isConverting, setIsConverting] = useState<boolean>(false);
  const [isGeneratingDemo, setIsGeneratingDemo] = useState<boolean>(false);
  const [latestConversion, setLatestConversion] = useState<ConversionJob | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Default select first model if none selected
  const activeModel = models.find((m) => m.id === selectedModelId) || models[0];

  // Quick preset pitch buttons
  const setPitchPreset = (semis: number) => {
    setPitchShiftSemis(semis);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSourceFile(e.target.files[0]);
    }
  };

  // Generate instant vocal demo for testing
  const handleGenerateSampleInput = async (type: 'speech' | 'singing') => {
    setIsGeneratingDemo(true);
    try {
      const res = await fetch('/api/generate-sample-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, duration: 6.0 }),
      });
      const data = await res.json();
      
      // Fetch as blob to create File
      const audioRes = await fetch(data.url);
      const blob = await audioRes.blob();
      const file = new File([blob], `${type}_test_vocal.wav`, { type: 'audio/wav' });
      setSourceFile(file);
    } catch (err) {
      console.error('Failed to generate sample:', err);
    } finally {
      setIsGeneratingDemo(false);
    }
  };

  const handleStartConversion = async () => {
    let fileToConvert = sourceFile;

    setIsConverting(true);
    try {
      // If no file loaded yet, auto-generate demo singing vocal so the button always works seamlessly
      if (!fileToConvert) {
        setIsGeneratingDemo(true);
        const res = await fetch('/api/generate-sample-audio', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'singing', duration: 6.0 }),
        });
        const data = await res.json();
        const audioRes = await fetch(data.url);
        const blob = await audioRes.blob();
        fileToConvert = new File([blob], 'demo_singing_vocal.wav', { type: 'audio/wav' });
        setSourceFile(fileToConvert);
        setIsGeneratingDemo(false);
      }

      const targetModel = activeModel || models[0];
      if (!targetModel) {
        throw new Error('No RVC model available. Please train or select a model first.');
      }

      const config: ConversionConfig = {
        modelId: targetModel.id,
        pitchShiftSemis,
        indexRatio,
        pitchAlgorithm,
        protectVoiceless,
        resampleRate,
        volumeEnvelope,
        cleanOutput,
      };

      const resultJob = await onConvertAudio(targetModel.id, fileToConvert, config);
      setLatestConversion(resultJob);
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Voice conversion failed');
    } finally {
      setIsConverting(false);
      setIsGeneratingDemo(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 md:p-8 shadow-sm">
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-800 mb-3">
            <Wand2 className="h-3.5 w-3.5 text-blue-600" />
            <span>Step 3: Neural Voice Transformation & Inference Studio</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Convert Any Voice into Your Trained RVC Target
          </h2>
          <p className="mt-2 text-sm text-slate-500 leading-relaxed">
            Select your trained voice model or pre-configured studio vocalists, upload your source singing vocals or dialogue, and transform the pitch, timbre, and formant characteristics in seconds.
          </p>
        </div>
      </div>

      {/* Target Model Selector Cards */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Layers className="h-4 w-4 text-slate-700" />
            <span>Select Target Voice Model</span>
          </label>
          <span className="text-xs text-slate-400 font-mono">{models.length} Models Available</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {models.map((model) => {
            const isSelected = activeModel?.id === model.id;
            return (
              <div
                key={model.id}
                onClick={() => onSelectModelId(model.id)}
                className={`cursor-pointer rounded-2xl p-4 transition-all border flex flex-col justify-between shadow-xs ${
                  isSelected
                    ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 text-slate-900'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`h-11 w-11 rounded-xl bg-gradient-to-tr ${
                      model.avatarColor || 'from-slate-700 to-slate-900'
                    } flex items-center justify-center text-white font-bold text-sm shadow-xs shrink-0`}
                  >
                    {model.speakerName.charAt(0)}
                  </div>
                  <div className="truncate">
                    <h4 className={`font-bold text-sm truncate tracking-tight ${isSelected ? 'text-white' : 'text-slate-900'}`}>{model.name}</h4>
                    <p className={`text-xs font-medium truncate mt-0.5 ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>{model.speakerName}</p>
                    <div className="flex items-center gap-2 mt-2 text-[10px] font-mono">
                      <span className={`rounded px-1.5 py-0.5 border ${isSelected ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                        {model.targetSampleRate} Hz
                      </span>
                      <span className={`rounded px-1.5 py-0.5 border ${isSelected ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                        {model.epochsTrained} Epochs
                      </span>
                    </div>
                  </div>
                </div>

                {isSelected && (
                  <div className="mt-3 pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-300 font-semibold">
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> Target Active
                    </span>
                    <span>IVF-Flat Index Loaded</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Conversion Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Source Audio & Hyperparameters */}
        <div className="lg:col-span-5 space-y-6">
          {/* Source Audio Input Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
              <FileAudio className="h-4 w-4 text-slate-700" />
              <span>1. Source Vocal Input</span>
            </h3>

            {/* Dropzone for Source Audio */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="cursor-pointer relative overflow-hidden rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center transition-all hover:border-slate-400 hover:bg-slate-100"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*,.wav,.mp3,.m4a,.flac"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="flex flex-col items-center justify-center gap-2">
                <UploadCloud className="h-6 w-6 text-slate-600" />
                <p className="text-xs font-semibold text-slate-800">
                  {sourceFile ? sourceFile.name : 'Click to select source audio clip to convert'}
                </p>
                <span className="text-[11px] text-slate-400">WAV, MP3, FLAC (Singing or Speech)</span>
              </div>
            </div>

            {/* Quick Demo Vocal Generators */}
            <div>
              <span className="block text-[11px] text-slate-500 mb-1.5">Or test immediately with demo vocal clips:</span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={isGeneratingDemo}
                  onClick={() => handleGenerateSampleInput('singing')}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-50 shadow-xs transition-all"
                >
                  <Music className="h-3.5 w-3.5 text-slate-600" />
                  <span>Demo Singing Melodic</span>
                </button>

                <button
                  type="button"
                  disabled={isGeneratingDemo}
                  onClick={() => handleGenerateSampleInput('speech')}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-50 shadow-xs transition-all"
                >
                  <Mic className="h-3.5 w-3.5 text-slate-600" />
                  <span>Demo Dialogue Speech</span>
                </button>
              </div>
            </div>
          </div>

          {/* Hyperparameters Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
              <Sliders className="h-4 w-4 text-slate-700" />
              <span>2. Inference Controls</span>
            </h3>

            {/* Pitch Shift Slider & Quick Presets */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-slate-700">Pitch Shift (Semitones)</span>
                <span className="font-mono text-slate-900 font-bold">
                  {pitchShiftSemis > 0 ? `+${pitchShiftSemis}` : pitchShiftSemis} Semitones
                </span>
              </div>
              <input
                id="slider-pitch-shift"
                type="range"
                min={-24}
                max={24}
                step={1}
                value={pitchShiftSemis}
                onChange={(e) => setPitchShiftSemis(Number(e.target.value))}
                className="w-full accent-slate-900"
              />

              {/* Pitch Quick Chips */}
              <div className="flex items-center gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => setPitchPreset(-12)}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-medium border transition-colors ${
                    pitchShiftSemis === -12
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 bg-white text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Female → Male (-12)
                </button>

                <button
                  type="button"
                  onClick={() => setPitchPreset(0)}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-medium border transition-colors ${
                    pitchShiftSemis === 0
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 bg-white text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Unison (0)
                </button>

                <button
                  type="button"
                  onClick={() => setPitchPreset(12)}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-medium border transition-colors ${
                    pitchShiftSemis === 12
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 bg-white text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Male → Female (+12)
                </button>
              </div>
            </div>

            {/* Index Retrieval Ratio */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-slate-700">Feature Index Retrieval Ratio</span>
                <span className="font-mono text-slate-900 font-bold">{indexRatio.toFixed(2)}</span>
              </div>
              <input
                id="slider-index-ratio"
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={indexRatio}
                onChange={(e) => setIndexRatio(Number(e.target.value))}
                className="w-full accent-slate-900"
              />
              <div className="flex justify-between text-[10px] text-slate-400 font-medium">
                <span>0.0 (Pure ContentVec)</span>
                <span>0.75 (Balanced Timbre)</span>
                <span>1.0 (Exact Accent)</span>
              </div>
            </div>

            {/* Algorithm & Consonants */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1.5">
                  Pitch Algorithm
                </label>
                <select
                  value={pitchAlgorithm}
                  onChange={(e) => setPitchAlgorithm(e.target.value as PitchAlgorithm)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none shadow-sm"
                >
                  <option value="rmvpe">RMVPE (Accurate)</option>
                  <option value="crepe">Crepe</option>
                  <option value="harvest">Harvest</option>
                  <option value="pm">PM</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1.5">
                  Protect Consonants
                </label>
                <select
                  value={protectVoiceless}
                  onChange={(e) => setProtectVoiceless(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none shadow-sm"
                >
                  <option value={0.2}>0.20 (Vocal Focus)</option>
                  <option value={0.33}>0.33 (Default)</option>
                  <option value={0.5}>0.50 (Max Clarity)</option>
                </select>
              </div>
            </div>

            {/* Convert CTA */}
            <button
              id="btn-convert-voice"
              disabled={isConverting || models.length === 0}
              onClick={handleStartConversion}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-black active:scale-95 disabled:opacity-50 transition-all"
            >
              {isConverting ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Processing Voice Conversion...</span>
                </>
              ) : isGeneratingDemo ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Loading Demo Vocal...</span>
                </>
              ) : (
                <>
                  <Wand2 className="h-4 w-4" />
                  <span>{sourceFile ? 'Convert Voice with RVC' : 'Convert Voice (Auto-Load Demo & Run)'}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right: Output Player & History */}
        <div className="lg:col-span-7 space-y-6">
          {latestConversion && latestConversion.resultAudioUrl ? (
            <AudioPlayerAB
              sourceUrl={latestConversion.sourceAudioUrl}
              sourceName={latestConversion.sourceAudioName}
              convertedUrl={latestConversion.resultAudioUrl}
              convertedName="RVC Target Voice"
              modelName={latestConversion.modelName}
              pitchShiftSemis={latestConversion.config.pitchShiftSemis}
            />
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-500 shadow-sm">
              <Wand2 className="mx-auto h-10 w-10 text-slate-400 mb-3" />
              <h4 className="text-base font-semibold text-slate-800">Ready for Voice Conversion</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Select your source vocal or click a Demo Vocal clip on the left, then hit "Convert Voice with RVC" to listen to the master output.
              </p>
            </div>
          )}

          {/* Recent Conversions History */}
          {conversions.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3 shadow-sm">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Recent Voice Conversions ({conversions.length})
              </h4>

              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {conversions.map((conv) => (
                  <div
                    key={conv.id}
                    onClick={() => setLatestConversion(conv)}
                    className={`cursor-pointer flex items-center justify-between rounded-xl p-3 text-xs border transition-all ${
                      latestConversion?.id === conv.id
                        ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                        : 'border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3 truncate">
                      <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${latestConversion?.id === conv.id ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-700'} shrink-0`}>
                        <Volume2 className="h-3.5 w-3.5" />
                      </div>
                      <div className="truncate">
                        <div className="font-semibold truncate">{conv.sourceAudioName}</div>
                        <div className={`text-[11px] font-medium ${latestConversion?.id === conv.id ? 'text-slate-300' : 'text-slate-500'}`}>Model: {conv.modelName}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-mono ${latestConversion?.id === conv.id ? 'text-slate-400' : 'text-slate-400'}`}>
                        {new Date(conv.createdAt).toLocaleTimeString()}
                      </span>
                      <button className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors ${latestConversion?.id === conv.id ? 'bg-white text-slate-900' : 'bg-slate-100 text-slate-800 hover:bg-slate-200'}`}>
                        Load
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
