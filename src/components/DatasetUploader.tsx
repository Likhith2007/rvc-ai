import React, { useState, useRef } from 'react';
import { UploadCloud, FileAudio, Trash2, Plus, CheckCircle, AlertTriangle, ArrowRight, Play, Pause, Sparkles, Sliders } from 'lucide-react';
import { AudioRecorder } from './AudioRecorder';
import { AudioDataset } from '../types';
import { formatDuration, formatBytes } from '../utils/audioHelpers';

interface DatasetUploaderProps {
  datasets: AudioDataset[];
  onDatasetCreated: (dataset: AudioDataset) => void;
  onProceedToTraining: (dataset: AudioDataset) => void;
  onDeleteDataset: (id: string) => void;
}

export const DatasetUploader: React.FC<DatasetUploaderProps> = ({
  datasets,
  onDatasetCreated,
  onProceedToTraining,
  onDeleteDataset,
}) => {
  const [activeMode, setActiveMode] = useState<'upload' | 'record'>('upload');
  const [speakerName, setSpeakerName] = useState('');
  const [datasetName, setDatasetName] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [playingFileIndex, setPlayingFileIndex] = useState<number | null>(null);
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Handle files selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const filesArray = Array.from(e.target.files);
      setSelectedFiles((prev) => [...prev, ...filesArray]);
      if (!speakerName) {
        setSpeakerName('My Voice');
      }
    }
  };

  const handleLoadDemoDatasetFiles = async () => {
    setIsUploading(true);
    setUploadError(null);
    try {
      const res = await fetch('/api/generate-sample-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'singing', duration: 180 }),
      });
      const data = await res.json();
      const audioRes = await fetch(data.url);
      const blob = await audioRes.blob();
      const file = new File([blob], 'demo_studio_vocals_master.wav', { type: 'audio/wav' });
      setSelectedFiles((prev) => [...prev, file]);
      if (!speakerName) setSpeakerName('Demo Vocalist');
      if (!datasetName) setDatasetName('Demo Vocal Studio Take');
    } catch (err: any) {
      console.error('Failed to load sample audio:', err);
      setUploadError('Failed to generate sample vocal track');
    } finally {
      setIsUploading(false);
    }
  };

  // Drag & drop
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const filesArray = Array.from(e.dataTransfer.files).filter((f: File) =>
        f.type.startsWith('audio/') || f.name.match(/\.(wav|mp3|m4a|flac|ogg)$/i)
      );
      if (filesArray.length > 0) {
        setSelectedFiles((prev) => [...prev, ...filesArray]);
        if (!speakerName) {
          setSpeakerName('My Voice');
        }
      }
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    if (playingFileIndex === index) {
      if (audioPreviewRef.current) audioPreviewRef.current.pause();
      setPlayingFileIndex(null);
    }
  };

  // Upload Selected Files
  const handleUploadFiles = async () => {
    if (selectedFiles.length === 0) return;
    setIsUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append('speakerName', speakerName.trim() || 'My Voice');
      formData.append('datasetName', datasetName.trim() || `${speakerName.trim() || 'Voice'} Dataset`);

      selectedFiles.forEach((file) => {
        formData.append('audioFiles', file);
      });

      const res = await fetch('/api/dataset/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Upload failed');
      }

      const createdDataset: AudioDataset = await res.json();
      onDatasetCreated(createdDataset);
      setSelectedFiles([]);
      setSpeakerName('');
      setDatasetName('');
    } catch (err: any) {
      console.error(err);
      setUploadError(err.message || 'Failed to upload dataset');
    } finally {
      setIsUploading(false);
    }
  };

  // Handle direct microphone recording
  const handleRecordingComplete = async (blob: Blob, durationSec: number) => {
    setIsUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      const finalSpeaker = speakerName.trim() || 'Recorded Voice';
      formData.append('speakerName', finalSpeaker);
      formData.append('datasetName', datasetName.trim() || `${finalSpeaker} Dataset`);
      formData.append('audioRecording', blob, 'microphone_recording.wav');

      const res = await fetch('/api/dataset/record', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Upload recording failed');
      }

      const createdDataset: AudioDataset = await res.json();
      onDatasetCreated(createdDataset);
      setSpeakerName('');
      setDatasetName('');
    } catch (err: any) {
      console.error(err);
      setUploadError(err.message || 'Failed to save dataset from recording');
    } finally {
      setIsUploading(false);
    }
  };

  const toggleFilePreview = (index: number) => {
    if (playingFileIndex === index) {
      if (audioPreviewRef.current) audioPreviewRef.current.pause();
      setPlayingFileIndex(null);
    } else {
      const file = selectedFiles[index];
      const url = URL.createObjectURL(file);
      if (audioPreviewRef.current) {
        audioPreviewRef.current.src = url;
        audioPreviewRef.current.play();
        audioPreviewRef.current.onended = () => setPlayingFileIndex(null);
      }
      setPlayingFileIndex(index);
    }
  };

  const totalSize = selectedFiles.reduce((acc, f) => acc + f.size, 0);

  return (
    <div className="space-y-8">
      {/* Hidden audio element for preview */}
      <audio ref={audioPreviewRef} className="hidden" />

      {/* Top Banner Guide */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 md:p-8 shadow-sm">
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-800 mb-3">
            <Sparkles className="h-3.5 w-3.5 text-blue-600" />
            <span>Step 1: Dataset Acquisition (3–7 Minutes Recommended)</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Upload or Record Your Voice Dataset
          </h2>
          <p className="mt-2 text-sm text-slate-500 leading-relaxed">
            RVC (Retrieval-based Voice Conversion) v2 delivers top quality when trained on 3 to 7 minutes of clean, isolated vocal audio.
            Upload pre-recorded WAV/MP3 files or record directly in your browser. The backend will automatically denoise, normalize, and extract HuBERT latent features.
          </p>
        </div>
      </div>

      {/* Mode Selector */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-4">
        <button
          id="tab-upload-files"
          onClick={() => setActiveMode('upload')}
          className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all ${
            activeMode === 'upload'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'border border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <UploadCloud className="h-4 w-4" />
          <span>Upload Audio Files (WAV / MP3)</span>
        </button>

        <button
          id="tab-record-mic"
          onClick={() => setActiveMode('record')}
          className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all ${
            activeMode === 'record'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'border border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <FileAudio className="h-4 w-4" />
          <span>Live Microphone Recording</span>
        </button>
      </div>

      {/* Speaker and Dataset Info Inputs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Speaker Name <span className="text-rose-500">*</span>
          </label>
          <input
            id="input-speaker-name"
            type="text"
            placeholder="e.g. Alex Rivera, Singer Luna"
            value={speakerName}
            onChange={(e) => setSpeakerName(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 shadow-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Dataset Name (Optional)
          </label>
          <input
            id="input-dataset-name"
            type="text"
            placeholder="e.g. Alex Studio Vocals v1"
            value={datasetName}
            onChange={(e) => setDatasetName(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 shadow-sm"
          />
        </div>
      </div>

      {/* Main Intake Area */}
      {activeMode === 'upload' ? (
        <div className="space-y-4">
          {/* Dropzone */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className="group cursor-pointer relative overflow-hidden rounded-2xl border-2 border-dashed border-slate-300 bg-white p-8 text-center transition-all hover:border-slate-900 hover:bg-slate-50/50 shadow-sm"
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="audio/*,.wav,.mp3,.m4a,.flac,.ogg"
              onChange={handleFileChange}
              className="hidden"
            />
            <div className="flex flex-col items-center justify-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 border border-slate-200 group-hover:scale-105 transition-transform">
                <UploadCloud className="h-7 w-7" />
              </div>
              <div>
                <p className="text-base font-semibold text-slate-900">
                  Click to browse or drag & drop vocal audio clips
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Supports WAV, MP3, FLAC, M4A, OGG • Upload single 3–7 min master track or multiple short takes
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">Don't have audio files ready?</span>
            <button
              type="button"
              onClick={handleLoadDemoDatasetFiles}
              disabled={isUploading}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 shadow-xs transition-all"
            >
              <Sparkles className="h-3.5 w-3.5 text-blue-600" />
              <span>Load 3-Minute Demo Studio Vocals</span>
            </button>
          </div>

          {/* Selected Files List */}
          {selectedFiles.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
                <div className="flex items-center gap-2">
                  <FileAudio className="h-4 w-4 text-slate-700" />
                  <span className="text-sm font-semibold text-slate-900">
                    Selected Files ({selectedFiles.length})
                  </span>
                </div>
                <span className="text-xs text-slate-500 font-medium">Total Size: {formatBytes(totalSize)}</span>
              </div>

              <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                {selectedFiles.map((file, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs text-slate-800"
                  >
                    <div className="flex items-center gap-3 truncate">
                      <button
                        onClick={() => toggleFilePreview(idx)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors shadow-xs"
                      >
                        {playingFileIndex === idx ? (
                          <Pause className="h-3.5 w-3.5" />
                        ) : (
                          <Play className="h-3.5 w-3.5 fill-current" />
                        )}
                      </button>
                      <span className="truncate font-medium">{file.name}</span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-slate-500">{formatBytes(file.size)}</span>
                      <button
                        onClick={() => removeFile(idx)}
                        className="text-slate-400 hover:text-rose-600 transition-colors p-1"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Upload Button */}
              <div className="mt-4 flex justify-end">
                <button
                  id="btn-upload-dataset-confirm"
                  disabled={isUploading}
                  onClick={handleUploadFiles}
                  className="flex items-center gap-2 rounded-xl bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-black active:scale-95 disabled:opacity-50 transition-all"
                >
                  {isUploading ? (
                    <>
                      <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                      <span>Preprocessing Audio Dataset...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4" />
                      <span>Save & Process Dataset ({selectedFiles.length} files)</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <AudioRecorder onRecordingComplete={handleRecordingComplete} />
      )}

      {/* Upload Error Banner */}
      {uploadError && (
        <div className="flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-700">
          <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
          <span>{uploadError}</span>
        </div>
      )}

      {/* Available Saved Datasets List */}
      <div className="space-y-4 pt-4 border-t border-slate-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Saved Voice Datasets</h3>
            <p className="text-xs text-slate-500">Datasets ready for background RVC model training</p>
          </div>
          <span className="rounded-full bg-slate-100 border border-slate-200 px-2.5 py-0.5 text-xs text-slate-700 font-mono font-medium">
            {datasets.length} Total
          </span>
        </div>

        {datasets.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-sm">
            <p className="text-sm">No datasets created yet. Record or upload your voice audio above to begin.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {datasets.map((dataset) => {
              const isTargetReached = dataset.totalDurationSeconds >= 180;
              return (
                <div
                  key={dataset.id}
                  className="rounded-2xl border border-slate-200 bg-white p-5 hover:border-slate-300 transition-all flex flex-col justify-between shadow-sm"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h4 className="text-base font-bold text-slate-900 tracking-tight">{dataset.name}</h4>
                        <p className="text-xs text-slate-500 font-medium mt-0.5">Speaker: {dataset.speakerName}</p>
                      </div>
                      <button
                        onClick={() => onDeleteDataset(dataset.id)}
                        className="text-slate-400 hover:text-rose-600 transition-colors p-1"
                        title="Delete dataset"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-xl bg-slate-50 p-2 border border-slate-100">
                        <span className="block text-[10px] text-slate-400 uppercase font-medium">Duration</span>
                        <span className="text-xs font-mono font-bold text-slate-800">
                          {formatDuration(dataset.totalDurationSeconds)}
                        </span>
                      </div>

                      <div className="rounded-xl bg-slate-50 p-2 border border-slate-100">
                        <span className="block text-[10px] text-slate-400 uppercase font-medium">Audio Files</span>
                        <span className="text-xs font-mono font-bold text-slate-800">
                          {dataset.filesCount}
                        </span>
                      </div>

                      <div className="rounded-xl bg-slate-50 p-2 border border-slate-100">
                        <span className="block text-[10px] text-slate-400 uppercase font-medium">Status</span>
                        <span className={`text-[11px] font-semibold ${isTargetReached ? 'text-emerald-600' : 'text-amber-600'}`}>
                          {isTargetReached ? 'Optimal 3-7m' : 'Short Take'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 flex items-center justify-between pt-3 border-t border-slate-100">
                    <span className="text-[11px] text-slate-400">
                      Created {new Date(dataset.createdAt).toLocaleDateString()}
                    </span>

                    <button
                      id={`btn-train-${dataset.id}`}
                      onClick={() => onProceedToTraining(dataset)}
                      className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-black active:scale-95 transition-all"
                    >
                      <span>Train RVC Model</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
