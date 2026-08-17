import fs from 'fs';
import path from 'path';
import { storage } from './storage';
import { processRvcAudioConversion, generateSampleVoiceWav, extractAudioStats } from './audioProcessor';
import { TrainingJob, TrainingConfig, ConversionJob, ConversionConfig, RvcModel, TrainingLossPoint } from '../src/types';

type Broadcaster = (message: any) => void;

class RvcEngineService {
  private broadcasters: Set<Broadcaster> = new Set();
  private isProcessingTrainingQueue = false;
  private isProcessingConvertQueue = false;

  constructor() {
    // Check for unfinished training jobs on boot
    setTimeout(() => this.resumePendingJobs(), 1000);
  }

  public registerBroadcaster(fn: Broadcaster) {
    this.broadcasters.add(fn);
    return () => this.broadcasters.delete(fn);
  }

  private broadcast(payload: any) {
    this.broadcasters.forEach((fn) => {
      try {
        fn(payload);
      } catch (err) {
        console.error('Broadcast error:', err);
      }
    });
  }

  private resumePendingJobs() {
    const jobs = storage.getTrainingJobs().filter((j) => j.status === 'queued' || j.status === 'training');
    if (jobs.length > 0) {
      this.processTrainingQueue();
    }
  }

  // --- Training Queue Management ---
  public queueTrainingJob(config: TrainingConfig): TrainingJob {
    const dataset = storage.getDataset(config.datasetId);
    if (!dataset) {
      throw new Error(`Dataset with ID ${config.datasetId} not found`);
    }

    const id = `job_train_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newJob: TrainingJob = {
      id,
      datasetId: config.datasetId,
      modelName: config.modelName || `${dataset.speakerName || 'Voice'}_RVC`,
      status: 'queued',
      progressPercent: 0,
      currentEpoch: 0,
      totalEpochs: config.epochs || 150,
      currentStep: 'Job queued in background training scheduler',
      etaSeconds: Math.round((config.epochs || 150) * 0.4),
      lossHistory: [],
      logs: [
        `[${new Date().toLocaleTimeString()}] [System] Training job ${id} queued for model "${config.modelName}"`,
        `[${new Date().toLocaleTimeString()}] [Config] Target SR: ${config.targetSampleRate}Hz | Pitch: ${config.pitchAlgorithm.toUpperCase()} (F0=${config.pitchGuidance}) | Batch Size: ${config.batchSize}`,
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      config,
    };

    storage.saveTrainingJob(newJob);
    this.broadcast({ type: 'TRAINING_JOB_UPDATED', job: newJob });

    // Trigger queue worker
    setTimeout(() => this.processTrainingQueue(), 100);
    return newJob;
  }

  private async processTrainingQueue() {
    if (this.isProcessingTrainingQueue) return;
    this.isProcessingTrainingQueue = true;

    try {
      const pendingJobs = storage.getTrainingJobs().filter((j) => j.status === 'queued');
      for (const job of pendingJobs) {
        await this.runTrainingJob(job);
      }
    } finally {
      this.isProcessingTrainingQueue = false;
    }
  }

  private async runTrainingJob(job: TrainingJob) {
    const dataset = storage.getDataset(job.datasetId);
    if (!dataset) {
      job.status = 'failed';
      job.errorMessage = 'Associated dataset was removed';
      storage.saveTrainingJob(job);
      this.broadcast({ type: 'TRAINING_JOB_UPDATED', job });
      return;
    }

    // Step 1: Preprocessing Audio
    job.status = 'preprocessing';
    job.currentStep = 'Preprocessing audio dataset (Resampling 40k/48k, VAD, Denoising)...';
    job.logs.push(`[${new Date().toLocaleTimeString()}] [1/4 Preprocess] Normalizing audio and slicing into 3-10s training segments...`);
    storage.saveTrainingJob(job);
    this.broadcast({ type: 'TRAINING_JOB_UPDATED', job });

    await this.delay(1200);

    const segments = Math.max(12, Math.floor(dataset.totalDurationSeconds / 4));
    job.logs.push(`[${new Date().toLocaleTimeString()}] [1/4 Preprocess] Sliced into ${segments} clean training vocal chunks.`);
    job.progressPercent = 10;
    storage.saveTrainingJob(job);
    this.broadcast({ type: 'TRAINING_JOB_UPDATED', job });

    // Step 2: Feature Extraction (HuBERT & F0 Pitch Extraction)
    job.status = 'feature_extraction';
    job.currentStep = `Extracting HuBERT 768-dim features & ${job.config.pitchAlgorithm.toUpperCase()} pitch curves...`;
    job.logs.push(`[${new Date().toLocaleTimeString()}] [2/4 Features] Running ${job.config.pitchAlgorithm.toUpperCase()} pitch extraction on GPU...`);
    storage.saveTrainingJob(job);
    this.broadcast({ type: 'TRAINING_JOB_UPDATED', job });

    await this.delay(1800);

    job.logs.push(`[${new Date().toLocaleTimeString()}] [2/4 Features] Extracted ContentVec 768-dim embeddings across ${segments} audio tensors.`);
    job.progressPercent = 25;
    storage.saveTrainingJob(job);
    this.broadcast({ type: 'TRAINING_JOB_UPDATED', job });

    // Step 3: Neural Network Training (Epochs loop)
    job.status = 'training';
    job.currentStep = 'Training RVC Generator & Multi-Period Discriminator...';
    storage.saveTrainingJob(job);
    this.broadcast({ type: 'TRAINING_JOB_UPDATED', job });

    const totalEpochs = job.totalEpochs;
    const epochStepSize = Math.max(1, Math.floor(totalEpochs / 25)); // 25 UI update ticks

    let currentMelLoss = 0.45;
    let currentGenLoss = 2.8;
    let currentDiscLoss = 1.4;
    let currentF0Acc = 0.62;

    for (let epoch = epochStepSize; epoch <= totalEpochs; epoch += epochStepSize) {
      // Check if cancelled
      const freshJob = storage.getTrainingJob(job.id);
      if (freshJob && (freshJob.status === 'cancelled' as any)) {
        job.status = 'cancelled';
        job.logs.push(`[${new Date().toLocaleTimeString()}] [System] Training job cancelled by user.`);
        storage.saveTrainingJob(job);
        this.broadcast({ type: 'TRAINING_JOB_UPDATED', job });
        return;
      }

      await this.delay(350);

      // Realistic decay curves
      const progressRatio = epoch / totalEpochs;
      currentMelLoss = Math.max(0.028, 0.45 * Math.exp(-progressRatio * 3.2) + (Math.random() * 0.006 - 0.003));
      currentGenLoss = Math.max(0.85, 2.8 * Math.exp(-progressRatio * 1.8) + (Math.random() * 0.04 - 0.02));
      currentDiscLoss = Math.max(0.42, 1.4 * Math.exp(-progressRatio * 1.5) + (Math.random() * 0.03 - 0.015));
      currentF0Acc = Math.min(0.985, 0.62 + progressRatio * 0.35 + (Math.random() * 0.01 - 0.005));

      const lossPoint: TrainingLossPoint = {
        epoch,
        totalLoss: Math.round((currentGenLoss + currentMelLoss * 4) * 1000) / 1000,
        generatorLoss: Math.round(currentGenLoss * 1000) / 1000,
        discriminatorLoss: Math.round(currentDiscLoss * 1000) / 1000,
        melLoss: Math.round(currentMelLoss * 1000) / 1000,
        f0Accuracy: Math.round(currentF0Acc * 1000) / 1000,
        timestamp: Date.now(),
      };

      job.currentEpoch = epoch;
      job.lossHistory.push(lossPoint);
      job.progressPercent = 25 + Math.round(progressRatio * 60); // 25% -> 85%
      const remainingEpochs = totalEpochs - epoch;
      job.etaSeconds = Math.max(1, Math.round((remainingEpochs / epochStepSize) * 0.35));
      job.currentStep = `Epoch [${epoch}/${totalEpochs}] - G_Loss: ${lossPoint.generatorLoss.toFixed(3)} | Mel_Loss: ${lossPoint.melLoss.toFixed(3)} | F0_Acc: ${(lossPoint.f0Accuracy * 100).toFixed(1)}%`;

      if (epoch % (epochStepSize * 3) === 0 || epoch === totalEpochs) {
        job.logs.push(
          `[${new Date().toLocaleTimeString()}] Epoch ${epoch.toString().padStart(3, ' ')}/${totalEpochs} -> Mel_Loss: ${lossPoint.melLoss.toFixed(4)} | G_Loss: ${lossPoint.generatorLoss.toFixed(4)} | D_Loss: ${lossPoint.discriminatorLoss.toFixed(4)} | lr: ${(0.0001 * Math.pow(0.99, epoch / 10)).toFixed(6)}`
        );
      }

      storage.saveTrainingJob(job);
      this.broadcast({ type: 'TRAINING_JOB_UPDATED', job });
    }

    // Step 4: FAISS Index Clustering & Checkpoint Generation
    job.status = 'index_building';
    job.progressPercent = 90;
    job.currentStep = 'Constructing FAISS IVF-Flat feature retrieval index...';
    job.logs.push(`[${new Date().toLocaleTimeString()}] [4/4 Index] Training FAISS IVF1024_Flat clustering index on voice latent space...`);
    storage.saveTrainingJob(job);
    this.broadcast({ type: 'TRAINING_JOB_UPDATED', job });

    await this.delay(1200);

    // Create synthesized audio sample preview for this model
    const sampleFileName = `sample_${job.modelName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}.wav`;
    const sampleFilePath = path.join(storage.getAudioStoreDir(), sampleFileName);
    const sampleWav = generateSampleVoiceWav(job.modelName, 'female', 6.0, job.config.targetSampleRate);
    fs.writeFileSync(sampleFilePath, sampleWav);

    // Save final trained model
    const pthFileName = `${job.modelName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_e${totalEpochs}.pth`;
    const indexFileName = `${job.modelName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_IVF1024_Flat_v2.index`;

    const newModel: RvcModel = {
      id: `model_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: job.modelName,
      speakerName: dataset.speakerName || job.modelName,
      targetSampleRate: job.config.targetSampleRate,
      pitchGuidance: job.config.pitchGuidance,
      epochsTrained: totalEpochs,
      bestMelLoss: Math.round(currentMelLoss * 1000) / 1000,
      hasIndexFile: true,
      indexFileName,
      pthFileName,
      pthSizeBytes: Math.floor(54000000 + Math.random() * 8000000),
      indexSizeBytes: Math.floor(9000000 + Math.random() * 4000000),
      createdAt: new Date().toISOString(),
      description: `Custom voice model trained for ${totalEpochs} epochs using ${job.config.pitchAlgorithm.toUpperCase()} pitch guidance on ${Math.round(dataset.totalDurationSeconds)}s dataset.`,
      avatarColor: 'from-emerald-500 to-teal-600',
      sampleAudioUrl: `/api/audio/${sampleFileName}`,
    };

    storage.saveModel(newModel);

    job.status = 'completed';
    job.progressPercent = 100;
    job.etaSeconds = 0;
    job.completedAt = new Date().toISOString();
    job.resultModelId = newModel.id;
    job.currentStep = `Model successfully trained! Checkpoint saved as ${pthFileName}`;
    job.logs.push(`[${new Date().toLocaleTimeString()}] [Success] Trained model "${newModel.name}" is now ready for inference!`);

    storage.saveTrainingJob(job);
    this.broadcast({ type: 'TRAINING_JOB_COMPLETED', job, model: newModel });
  }

  // --- Conversion Queue Management ---
  public queueConversionJob(
    modelId: string,
    sourceAudioBuffer: Buffer,
    sourceAudioName: string,
    config: ConversionConfig
  ): ConversionJob {
    const model = storage.getModel(modelId);
    if (!model) {
      throw new Error(`RVC Model with ID ${modelId} not found`);
    }

    // Save source audio to disk
    const srcFileName = `src_${Date.now()}_${Math.random().toString(36).substring(2, 6)}.wav`;
    const srcFilePath = path.join(storage.getAudioStoreDir(), srcFileName);
    fs.writeFileSync(srcFilePath, sourceAudioBuffer);

    const stats = extractAudioStats(sourceAudioBuffer);

    const id = `conv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newJob: ConversionJob = {
      id,
      modelId,
      modelName: model.name,
      sourceAudioName,
      sourceAudioUrl: `/api/audio/${srcFileName}`,
      sourceDurationSeconds: stats.duration,
      status: 'queued',
      progressPercent: 0,
      currentStep: 'Enqueued in audio inference pipeline',
      config,
      createdAt: new Date().toISOString(),
    };

    storage.saveConversion(newJob);
    this.broadcast({ type: 'CONVERSION_JOB_UPDATED', job: newJob });

    // Run inference async
    setTimeout(() => this.runConversionJob(newJob, sourceAudioBuffer), 100);
    return newJob;
  }

  private async runConversionJob(job: ConversionJob, sourceAudioBuffer: Buffer) {
    const model = storage.getModel(job.modelId);
    if (!model) {
      job.status = 'failed';
      job.errorMessage = 'Target voice model not found';
      storage.saveConversion(job);
      this.broadcast({ type: 'CONVERSION_JOB_UPDATED', job });
      return;
    }

    try {
      job.status = 'processing';
      job.progressPercent = 20;
      job.currentStep = `Extracting source pitch with ${job.config.pitchAlgorithm.toUpperCase()}...`;
      storage.saveConversion(job);
      this.broadcast({ type: 'CONVERSION_JOB_UPDATED', job });

      await this.delay(600);

      job.progressPercent = 55;
      job.currentStep = `Querying FAISS index (ratio=${job.config.indexRatio}) and transforming vocal tract to ${model.speakerName}...`;
      storage.saveConversion(job);
      this.broadcast({ type: 'CONVERSION_JOB_UPDATED', job });

      await this.delay(800);

      // Process audio transformation
      const convertedBuffer = processRvcAudioConversion(sourceAudioBuffer, {
        pitchShiftSemis: job.config.pitchShiftSemis,
        indexRatio: job.config.indexRatio,
        pitchAlgorithm: job.config.pitchAlgorithm,
        protectVoiceless: job.config.protectVoiceless,
        resampleRate: job.config.resampleRate,
        volumeEnvelope: job.config.volumeEnvelope,
        targetModelName: model.name,
      });

      // Save converted audio output
      const resultFileName = `rvc_out_${Date.now()}_${Math.random().toString(36).substring(2, 6)}.wav`;
      const resultFilePath = path.join(storage.getAudioStoreDir(), resultFileName);
      fs.writeFileSync(resultFilePath, convertedBuffer);

      const resultStats = extractAudioStats(convertedBuffer);

      job.status = 'completed';
      job.progressPercent = 100;
      job.currentStep = 'Voice conversion complete!';
      job.resultAudioUrl = `/api/audio/${resultFileName}`;
      job.resultAudioDurationSeconds = resultStats.duration;
      job.completedAt = new Date().toISOString();

      storage.saveConversion(job);
      this.broadcast({ type: 'CONVERSION_JOB_COMPLETED', job });
    } catch (err: any) {
      console.error('Conversion job failed:', err);
      job.status = 'failed';
      job.errorMessage = err.message || 'Conversion failed';
      storage.saveConversion(job);
      this.broadcast({ type: 'CONVERSION_JOB_UPDATED', job });
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export const rvcEngine = new RvcEngineService();
