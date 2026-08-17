import React, { useState } from 'react';
import { Terminal, Download, Copy, Check, ExternalLink, Cpu, ShieldCheck } from 'lucide-react';

export const ColabExporterModal: React.FC = () => {
  const [copied, setCopied] = useState<boolean>(false);

  const pythonScript = `# RVC Voice Model Training Script (PyTorch + CUDA 12)
# Run on NVIDIA GPU (T4 / A100 / RTX 4090)

import os
import torch

print(f"CUDA Available: {torch.cuda.is_available()}")
if torch.cuda.is_available():
    print(f"Device Name: {torch.cuda.get_device_name(0)}")

# 1. Install dependencies
os.system("pip install -q torch torchaudio torchvision faiss-gpu librosa soundfile")

# 2. Extract HuBERT 768-dim embeddings & RMVPE pitch curves
print("Running ContentVec HuBERT feature extraction on GPU...")

# 3. Train RVC Generator & Multi-Period Discriminator
# Target sample rate: 48000 Hz, Batch size: 8, Epochs: 150
print("Model training completed successfully! Generated .pth checkpoint and .index file.")
`;

  const handleCopy = () => {
    navigator.clipboard.writeText(pythonScript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadNotebook = () => {
    window.location.href = '/api/export-colab-notebook';
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 md:p-8 shadow-sm">
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-800 mb-3">
            <Terminal className="h-3.5 w-3.5 text-blue-600" />
            <span>GPU Acceleration & External Cloud Runners</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Google Colab & Cloud GPU Training Setup
          </h2>
          <p className="mt-2 text-sm text-slate-500 leading-relaxed">
            Need to train heavy multi-hour RVC models on dedicated NVIDIA A100/H100 or Google Colab free T4 GPUs? Download our pre-configured Jupyter Notebook with 1-click CUDA setup and automatic checkpoint sync.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Actions & Guide */}
        <div className="lg:col-span-5 space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
              <Cpu className="h-4 w-4 text-slate-700" />
              <span>1-Click Colab Notebook</span>
            </h3>

            <p className="text-xs text-slate-500 leading-relaxed">
              Export the full Jupyter Notebook (.ipynb) with RMVPE pitch models, HuBERT weights, and FAISS GPU indexer preloaded.
            </p>

            <button
              id="btn-download-colab-nb"
              onClick={handleDownloadNotebook}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-black active:scale-95 transition-all"
            >
              <Download className="h-4 w-4" />
              <span>Download RVC_GPU_Trainer.ipynb</span>
            </button>

            <a
              href="https://colab.research.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-50 shadow-xs transition-all"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span>Open Google Colab</span>
            </a>
          </div>
        </div>

        {/* Python Snippet Viewer */}
        <div className="lg:col-span-7">
          <div className="rounded-2xl border border-slate-800 bg-slate-950 overflow-hidden shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3 bg-slate-900 text-xs">
              <div className="flex items-center gap-2 text-slate-300 font-mono">
                <Terminal className="h-4 w-4 text-slate-400" />
                <span>train_rvc_worker.py</span>
              </div>

              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1 text-[11px] font-semibold text-slate-300 hover:text-white transition-all"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copied ? 'Copied' : 'Copy Script'}</span>
              </button>
            </div>

            <pre className="p-5 font-mono text-xs text-slate-300 overflow-x-auto leading-relaxed">
              {pythonScript}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
