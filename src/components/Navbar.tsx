import React from 'react';
import { Mic, Cpu, Wand2, Layers, Terminal, Bell, Volume2, Sparkles } from 'lucide-react';
import { SystemGpuInfo, TrainingJob } from '../types';

interface NavbarProps {
  activeTab: 'dataset' | 'train' | 'convert' | 'models' | 'colab';
  setActiveTab: (tab: 'dataset' | 'train' | 'convert' | 'models' | 'colab') => void;
  gpuInfo: SystemGpuInfo | null;
  activeTrainingCount: number;
  notificationsEnabled: boolean;
  onToggleNotifications: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  gpuInfo,
  activeTrainingCount,
  notificationsEnabled,
  onToggleNotifications,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        {/* Brand Logo & Name */}
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-black text-white shadow-sm">
            <Volume2 className="h-4.5 w-4.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold tracking-tight text-slate-900">Vocal.ai</span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700 border border-slate-200">
                RVC v2.2
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">Retrieval-based Voice Conversion Pipeline</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1 rounded-xl bg-slate-100 p-1 border border-slate-200/60">
          <button
            id="nav-tab-dataset"
            onClick={() => setActiveTab('dataset')}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all ${
              activeTab === 'dataset'
                ? 'bg-white text-slate-900 font-semibold shadow-sm'
                : 'text-slate-500 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <Mic className="h-3.5 w-3.5" />
            <span>1. Datasets</span>
          </button>

          <button
            id="nav-tab-train"
            onClick={() => setActiveTab('train')}
            className={`relative flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all ${
              activeTab === 'train'
                ? 'bg-white text-slate-900 font-semibold shadow-sm'
                : 'text-slate-500 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <Cpu className="h-3.5 w-3.5" />
            <span>2. Train Model</span>
            {activeTrainingCount > 0 && (
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-600"></span>
              </span>
            )}
          </button>

          <button
            id="nav-tab-convert"
            onClick={() => setActiveTab('convert')}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all ${
              activeTab === 'convert'
                ? 'bg-white text-slate-900 font-semibold shadow-sm'
                : 'text-slate-500 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <Wand2 className="h-3.5 w-3.5" />
            <span>3. Inference Lab</span>
          </button>

          <button
            id="nav-tab-models"
            onClick={() => setActiveTab('models')}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all ${
              activeTab === 'models'
                ? 'bg-white text-slate-900 font-semibold shadow-sm'
                : 'text-slate-500 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            <span>My Models</span>
          </button>

          <button
            id="nav-tab-colab"
            onClick={() => setActiveTab('colab')}
            className={`hidden md:flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
              activeTab === 'colab'
                ? 'bg-white text-slate-900 font-semibold shadow-sm'
                : 'text-slate-500 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <Terminal className="h-3.5 w-3.5 text-slate-600" />
            <span>GPU Runner</span>
          </button>
        </nav>

        {/* Right Stats & Controls */}
        <div className="flex items-center gap-3">
          {/* GPU Status Pill */}
          <div className="hidden lg:flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1 text-xs">
            <div className="h-2 w-2 rounded-full bg-emerald-500"></div>
            <span className="text-slate-400">GPU:</span>
            <span className="font-semibold text-slate-700">
              {gpuInfo ? `${gpuInfo.vramUsedGb}/${gpuInfo.vramTotalGb} GB VRAM` : 'CUDA Ready'}
            </span>
          </div>

          {/* Browser Notification Toggle */}
          <button
            id="btn-toggle-notifications"
            onClick={onToggleNotifications}
            title={notificationsEnabled ? 'Training alerts enabled' : 'Enable sound and desktop alerts'}
            className={`flex h-9 w-9 items-center justify-center rounded-lg border transition-all ${
              notificationsEnabled
                ? 'border-slate-300 bg-slate-900 text-white'
                : 'border-slate-200 bg-white text-slate-500 hover:text-slate-900 hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            <Bell className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
