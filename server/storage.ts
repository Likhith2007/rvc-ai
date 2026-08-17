import fs from 'fs';
import path from 'path';
import { AudioDataset, TrainingJob, RvcModel, ConversionJob, SystemGpuInfo } from '../src/types';
import { generateSampleVoiceWav } from './audioProcessor';

const DATA_DIR = path.join(process.cwd(), 'data');
const DATASETS_DIR = path.join(DATA_DIR, 'datasets');
const MODELS_DIR = path.join(DATA_DIR, 'models');
const OUTPUTS_DIR = path.join(DATA_DIR, 'outputs');
const AUDIO_STORE_DIR = path.join(DATA_DIR, 'audio_files');

// Ensure directories exist
[DATA_DIR, DATASETS_DIR, MODELS_DIR, OUTPUTS_DIR, AUDIO_STORE_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

const DATASETS_FILE = path.join(DATA_DIR, 'datasets.json');
const JOBS_FILE = path.join(DATA_DIR, 'training_jobs.json');
const MODELS_FILE = path.join(DATA_DIR, 'models.json');
const CONVERSIONS_FILE = path.join(DATA_DIR, 'conversions.json');

function loadJson<T>(filePath: string, fallback: T): T {
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content);
    }
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err);
  }
  return fallback;
}

function saveJson<T>(filePath: string, data: T): void {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error(`Error saving ${filePath}:`, err);
  }
}

export class StorageService {
  private datasets: Map<string, AudioDataset> = new Map();
  private trainingJobs: Map<string, TrainingJob> = new Map();
  private models: Map<string, RvcModel> = new Map();
  private conversions: Map<string, ConversionJob> = new Map();

  constructor() {
    this.init();
  }

  private init() {
    const rawDatasets = loadJson<AudioDataset[]>(DATASETS_FILE, []);
    rawDatasets.forEach((d) => this.datasets.set(d.id, d));

    const rawJobs = loadJson<TrainingJob[]>(JOBS_FILE, []);
    rawJobs.forEach((j) => this.trainingJobs.set(j.id, j));

    const rawModels = loadJson<RvcModel[]>(MODELS_FILE, []);
    rawModels.forEach((m) => this.models.set(m.id, m));

    const rawConversions = loadJson<ConversionJob[]>(CONVERSIONS_FILE, []);
    rawConversions.forEach((c) => this.conversions.set(c.id, c));

    // Seed default pre-trained voice models if empty
    if (this.models.size === 0) {
      this.seedDefaultModels();
    }

    // Seed default vocal datasets if empty
    if (this.datasets.size === 0) {
      this.seedDefaultDatasets();
    }
  }

  private seedDefaultDatasets() {
    const taylorAudioPath = path.join(AUDIO_STORE_DIR, 'sample_dataset_taylor.wav');
    if (!fs.existsSync(taylorAudioPath)) {
      const sampleWav = generateSampleVoiceWav('Taylor', 'female', 185.0, 44100);
      fs.writeFileSync(taylorAudioPath, sampleWav);
    }

    const elijahAudioPath = path.join(AUDIO_STORE_DIR, 'sample_dataset_elijah.wav');
    if (!fs.existsSync(elijahAudioPath)) {
      const sampleWav = generateSampleVoiceWav('Elijah', 'male', 210.0, 44100);
      fs.writeFileSync(elijahAudioPath, sampleWav);
    }

    const taylorDataset: AudioDataset = {
      id: 'dataset_taylor_studio_vocal',
      name: 'Taylor - Studio Acoustic Vocals',
      speakerName: 'Taylor Morgan',
      totalDurationSeconds: 185,
      filesCount: 4,
      files: [
        {
          id: 'df_taylor_1',
          originalName: 'taylor_take_01_melody.wav',
          fileName: 'sample_dataset_taylor.wav',
          sizeBytes: 16300000,
          durationSeconds: 185,
          url: '/api/audio/sample_dataset_taylor.wav',
          mimeType: 'audio/wav',
        }
      ],
      createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
      isPreprocessed: true,
      sampleRate: 44100,
      segmentsCount: 38,
    };

    const elijahDataset: AudioDataset = {
      id: 'dataset_elijah_podcast_voice',
      name: 'Elijah - Podcast & Narration Voice',
      speakerName: 'Elijah Vance',
      totalDurationSeconds: 210,
      filesCount: 3,
      files: [
        {
          id: 'df_elijah_1',
          originalName: 'elijah_narration_master.wav',
          fileName: 'sample_dataset_elijah.wav',
          sizeBytes: 18500000,
          durationSeconds: 210,
          url: '/api/audio/sample_dataset_elijah.wav',
          mimeType: 'audio/wav',
        }
      ],
      createdAt: new Date(Date.now() - 86400000 * 1).toISOString(),
      isPreprocessed: true,
      sampleRate: 44100,
      segmentsCount: 42,
    };

    this.datasets.set(taylorDataset.id, taylorDataset);
    this.datasets.set(elijahDataset.id, elijahDataset);
    saveJson(DATASETS_FILE, Array.from(this.datasets.values()));
  }

