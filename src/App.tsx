import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Navbar } from './components/Navbar';
import { DatasetUploader } from './components/DatasetUploader';
import { TrainingStudio } from './components/TrainingStudio';
import { VoiceConverter } from './components/VoiceConverter';
import { ModelLibrary } from './components/ModelLibrary';
import { ColabExporterModal } from './components/ColabExporterModal';
import { AudioDataset, TrainingJob, RvcModel, ConversionJob, SystemGpuInfo, TrainingConfig, ConversionConfig } from './types';
import { playSuccessChime } from './utils/audioHelpers';

export default function App() {
  const [activeTab, setActiveTab] = useState<'dataset' | 'train' | 'convert' | 'models' | 'colab'>('dataset');
  const [datasets, setDatasets] = useState<AudioDataset[]>([]);
  const [models, setModels] = useState<RvcModel[]>([]);
  const [trainingJobs, setTrainingJobs] = useState<TrainingJob[]>([]);
  const [conversions, setConversions] = useState<ConversionJob[]>([]);
  const [gpuInfo, setGpuInfo] = useState<SystemGpuInfo | null>(null);

  const [selectedDataset, setSelectedDataset] = useState<AudioDataset | null>(null);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(true);
  const [toastMessage, setToastMessage] = useState<{ title: string; body: string } | null>(null);

  // 1. Initial Data Fetch
  const fetchData = async () => {
    try {
      const [dsRes, modelsRes, jobsRes, convsRes, gpuRes] = await Promise.all([
        fetch('/api/datasets'),
        fetch('/api/models'),
        fetch('/api/training/jobs'),
        fetch('/api/conversions'),
        fetch('/api/system/gpu-info'),
      ]);

      if (dsRes.ok) {
        const dsData = await dsRes.json();
        setDatasets(dsData);
        if (dsData.length > 0) {
          setSelectedDataset((prev) => prev || dsData[0]);
        }
      }
      if (modelsRes.ok) {
        const mData = await modelsRes.json();
        setModels(mData);
        if (mData.length > 0) {
          setSelectedModelId((prev) => prev || mData[0].id);
        }
      }
      if (jobsRes.ok) setTrainingJobs(await jobsRes.json());
      if (convsRes.ok) setConversions(await convsRes.json());
      if (gpuRes.ok) setGpuInfo(await gpuRes.json());
    } catch (err) {
      console.error('Initial data fetch error:', err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // 2. WebSocket live updates
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    let ws: WebSocket | null = null;
    let reconnectTimeout: any = null;

    const connectWs = () => {
      ws = new WebSocket(wsUrl);

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'TRAINING_JOB_UPDATED') {
            const updatedJob: TrainingJob = data.job;
            setTrainingJobs((prev) => {
              const idx = prev.findIndex((j) => j.id === updatedJob.id);
              if (idx >= 0) {
                const next = [...prev];
                next[idx] = updatedJob;
                return next;
              }
              return [updatedJob, ...prev];
            });
          } else if (data.type === 'TRAINING_JOB_COMPLETED') {
            const completedJob: TrainingJob = data.job;
            const newModel: RvcModel = data.model;

            setTrainingJobs((prev) => {
              const idx = prev.findIndex((j) => j.id === completedJob.id);
              if (idx >= 0) {
                const next = [...prev];
                next[idx] = completedJob;
                return next;
              }
              return [completedJob, ...prev];
            });

            if (newModel) {
              setModels((prev) => {
                if (prev.some((m) => m.id === newModel.id)) return prev;
                return [newModel, ...prev];
              });
              setSelectedModelId(newModel.id);
            }

            // Notification trigger & celebration
            playSuccessChime();
            confetti({
              particleCount: 80,
              spread: 70,
              origin: { y: 0.6 },
            });

            triggerNotification(
              `RVC Model "${completedJob.modelName}" Ready!`,
              `Trained for ${completedJob.totalEpochs} epochs. Click to open Voice Converter.`
            );
          } else if (data.type === 'CONVERSION_JOB_UPDATED' || data.type === 'CONVERSION_JOB_COMPLETED') {
            const convJob: ConversionJob = data.job;
            setConversions((prev) => {
              const idx = prev.findIndex((c) => c.id === convJob.id);
              if (idx >= 0) {
                const next = [...prev];
                next[idx] = convJob;
                return next;
              }
              return [convJob, ...prev];
            });

            if (data.type === 'CONVERSION_JOB_COMPLETED') {
              playSuccessChime();
              triggerNotification(
                'Voice Conversion Finished!',
                `Converted into "${convJob.modelName}". Ready for playback.`
              );
            }
          }
        } catch (e) {
          console.error('WS message parse error:', e);
        }
      };

      ws.onclose = () => {
        reconnectTimeout = setTimeout(connectWs, 3000);
      };
    };

    connectWs();

    return () => {
      if (ws) ws.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, [notificationsEnabled]);

  // Notifications handler
  const triggerNotification = (title: string, body: string) => {
    setToastMessage({ title, body });
    setTimeout(() => setToastMessage(null), 7000);

    if (notificationsEnabled && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, {
          body,
          icon: '/favicon.ico',
        });
      } catch (e) {
        console.warn('Native notification failed', e);
      }
    }
  };

  const handleToggleNotifications = async () => {
    if (!notificationsEnabled) {
      if ('Notification' in window && Notification.permission !== 'granted') {
        const perm = await Notification.requestPermission();
        if (perm === 'granted') {
          setNotificationsEnabled(true);
          triggerNotification('Notifications Enabled', 'You will receive alerts when RVC training completes.');
        }
      } else {
        setNotificationsEnabled(true);
        triggerNotification('Sound & UI Alerts Active', 'Chimes and banners will alert you when jobs complete.');
      }
    } else {
      setNotificationsEnabled(false);
    }
  };

  // Dataset Actions
  const handleDatasetCreated = (dataset: AudioDataset) => {
    setDatasets((prev) => [dataset, ...prev]);
    setSelectedDataset(dataset);
    triggerNotification('Dataset Saved', `Dataset "${dataset.name}" is ready for model training.`);
  };

  const handleProceedToTraining = (dataset: AudioDataset) => {
    setSelectedDataset(dataset);
    setActiveTab('train');
  };

  const handleDeleteDataset = async (id: string) => {
    try {
      await fetch(`/api/dataset/${id}`, { method: 'DELETE' });
      setDatasets((prev) => prev.filter((d) => d.id !== id));
      if (selectedDataset?.id === id) {
        setSelectedDataset(null);
      }
    } catch (err) {
      console.error('Failed to delete dataset:', err);
    }
  };

  // Training Actions
  const handleStartTraining = async (config: TrainingConfig) => {
    const res = await fetch('/api/training/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Training start failed');
    }

    const newJob: TrainingJob = await res.json();
    setTrainingJobs((prev) => [newJob, ...prev]);
    setActiveJobId(newJob.id);
    triggerNotification('Training Started', `Background job for "${config.modelName}" is now running.`);
  };

  const handleCancelTraining = async (jobId: string) => {
    try {
      const res = await fetch(`/api/training/cancel/${jobId}`, { method: 'POST' });
      if (res.ok) {
        const updated = await res.json();
        setTrainingJobs((prev) => prev.map((j) => (j.id === jobId ? updated : j)));
      }
    } catch (err) {
      console.error('Cancel job error:', err);
    }
  };

  const handleUseModelForInference = (modelId: string) => {
    setSelectedModelId(modelId);
    setActiveTab('convert');
  };

  // Conversion Actions
  const handleConvertAudio = async (modelId: string, file: File, config: ConversionConfig): Promise<ConversionJob> => {
    const formData = new FormData();
    formData.append('modelId', modelId);
    formData.append('sourceAudio', file);
    formData.append('pitchShiftSemis', config.pitchShiftSemis.toString());
    formData.append('indexRatio', config.indexRatio.toString());
    formData.append('pitchAlgorithm', config.pitchAlgorithm);
    formData.append('protectVoiceless', config.protectVoiceless.toString());
    formData.append('volumeEnvelope', config.volumeEnvelope.toString());
    formData.append('resampleRate', config.resampleRate.toString());
    formData.append('cleanOutput', config.cleanOutput ? 'true' : 'false');

    const res = await fetch('/api/convert', {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Conversion failed');
    }

    const createdJob: ConversionJob = await res.json();
    setConversions((prev) => [createdJob, ...prev]);
    return createdJob;
  };

  const handleDeleteModel = async (id: string) => {
    try {
      await fetch(`/api/models/${id}`, { method: 'DELETE' });
      setModels((prev) => prev.filter((m) => m.id !== id));
      if (selectedModelId === id) {
        setSelectedModelId(null);
      }
    } catch (err) {
      console.error('Failed to delete model:', err);
    }
  };

  const activeTrainingCount = trainingJobs.filter(
    (j) => j.status === 'training' || j.status === 'preprocessing' || j.status === 'queued'
  ).length;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 selection:bg-slate-900 selection:text-white font-sans">
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 max-w-sm rounded-2xl border border-slate-200 bg-white p-4 shadow-xl shadow-slate-900/10 backdrop-blur-md animate-in slide-in-from-bottom-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h5 className="font-semibold text-sm text-slate-900">{toastMessage.title}</h5>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{toastMessage.body}</p>
            </div>
            <button
              onClick={() => setToastMessage(null)}
              className="text-slate-400 hover:text-slate-700 text-xs font-mono p-1"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        gpuInfo={gpuInfo}
        activeTrainingCount={activeTrainingCount}
        notificationsEnabled={notificationsEnabled}
        onToggleNotifications={handleToggleNotifications}
      />

      {/* Main Content Body */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {activeTab === 'dataset' && (
          <DatasetUploader
            datasets={datasets}
            onDatasetCreated={handleDatasetCreated}
            onProceedToTraining={handleProceedToTraining}
            onDeleteDataset={handleDeleteDataset}
          />
        )}

        {activeTab === 'train' && (
          <TrainingStudio
            datasets={datasets}
            selectedDataset={selectedDataset}
            onSelectDataset={setSelectedDataset}
            trainingJobs={trainingJobs}
            onStartTraining={handleStartTraining}
            onCancelTraining={handleCancelTraining}
            onUseModelForInference={handleUseModelForInference}
            activeJobId={activeJobId}
            setActiveJobId={setActiveJobId}
          />
        )}

        {activeTab === 'convert' && (
          <VoiceConverter
            models={models}
            selectedModelId={selectedModelId}
            onSelectModelId={setSelectedModelId}
            onConvertAudio={handleConvertAudio}
            conversions={conversions}
          />
        )}

        {activeTab === 'models' && (
          <ModelLibrary
            models={models}
            onSelectModelForInference={handleUseModelForInference}
            onDeleteModel={handleDeleteModel}
          />
        )}

        {activeTab === 'colab' && <ColabExporterModal />}
      </main>
    </div>
  );
}
