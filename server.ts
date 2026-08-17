import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import { storage } from './server/storage';
import { rvcEngine } from './server/rvcEngine';
import { extractAudioStats, generateSampleVoiceWav } from './server/audioProcessor';
import { AudioDataset, DatasetFile, TrainingConfig, ConversionConfig } from './src/types';

const app = express();
const server = http.createServer(app);
const PORT = 3000;

// Body parsers
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Multer memory storage for direct audio buffer handling
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB
  },
});

// WebSocket Server for live training updates & real-time logs
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws) => {
  const unregister = rvcEngine.registerBroadcaster((data) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  });

  ws.on('close', () => {
    unregister();
  });

  // Send initial GPU and status snapshot
  ws.send(
    JSON.stringify({
      type: 'INIT_STATE',
      gpuInfo: storage.getGpuInfo(),
      activeTrainingJobs: storage.getTrainingJobs().filter((j) => j.status === 'training' || j.status === 'preprocessing'),
    })
  );
});

// ----------------------------------------------------
// API ROUTES
// ----------------------------------------------------

// 1. Health check & GPU info
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.get('/api/system/gpu-info', (req, res) => {
  res.json(storage.getGpuInfo());
});

// 2. Audio File Serving
app.get('/api/audio/:fileId', (req, res) => {
  const fileId = path.basename(req.params.fileId);
  const filePath = path.join(storage.getAudioStoreDir(), fileId);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Audio file not found' });
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunksize = end - start + 1;
    const file = fs.createReadStream(filePath, { start, end });
    const head = {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': 'audio/wav',
    };
    res.writeHead(206, head);
    file.pipe(res);
  } else {
    const head = {
      'Content-Length': fileSize,
      'Content-Type': 'audio/wav',
      'Accept-Ranges': 'bytes',
    };
    res.writeHead(200, head);
    fs.createReadStream(filePath).pipe(res);
  }
});

// 3. Datasets API
app.get('/api/datasets', (req, res) => {
  res.json(storage.getDatasets());
});

app.get('/api/dataset/:id', (req, res) => {
  const dataset = storage.getDataset(req.params.id);
  if (!dataset) return res.status(404).json({ error: 'Dataset not found' });
  res.json(dataset);
});

app.delete('/api/dataset/:id', (req, res) => {
  const success = storage.deleteDataset(req.params.id);
  res.json({ success });
});

// Upload dataset files (multi-file or single file)
app.post('/api/dataset/upload', upload.array('audioFiles', 20), (req, res) => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No audio files uploaded' });
    }

    const speakerName = (req.body.speakerName || 'My Voice').trim();
    const datasetName = (req.body.datasetName || `${speakerName} Dataset`).trim();
    const datasetId = `dataset_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    let totalDuration = 0;
    const savedFiles: DatasetFile[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const stats = extractAudioStats(file.buffer);
      const safeName = `${datasetId}_file_${i}_${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const savePath = path.join(storage.getAudioStoreDir(), safeName);
      
      fs.writeFileSync(savePath, file.buffer);
      totalDuration += stats.duration;

      savedFiles.push({
        id: `df_${Date.now()}_${i}`,
        originalName: file.originalname,
        fileName: safeName,
        sizeBytes: file.size,
        durationSeconds: stats.duration,
        url: `/api/audio/${safeName}`,
        mimeType: file.mimetype || 'audio/wav',
      });
    }

    const newDataset: AudioDataset = {
      id: datasetId,
      name: datasetName,
      speakerName,
      totalDurationSeconds: Math.round(totalDuration * 10) / 10,
      filesCount: savedFiles.length,
      files: savedFiles,
      createdAt: new Date().toISOString(),
      isPreprocessed: false,
      sampleRate: 44100,
      segmentsCount: Math.max(8, Math.floor(totalDuration / 4)),
    };

    storage.saveDataset(newDataset);
    res.status(201).json(newDataset);
  } catch (err: any) {
    console.error('Dataset upload error:', err);
    res.status(500).json({ error: err.message || 'Failed to process dataset files' });
  }
});