  private seedDefaultModels() {
    // 1. Aria - Studio Vocalist
    const ariaAudioPath = path.join(AUDIO_STORE_DIR, 'sample_aria.wav');
    if (!fs.existsSync(ariaAudioPath)) {
      const sampleWav = generateSampleVoiceWav('Aria', 'female', 6.0, 48000);
      fs.writeFileSync(ariaAudioPath, sampleWav);
    }

    const aria: RvcModel = {
      id: 'model_aria_v2',
      name: 'Aria - Studio Soprano',
      speakerName: 'Aria Vocalist',
      targetSampleRate: 48000,
      pitchGuidance: true,
      epochsTrained: 350,
      bestMelLoss: 0.042,
      hasIndexFile: true,
      indexFileName: 'aria_v2_added_IVF1024_Flat_nprobe_1_v2.index',
      pthFileName: 'aria_v2_e350_s14000.pth',
      pthSizeBytes: 58240000,
      indexSizeBytes: 12400000,
      createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
      description: 'High-clarity soprano singing and speaking voice with smooth vibrato and RMVPE pitch stability.',
      avatarColor: 'from-pink-500 to-rose-500',
      sampleAudioUrl: '/api/audio/sample_aria.wav',
    };

    // 2. Marcus - Warm Narrator & Baritone
    const marcusAudioPath = path.join(AUDIO_STORE_DIR, 'sample_marcus.wav');
    if (!fs.existsSync(marcusAudioPath)) {
      const sampleWav = generateSampleVoiceWav('Marcus', 'male', 6.0, 40000);
      fs.writeFileSync(marcusAudioPath, sampleWav);
    }

    const marcus: RvcModel = {
      id: 'model_marcus_v2',
      name: 'Marcus - Deep Narrator',
      speakerName: 'Marcus Baritone',
      targetSampleRate: 40000,
      pitchGuidance: true,
      epochsTrained: 400,
      bestMelLoss: 0.038,
      hasIndexFile: true,
      indexFileName: 'marcus_v2_added_IVF512_Flat_v2.index',
      pthFileName: 'marcus_baritone_e400.pth',
      pthSizeBytes: 56120000,
      indexSizeBytes: 10800000,
      createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
      description: 'Resonant, warm documentary narration and commercial voice trained on 15 minutes of pristine condenser mic audio.',
      avatarColor: 'from-amber-500 to-orange-600',
      sampleAudioUrl: '/api/audio/sample_marcus.wav',
    };

    // 3. Luna - Synth Pop & Cyber Voice
    const lunaAudioPath = path.join(AUDIO_STORE_DIR, 'sample_luna.wav');
    if (!fs.existsSync(lunaAudioPath)) {
      const sampleWav = generateSampleVoiceWav('Luna', 'female', 6.0, 48000);
      fs.writeFileSync(lunaAudioPath, sampleWav);
    }

    const luna: RvcModel = {
      id: 'model_luna_v2',
      name: 'Luna - Pop & Anime Voice',
      speakerName: 'Luna CyberPop',
      targetSampleRate: 48000,
      pitchGuidance: true,
      epochsTrained: 500,
      bestMelLoss: 0.031,
      hasIndexFile: true,
      indexFileName: 'luna_added_IVF2048_Flat_v2.index',
      pthFileName: 'luna_pop_e500_s22000.pth',
      pthSizeBytes: 61400000,
      indexSizeBytes: 15200000,
      createdAt: new Date(Date.now() - 86400000 * 1).toISOString(),
      description: 'Energetic, modern vocal style optimized for J-Pop, EDM vocal chops, and upbeat narration.',
      avatarColor: 'from-cyan-500 to-blue-600',
      sampleAudioUrl: '/api/audio/sample_luna.wav',
    };

    this.models.set(aria.id, aria);
    this.models.set(marcus.id, marcus);
    this.models.set(luna.id, luna);
    saveJson(MODELS_FILE, Array.from(this.models.values()));
  }

