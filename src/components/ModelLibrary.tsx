import React from 'react';
import { Layers, Download, Trash2, ArrowRight, Play, CheckCircle2, ShieldCheck, Sparkles, Volume2 } from 'lucide-react';
import { RvcModel } from '../types';
import { formatBytes } from '../utils/audioHelpers';

interface ModelLibraryProps {
  models: RvcModel[];
  onSelectModelForInference: (modelId: string) => void;
  onDeleteModel: (id: string) => void;
}

export const ModelLibrary: React.FC<ModelLibraryProps> = ({
  models,
  onSelectModelForInference,
  onDeleteModel,
}) => {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 md:p-8 shadow-sm">
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-800 mb-3">
            <Layers className="h-3.5 w-3.5 text-blue-600" />
            <span>RVC Model Checkpoints & Feature Indices</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Trained Voice Model Checkpoint Library
          </h2>
          <p className="mt-2 text-sm text-slate-500 leading-relaxed">
            Manage your persistent RVC model weights (`.pth`), FAISS feature retrieval indices (`.index`), and sample timbre audio previews. All models are instantly usable in the Voice Converter.
          </p>
        </div>
      </div>

      {/* Grid of Models */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {models.map((model) => (
          <div
            key={model.id}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col justify-between hover:border-slate-300 transition-all space-y-4"
          >
            <div>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`h-12 w-12 rounded-2xl bg-gradient-to-tr ${
                      model.avatarColor || 'from-slate-700 to-slate-900'
                    } flex items-center justify-center text-white font-bold text-base shadow-xs`}
                  >
                    {model.speakerName.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-base tracking-tight">{model.name}</h3>
                    <p className="text-xs text-slate-500 font-medium">{model.speakerName}</p>
                  </div>
                </div>

                {!model.id.startsWith('model_aria') && !model.id.startsWith('model_marcus') && (
                  <button
                    onClick={() => onDeleteModel(model.id)}
                    className="text-slate-400 hover:text-rose-500 transition-colors p-1"
                    title="Delete model"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>

              {model.description && (
                <p className="text-xs text-slate-500 mt-3 line-clamp-2 leading-relaxed">
                  {model.description}
                </p>
              )}

              {/* Specs Badge Grid */}
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-mono">
                <div className="rounded-xl bg-slate-50 p-2 border border-slate-200">
                  <span className="block text-[10px] text-slate-500 uppercase font-sans font-medium">Sample Rate</span>
                  <span className="font-bold text-slate-800">{model.targetSampleRate} Hz</span>
                </div>

                <div className="rounded-xl bg-slate-50 p-2 border border-slate-200">
                  <span className="block text-[10px] text-slate-500 uppercase font-sans font-medium">Epochs</span>
                  <span className="font-bold text-slate-800">{model.epochsTrained}</span>
                </div>

                <div className="rounded-xl bg-slate-50 p-2 border border-slate-200">
                  <span className="block text-[10px] text-slate-500 uppercase font-sans font-medium">Best Mel Loss</span>
                  <span className="font-bold text-slate-900">{model.bestMelLoss.toFixed(4)}</span>
                </div>

                <div className="rounded-xl bg-slate-50 p-2 border border-slate-200">
                  <span className="block text-[10px] text-slate-500 uppercase font-sans font-medium">Index Size</span>
                  <span className="font-bold text-slate-800">
                    {model.indexSizeBytes ? formatBytes(model.indexSizeBytes) : '12 MB'}
                  </span>
                </div>
              </div>
            </div>

            {/* Audio Preview if available */}
            {model.sampleAudioUrl && (
              <div className="rounded-xl bg-slate-50 p-2.5 border border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-slate-700 font-medium">
                  <Volume2 className="h-4 w-4 text-slate-600 shrink-0" />
                  <span className="text-[11px] truncate">Voice Sample Preview</span>
                </div>
                <audio controls src={model.sampleAudioUrl} className="h-7 w-36 scale-90" />
              </div>
            )}

            {/* Bottom Actions */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
              <span className="text-[10px] text-slate-400 font-medium">
                Created {new Date(model.createdAt).toLocaleDateString()}
              </span>

              <button
                id={`btn-use-model-${model.id}`}
                onClick={() => onSelectModelForInference(model.id)}
                className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-black active:scale-95 transition-all"
              >
                <span>Select for Conversion</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
