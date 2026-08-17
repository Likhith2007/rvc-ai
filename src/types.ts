export type PitchAlgorithm = 'rmvpe' | 'crepe' | 'harvest' | 'pm';
export type SampleRate = 40000 | 48000;
export type TrainingStatus = 'queued' | 'preprocessing' | 'feature_extraction' | 'training' | 'index_building' | 'completed' | 'failed' | 'cancelled';
export type ConvertStatus = 'queued' | 'processing' | 'completed' | 'failed';

export interface AudioDataset {
  id: string;
  name: string;
  speakerName: string;
  totalDurationSeconds: number; // e.g. 180 to 420 seconds (3-7 min)
  filesCount: number;
  files: DatasetFile[];
  createdAt: string;
  isPreprocessed: boolean;
  sampleRate: number;
  segmentsCount?: number;
}

export interface DatasetFile {
  id: string;
  originalName: string;
  fileName: string;
  sizeBytes: number;
  durationSeconds: number;
  url: string;
  mimeType: string;
}

export interface TrainingConfig {
  datasetId: string;
  modelName: string;
  targetSampleRate: SampleRate;
  pitchGuidance: boolean; // True: with F0, False: no-F0
  pitchAlgorithm: PitchAlgorithm;
  epochs: number; // 50 - 500
  batchSize: number; // 4 - 32
  saveFrequency: number; // Every N epochs
  useGpu: boolean;
  gpuDevice: string;
  hubertModel: string;
  cleanAudio: boolean; // Denoise + silence remove
}

export interface TrainingLossPoint {
  epoch: number;
  totalLoss: number;
  generatorLoss: number;
  discriminatorLoss: number;
  melLoss: number;
  f0Accuracy: number;
  timestamp: number;
}

export interface TrainingJob {
  id: string;
  datasetId: string;
  modelName: string;
  status: TrainingStatus;
  progressPercent: number;
  currentEpoch: number;
  totalEpochs: number;
  currentStep: string;
  etaSeconds: number;
  lossHistory: TrainingLossPoint[];
  logs: string[];
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  errorMessage?: string;
  config: TrainingConfig;
  resultModelId?: string;
}

export interface RvcModel {
  id: string;
  name: string;
  speakerName: string;
  targetSampleRate: SampleRate;
  pitchGuidance: boolean;
  epochsTrained: number;
  bestMelLoss: number;
  hasIndexFile: boolean;
  indexFileName?: string;
  pthFileName: string;
  pthSizeBytes: number;
  indexSizeBytes?: number;
  createdAt: string;
  description?: string;
  avatarColor?: string;
  sampleAudioUrl?: string;
}

export interface ConversionConfig {
  modelId: string;
  pitchShiftSemis: number; // -24 to +24
  indexRatio: number; // 0.0 to 1.0 (feature retrieval ratio)
  pitchAlgorithm: PitchAlgorithm;
  protectVoiceless: number; // 0.0 to 0.5
  resampleRate: number; // 0 (keep) or 40000 / 48000
  volumeEnvelope: number; // 0.0 to 1.0
  cleanOutput: boolean;
}

export interface ConversionJob {
  id: string;
  modelId: string;
  modelName: string;
  sourceAudioName: string;
  sourceAudioUrl: string;
  sourceDurationSeconds: number;
  status: ConvertStatus;
  progressPercent: number;
  currentStep: string;
  config: ConversionConfig;
  resultAudioUrl?: string;
  resultAudioDurationSeconds?: number;
  createdAt: string;
  completedAt?: string;
  errorMessage?: string;
}

export interface SystemGpuInfo {
  gpuAvailable: boolean;
  deviceName: string;
  vramTotalGb: number;
  vramUsedGb: number;
  cudaVersion: string;
  torchVersion: string;
  activeWorkers: number;
  queueLength: number;
}