  // --- Datasets ---
  public getDatasets(): AudioDataset[] {
    return Array.from(this.datasets.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  public getDataset(id: string): AudioDataset | undefined {
    return this.datasets.get(id);
  }

  public saveDataset(dataset: AudioDataset): void {
    this.datasets.set(dataset.id, dataset);
    saveJson(DATASETS_FILE, Array.from(this.datasets.values()));
  }

  public deleteDataset(id: string): boolean {
    const deleted = this.datasets.delete(id);
    if (deleted) {
      saveJson(DATASETS_FILE, Array.from(this.datasets.values()));
    }
    return deleted;
  }

  // --- Training Jobs ---
  public getTrainingJobs(): TrainingJob[] {
    return Array.from(this.trainingJobs.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  public getTrainingJob(id: string): TrainingJob | undefined {
    return this.trainingJobs.get(id);
  }

  public saveTrainingJob(job: TrainingJob): void {
    this.trainingJobs.set(job.id, job);
    saveJson(JOBS_FILE, Array.from(this.trainingJobs.values()));
  }

  // --- Models ---
  public getModels(): RvcModel[] {
    return Array.from(this.models.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  public getModel(id: string): RvcModel | undefined {
    return this.models.get(id);
  }

  public saveModel(model: RvcModel): void {
    this.models.set(model.id, model);
    saveJson(MODELS_FILE, Array.from(this.models.values()));
  }

  public deleteModel(id: string): boolean {
    const deleted = this.models.delete(id);
    if (deleted) {
      saveJson(MODELS_FILE, Array.from(this.models.values()));
    }
    return deleted;
  }

  // --- Conversions ---
  public getConversions(): ConversionJob[] {
    return Array.from(this.conversions.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  public getConversion(id: string): ConversionJob | undefined {
    return this.conversions.get(id);
  }

  public saveConversion(job: ConversionJob): void {
    this.conversions.set(job.id, job);
    saveJson(CONVERSIONS_FILE, Array.from(this.conversions.values()));
  }

  // --- Audio Store Path ---
  public getAudioStoreDir(): string {
    return AUDIO_STORE_DIR;
  }

  public getGpuInfo(): SystemGpuInfo {
    const activeTraining = Array.from(this.trainingJobs.values()).filter(
      (j) => j.status === 'training' || j.status === 'preprocessing' || j.status === 'feature_extraction'
    ).length;

    return {
      gpuAvailable: true,
      deviceName: 'NVIDIA RTX 4090 / CUDA 12.2 Accelerator',
      vramTotalGb: 24.0,
      vramUsedGb: Math.round((4.2 + activeTraining * 3.6) * 10) / 10,
      cudaVersion: '12.2.1',
      torchVersion: '2.2.1+cu121',
      activeWorkers: activeTraining,
      queueLength: Array.from(this.trainingJobs.values()).filter((j) => j.status === 'queued').length,
    };
  }
}

export const storage = new StorageService();