// Direct mic recording upload
app.post('/api/dataset/record', upload.single('audioRecording'), (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No audio recording provided' });

    const speakerName = (req.body.speakerName || 'Microphone Voice').trim();
    const datasetName = (req.body.datasetName || `${speakerName} Recording`).trim();
    const datasetId = `dataset_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const stats = extractAudioStats(file.buffer);
    const safeName = `${datasetId}_recording.wav`;
    const savePath = path.join(storage.getAudioStoreDir(), safeName);
    fs.writeFileSync(savePath, file.buffer);

    const savedFile: DatasetFile = {
      id: `df_rec_${Date.now()}`,
      originalName: 'live_recording.wav',
      fileName: safeName,
      sizeBytes: file.size,
      durationSeconds: stats.duration,
      url: `/api/audio/${safeName}`,
      mimeType: 'audio/wav',
    };

    const newDataset: AudioDataset = {
      id: datasetId,
      name: datasetName,
      speakerName,
      totalDurationSeconds: stats.duration,
      filesCount: 1,
      files: [savedFile],
      createdAt: new Date().toISOString(),
      isPreprocessed: false,
      sampleRate: stats.sampleRate || 44100,
      segmentsCount: Math.max(6, Math.floor(stats.duration / 4)),
    };

    storage.saveDataset(newDataset);
    res.status(201).json(newDataset);
  } catch (err: any) {
    console.error('Record dataset error:', err);
    res.status(500).json({ error: err.message || 'Failed to save voice recording' });
  }
});

// 4. Training API
app.get('/api/training/jobs', (req, res) => {
  res.json(storage.getTrainingJobs());
});

app.get('/api/training/status/:jobId', (req, res) => {
  const job = storage.getTrainingJob(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Training job not found' });
  res.json(job);
});

app.get('/api/training/logs/:jobId', (req, res) => {
  const job = storage.getTrainingJob(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Training job not found' });
  res.json({ logs: job.logs, status: job.status, progress: job.progressPercent });
});

app.post('/api/training/start', (req, res) => {
  try {
    const config: TrainingConfig = req.body;
    if (!config.datasetId) {
      return res.status(400).json({ error: 'datasetId is required' });
    }
    const job = rvcEngine.queueTrainingJob(config);
    res.status(201).json(job);
  } catch (err: any) {
    console.error('Start training error:', err);
    res.status(400).json({ error: err.message || 'Failed to start training' });
  }
});

app.post('/api/training/cancel/:jobId', (req, res) => {
  const job = storage.getTrainingJob(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  
  if (job.status === 'queued' || job.status === 'training' || job.status === 'preprocessing') {
    job.status = 'cancelled';
    job.currentStep = 'Training cancelled by user';
    job.updatedAt = new Date().toISOString();
    storage.saveTrainingJob(job);
  }
  res.json(job);
});

// 5. Models API
app.get('/api/models', (req, res) => {
  res.json(storage.getModels());
});

app.get('/api/models/:id', (req, res) => {
  const model = storage.getModel(req.params.id);
  if (!model) return res.status(404).json({ error: 'Model not found' });
  res.json(model);
});

app.delete('/api/models/:id', (req, res) => {
  const success = storage.deleteModel(req.params.id);
  res.json({ success });
});

// 6. Voice Conversion (Inference) API
app.get('/api/conversions', (req, res) => {
  res.json(storage.getConversions());
});

app.get('/api/convert/status/:jobId', (req, res) => {
  const job = storage.getConversion(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Conversion job not found' });
  res.json(job);
});

app.post('/api/convert', upload.single('sourceAudio'), (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'sourceAudio file is required' });
    }

    const modelId = req.body.modelId;
    if (!modelId) {
      return res.status(400).json({ error: 'modelId is required' });
    }

    const config: ConversionConfig = {
      modelId,
      pitchShiftSemis: parseFloat(req.body.pitchShiftSemis || '0'),
      indexRatio: parseFloat(req.body.indexRatio || '0.75'),
      pitchAlgorithm: req.body.pitchAlgorithm || 'rmvpe',
      protectVoiceless: parseFloat(req.body.protectVoiceless || '0.33'),
      resampleRate: parseInt(req.body.resampleRate || '0', 10),
      volumeEnvelope: parseFloat(req.body.volumeEnvelope || '1.0'),
      cleanOutput: req.body.cleanOutput === 'true' || req.body.cleanOutput === true,
    };

    const job = rvcEngine.queueConversionJob(
      modelId,
      file.buffer,
      file.originalname || 'source_clip.wav',
      config
    );

    res.status(201).json(job);
  } catch (err: any) {
    console.error('Convert audio error:', err);
    res.status(400).json({ error: err.message || 'Failed to start conversion job' });
  }
});

// 7. Instant sample audio generator for testing conversion
app.post('/api/generate-sample-audio', (req, res) => {
  try {
    const type = req.body.type || 'speech'; // 'speech' or 'singing'
    const duration = parseFloat(req.body.duration || '5.0');
    const buffer = generateSampleVoiceWav('TestInput', type === 'speech' ? 'male' : 'female', duration, 44100);

    const safeName = `sample_test_input_${Date.now()}.wav`;
    const savePath = path.join(storage.getAudioStoreDir(), safeName);
    fs.writeFileSync(savePath, buffer);

    res.json({
      url: `/api/audio/${safeName}`,
      name: `Demo Input (${type.toUpperCase()}, ${duration}s)`,
      duration,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 8. Colab / GPU Training Notebook Exporter
app.get('/api/export-colab-notebook', (req, res) => {
  const notebookContent = {
    nbformat: 4,
    nbformat_minor: 0,
    metadata: {
      accelerator: 'GPU',
      colab: { provenance: [] },
      language_info: { name: 'python' },
    },
    cells: [
      {
        cell_type: 'markdown',
        metadata: {},
        source: [
          '# 🎙️ RVC Voice Model Trainer (Cloud GPU Runner)\n',
          'Trained with PyTorch, CUDA, HuBERT 768-dim embeddings, RMVPE Pitch Extraction, and FAISS index clustering.\n',
          'Seamlessly compatible with this Web RVC Studio.',
        ],
      },
      {
        cell_type: 'code',
        execution_count: null,
        metadata: {},
        outputs: [],
        source: [
          '# Check GPU accelerator\n',
          '!nvidia-smi\n',
          'import torch\n',
          'print(f"CUDA Available: {torch.cuda.is_available()}")\n',
          'if torch.cuda.is_available():\n',
          '    print(f"GPU Device: {torch.cuda.get_device_name(0)}")\n',
        ],
      },
      {
        cell_type: 'code',
        execution_count: null,
        metadata: {},
        outputs: [],
        source: [
          '# Clone RVC core repository and download pretrained HuBERT models\n',
          '!git clone https://github.com/RVC-Project/Retrieval-based-Voice-Conversion-WebUI.git\n',
          '%cd Retrieval-based-Voice-Conversion-WebUI\n',
          '!pip install -r requirements.txt\n',
          '!pip install faiss-gpu\n',
        ],
      },
      {
        cell_type: 'code',
        execution_count: null,
        metadata: {},
        outputs: [],
        source: [
          '# Download RMVPE and ContentVec HuBERT checkpoints\n',
          '!mkdir -p assets/hubert assets/rmvpe\n',
          '!wget -O assets/hubert/hubert_base.pt https://huggingface.co/lj1995/VoiceConversionWebUI/resolve/main/hubert_base.pt\n',
          '!wget -O assets/rmvpe/rmvpe.pt https://huggingface.co/lj1995/VoiceConversionWebUI/resolve/main/rmvpe.pt\n',
        ],
      },
      {
        cell_type: 'code',
        execution_count: null,
        metadata: {},
        outputs: [],
        source: [
          '# Launch WebUI or run command line training\n',
          '# python infer-web.py --port 7865 --share\n',
        ],
      },
    ],
  };

  res.setHeader('Content-Disposition', 'attachment; filename="RVC_GPU_Trainer.ipynb"');
  res.setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(notebookContent, null, 2));
});

// ----------------------------------------------------
// VITE / STATIC MIDDLEWARE
// ----------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`RVC Studio fullstack server running on http://localhost:${PORT}`);
  });
}

startServer();
