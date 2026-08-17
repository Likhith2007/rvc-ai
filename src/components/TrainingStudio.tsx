import React, { useState, useEffect, useRef } from 'react';
import { Cpu, Play, CheckCircle2, AlertCircle, Clock, Activity, Zap, Terminal, RefreshCw, XCircle, ArrowRight, ShieldCheck, Database, Layers } from 'lucide-react';
import { AudioDataset, TrainingJob, TrainingConfig, PitchAlgorithm, SampleRate, RvcModel } from '../types';
import { formatDuration } from '../utils/audioHelpers';

interface TrainingStudioProps {
  datasets: AudioDataset[];
  selectedDataset: AudioDataset | null;
  onSelectDataset: (dataset: AudioDataset | null) => void;
  trainingJobs: TrainingJob[];
  onStartTraining: (config: TrainingConfig) => Promise<void>;
  onCancelTraining: (jobId: string) => Promise<void>;
  onUseModelForInference: (modelId: string) => void;
  activeJobId: string | null;
  setActiveJobId: (jobId: string | null) => void;
}

export const TrainingStudio: React.FC<TrainingStudioProps> = ({
  datasets,
  selectedDataset,
  onSelectDataset,
  trainingJobs,
  onStartTraining,
  onCancelTraining,
  onUseModelForInference,
  activeJobId,
  setActiveJobId,
}) => {
  // Config form state
  const [modelName, setModelName] = useState('');
  const [targetSampleRate, setTargetSampleRate] = useState<SampleRate>(48000);
  const [pitchGuidance, setPitchGuidance] = useState<boolean>(true);
  const [pitchAlgorithm, setPitchAlgorithm] = useState<PitchAlgorithm>('rmvpe');
  const [epochs, setEpochs] = useState<number>(150);
  const [batchSize, setBatchSize] = useState<number>(8);
  const [saveFrequency, setSaveFrequency] = useState<number>(25);
  const [cleanAudio, setCleanAudio] = useState<boolean>(true);
  const [isStarting, setIsStarting] = useState<boolean>(false);
  const [activeLogFilter, setActiveLogFilter] = useState<'all' | 'loss' | 'steps'>('all');

  const logsContainerRef = useRef<HTMLDivElement | null>(null);

  // Sync default model name when dataset selected
  useEffect(() => {
    if (selectedDataset) {
      setModelName(`${selectedDataset.speakerName.replace(/\s+/g, '_')}_RVC_v2`);
    } else if (datasets.length > 0 && !selectedDataset) {
      onSelectDataset(datasets[0]);
    }
  }, [selectedDataset, datasets]);

  // Set active job to latest running or completed
  useEffect(() => {
    if (!activeJobId && trainingJobs.length > 0) {
      const runningJob = trainingJobs.find((j) => j.status === 'training' || j.status === 'preprocessing' || j.status === 'queued');
      if (runningJob) {
        setActiveJobId(runningJob.id);
      } else {
        setActiveJobId(trainingJobs[0].id);
      }
    }
  }, [trainingJobs, activeJobId]);

  // Auto-scroll logs
  const currentJob = trainingJobs.find((j) => j.id === activeJobId) || trainingJobs[0];

  useEffect(() => {
    if (logsContainerRef.current) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
    }
  }, [currentJob?.logs]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDataset) {
      alert('Please select a voice dataset first.');
      return;
    }

    setIsStarting(true);
    try {
      const config: TrainingConfig = {
        datasetId: selectedDataset.id,
        modelName: modelName.trim() || `${selectedDataset.speakerName}_RVC`,
        targetSampleRate,
        pitchGuidance,
        pitchAlgorithm,
        epochs,
        batchSize,
        saveFrequency,
        useGpu: true,
        gpuDevice: 'cuda:0',
        hubertModel: 'ContentVec_768_v2',
        cleanAudio,
      };

      await onStartTraining(config);
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Failed to start training');
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 md:p-8 shadow-sm">
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-800 mb-3">
            <Cpu className="h-3.5 w-3.5 text-blue-600" />
            <span>Step 2: Background RVC Model Training & Index Clustering</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Train Custom Neural Voice Conversion Model
          </h2>
          <p className="mt-2 text-sm text-slate-500 leading-relaxed">
            The background compute engine extracts HuBERT latent representations, estimates pitch curves using RMVPE/Crepe, trains a multi-period discriminator network, and generates a FAISS feature retrieval index (`.index`) for zero-bleed voice conversion.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Form: Configuration */}
        <div className="lg:col-span-5 space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3 mb-4">
              <Zap className="h-4 w-4 text-slate-700" />
              <span>Training Hyperparameters</span>
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Dataset Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Voice Dataset <span className="text-rose-500">*</span>
                </label>
                {datasets.length === 0 ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
                    No datasets found. Please create or upload a voice dataset in Step 1 first.
                  </div>
                ) : (
                  <select
                    id="select-training-dataset"
                    value={selectedDataset?.id || ''}
                    onChange={(e) => {
                      const found = datasets.find((d) => d.id === e.target.value);
                      onSelectDataset(found || null);
                    }}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 shadow-sm"
                  >
                    {datasets.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({formatDuration(d.totalDurationSeconds)} • {d.speakerName})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Model Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Target Model Checkpoint Name
                </label>
                <input
                  id="input-model-name"
                  type="text"
                  value={modelName}
                  onChange={(e) => setModelName(e.target.value)}
                  placeholder="e.g. MyVoice_v2_RMVPE"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 shadow-sm"
                />
              </div>

              {/* Sample Rate & Pitch Guidance */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1.5">
                    Target Sample Rate
                  </label>
                  <select
                    id="select-sample-rate"
                    value={targetSampleRate}
                    onChange={(e) => setTargetSampleRate(Number(e.target.value) as SampleRate)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none shadow-sm"
                  >
                    <option value={48000}>48000 Hz (RVC v2 HQ)</option>
                    <option value={40000}>40000 Hz (RVC v1)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1.5">
                    Pitch Algorithm (F0)
                  </label>
                  <select
                    id="select-pitch-algorithm"
                    value={pitchAlgorithm}
                    onChange={(e) => setPitchAlgorithm(e.target.value as PitchAlgorithm)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none shadow-sm"
                  >
                    <option value="rmvpe">RMVPE (Best & Fast)</option>
                    <option value="crepe">Crepe (Neural Pitch)</option>
                    <option value="harvest">Harvest (Detailed)</option>
                    <option value="pm">PM (Fast)</option>
                  </select>
                </div>
              </div>

              {/* Epochs Slider */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="font-semibold text-slate-700">Training Epochs</span>
                  <span className="font-mono text-slate-900 font-bold">{epochs} Epochs</span>
                </div>
                <input
                  id="slider-epochs"
                  type="range"
                  min={50}
                  max={500}
                  step={10}
                  value={epochs}
                  onChange={(e) => setEpochs(Number(e.target.value))}
                  className="w-full accent-slate-900"
                />
                <div className="flex justify-between text-[10px] text-slate-400 font-medium">
                  <span>50 (Quick Test)</span>
                  <span>150 (Balanced)</span>
                  <span>500 (Studio Master)</span>
                </div>
              </div>

              {/* Batch Size & Save Frequency */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1.5">
                    Batch Size
                  </label>
                  <select
                    id="select-batch-size"
                    value={batchSize}
                    onChange={(e) => setBatchSize(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none shadow-sm"
                  >
                    <option value={4}>4 (Lower VRAM)</option>
                    <option value={8}>8 (Standard)</option>
                    <option value={16}>16 (High Throughput)</option>
                    <option value={32}>32 (Ultra GPU)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1.5">
                    Save Checkpoint Every
                  </label>
                  <select
                    id="select-save-freq"
                    value={saveFrequency}
                    onChange={(e) => setSaveFrequency(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none shadow-sm"
                  >
                    <option value={10}>10 Epochs</option>
                    <option value={25}>25 Epochs</option>
                    <option value={50}>50 Epochs</option>
                  </select>
                </div>
              </div>

              {/* Toggles */}
              <div className="space-y-2 rounded-xl bg-slate-50 p-3 border border-slate-200">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 font-medium">
                  <input
                    type="checkbox"
                    checked={pitchGuidance}
                    onChange={(e) => setPitchGuidance(e.target.checked)}
                    className="rounded accent-slate-900"
                  />
                  <span>Extract & Train Pitch Guidance (F0 = True for Singing/Speech)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 font-medium">
                  <input
                    type="checkbox"
                    checked={cleanAudio}
                    onChange={(e) => setCleanAudio(e.target.checked)}
                    className="rounded accent-slate-900"
                  />
                  <span>Auto-clean Noise & Silence (VAD slice filter)</span>
                </label>
              </div>

              {/* Submit CTA */}
              <button
                id="btn-start-training"
                type="submit"
                disabled={isStarting || (!selectedDataset && datasets.length === 0)}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-black active:scale-95 disabled:opacity-50 transition-all"
              >
                {isStarting ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Queuing Background Job...</span>
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 fill-current" />
                    <span>{selectedDataset ? 'Start RVC Background Training' : 'Select a Dataset Above to Start Training'}</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Right Pane: Live Training Monitor & Jobs */}
        <div className="lg:col-span-7 space-y-6">
          {/* Active Job Selector / Tabs */}
          {trainingJobs.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {trainingJobs.slice(0, 5).map((job) => (
                <button
                  key={job.id}
                  onClick={() => setActiveJobId(job.id)}
                  className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold whitespace-nowrap transition-all border ${
                    activeJobId === job.id
                      ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                      : 'border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full ${
                      job.status === 'completed'
                        ? 'bg-emerald-400'
                        : job.status === 'training' || job.status === 'preprocessing'
                        ? 'bg-blue-400 animate-pulse'
                        : job.status === 'failed' || job.status === 'cancelled'
                        ? 'bg-rose-500'
                        : 'bg-amber-400'
                    }`}
                  />
                  <span>{job.modelName}</span>
                  <span className={`font-mono text-[10px] ${activeJobId === job.id ? 'text-slate-300' : 'text-slate-400'}`}>
                    ({job.progressPercent}%)
                  </span>
                </button>
              ))}
            </div>
          )}

          {currentJob ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
              {/* Job Status Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-slate-900 tracking-tight">{currentJob.modelName}</h3>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${
                        currentJob.status === 'completed'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : currentJob.status === 'training' || currentJob.status === 'preprocessing' || currentJob.status === 'index_building'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200 animate-pulse'
                          : currentJob.status === 'failed' || currentJob.status === 'cancelled'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      {currentJob.status.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{currentJob.currentStep}</p>
                </div>

                <div className="flex items-center gap-3">
                  {currentJob.status === 'training' || currentJob.status === 'preprocessing' || currentJob.status === 'queued' ? (
                    <button
                      id={`btn-cancel-job-${currentJob.id}`}
                      onClick={() => onCancelTraining(currentJob.id)}
                      className="flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition-all"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      <span>Cancel Job</span>
                    </button>
                  ) : null}

                  {currentJob.status === 'completed' && currentJob.resultModelId && (
                    <button
                      id={`btn-use-model-${currentJob.resultModelId}`}
                      onClick={() => onUseModelForInference(currentJob.resultModelId!)}
                      className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-black transition-all"
                    >
                      <span>Use in Voice Converter</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Progress & Metrics Bar */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-medium">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-700">
                      Epoch {currentJob.currentEpoch} of {currentJob.totalEpochs}
                    </span>
                    <span className="text-slate-300">•</span>
                    <span className="font-mono text-slate-900 font-bold">{currentJob.progressPercent}%</span>
                  </div>
                  {currentJob.etaSeconds > 0 && (
                    <div className="flex items-center gap-1.5 text-slate-500">
                      <Clock className="h-3.5 w-3.5 text-slate-400" />
                      <span>ETA: ~{currentJob.etaSeconds}s</span>
                    </div>
                  )}
                </div>

                <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100 border border-slate-200">
                  <div
                    className={`h-full transition-all duration-300 ${
                      currentJob.status === 'completed'
                        ? 'bg-emerald-500'
                        : currentJob.status === 'failed' || currentJob.status === 'cancelled'
                        ? 'bg-rose-500'
                        : 'bg-slate-900'
                    }`}
                    style={{ width: `${currentJob.progressPercent}%` }}
                  />
                </div>
              </div>

              {/* Real-time Loss Curve Visualization */}
              {currentJob.lossHistory.length > 0 && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between mb-3 text-xs">
                    <div className="flex items-center gap-2">
                      <Activity className="h-4 w-4 text-slate-700" />
                      <span className="font-semibold text-slate-900">Loss Convergence Curve</span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] font-medium">
                      <span className="flex items-center gap-1 text-slate-700">
                        <span className="h-2 w-2 rounded-full bg-slate-900 inline-block"></span> Mel Loss
                      </span>
                      <span className="flex items-center gap-1 text-blue-600">
                        <span className="h-2 w-2 rounded-full bg-blue-600 inline-block"></span> Generator
                      </span>
                    </div>
                  </div>

                  {/* SVG Line Chart */}
                  <div className="h-32 w-full">
                    <svg className="h-full w-full overflow-visible" viewBox="0 0 500 100" preserveAspectRatio="none">
                      {/* Grid lines */}
                      <line x1="0" y1="20" x2="500" y2="20" stroke="#e2e8f0" strokeDasharray="3,3" />
                      <line x1="0" y1="50" x2="500" y2="50" stroke="#e2e8f0" strokeDasharray="3,3" />
                      <line x1="0" y1="80" x2="500" y2="80" stroke="#e2e8f0" strokeDasharray="3,3" />

                      {/* Mel Loss Line */}
                      <polyline
                        fill="none"
                        stroke="#0f172a"
                        strokeWidth="2.5"
                        points={currentJob.lossHistory
                          .map((pt, i, arr) => {
                            const x = (i / Math.max(1, arr.length - 1)) * 500;
                            // Mel loss normal range: 0.02 - 0.45
                            const y = 90 - (1 - Math.min(1, pt.melLoss / 0.45)) * 80;
                            return `${x},${y}`;
                          })
                          .join(' ')}
                      />

                      {/* Generator Loss Line */}
                      <polyline
                        fill="none"
                        stroke="#2563eb"
                        strokeWidth="1.5"
                        strokeOpacity="0.8"
                        points={currentJob.lossHistory
                          .map((pt, i, arr) => {
                            const x = (i / Math.max(1, arr.length - 1)) * 500;
                            const y = 90 - (1 - Math.min(1, pt.generatorLoss / 3.0)) * 75;
                            return `${x},${y}`;
                          })
                          .join(' ')}
                      />
                    </svg>
                  </div>
                </div>
              )}

              {/* Streaming Terminal Log Console */}
              <div className="rounded-xl border border-slate-800 bg-slate-950 overflow-hidden">
                <div className="flex items-center justify-between border-b border-slate-800 px-4 py-2 bg-slate-900 text-xs">
                  <div className="flex items-center gap-2 text-slate-300">
                    <Terminal className="h-3.5 w-3.5 text-slate-400" />
                    <span className="font-mono font-medium text-slate-200">Training Console Output</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {currentJob.logs.length} Lines
                  </span>
                </div>

                <div
                  ref={logsContainerRef}
                  className="h-44 overflow-y-auto p-3 font-mono text-[11px] leading-relaxed space-y-1 text-slate-300"
                >
                  {currentJob.logs.map((log, index) => {
                    const isError = log.includes('[Error]') || log.includes('failed');
                    const isSuccess = log.includes('[Success]') || log.includes('trained');
                    const isStep = log.includes('Preprocess') || log.includes('Features') || log.includes('Index');

                    return (
                      <div
                        key={index}
                        className={`${
                          isError
                            ? 'text-rose-400'
                            : isSuccess
                            ? 'text-emerald-400 font-semibold'
                            : isStep
                            ? 'text-blue-300 font-medium'
                            : 'text-slate-400'
                        }`}
                      >
                        {log}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-500 shadow-sm">
              <Cpu className="mx-auto h-10 w-10 text-slate-400 mb-3" />
              <h4 className="text-base font-semibold text-slate-800">No Active Training Jobs</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Configure your model hyperparameters on the left and click "Start RVC Background Training" to begin.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
