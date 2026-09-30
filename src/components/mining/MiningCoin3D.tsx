import React from 'react';
import { Flame, CheckCircle, Zap } from 'lucide-react';

interface MiningCoin3DProps {
  isActive: boolean;
  isCompleted: boolean;
  onClick?: () => void;
}

export const MiningCoin3D: React.FC<MiningCoin3DProps> = ({ isActive, isCompleted, onClick }) => {
  return (
    <div
      onClick={onClick}
      className="relative flex flex-col items-center justify-center cursor-pointer select-none py-4"
    >
      {/* Outer Multi-layered Aura & Glow Rings */}
      <div
        className={`absolute -inset-8 rounded-full transition-all duration-700 pointer-events-none ${
          isActive
            ? 'bg-gradient-to-r from-amber-500/25 via-sky-500/30 to-amber-400/25 blur-3xl opacity-90 animate-pulse'
            : isCompleted
            ? 'bg-emerald-500/20 blur-2xl opacity-70'
            : 'bg-slate-800/20 blur-xl opacity-30'
        }`}
      />

      {/* Cyber/Energy Orbital Ring */}
      <div
        className={`relative w-48 h-48 sm:w-56 sm:h-56 rounded-full flex items-center justify-center p-1.5 transition-all duration-500 ${
          isActive
            ? 'gold-energy-glow ring-2 ring-amber-400/60 shadow-[0_0_40px_rgba(245,158,11,0.4)]'
            : isCompleted
            ? 'ring-2 ring-emerald-400/70 shadow-[0_0_30px_rgba(16,185,129,0.4)]'
            : 'ring-1 ring-slate-700/60 shadow-inner'
        }`}
      >
        {/* Orbital Dash Circles */}
        <div
          className={`absolute inset-0 rounded-full border border-dashed transition-all ${
            isActive ? 'border-amber-400/50 animate-[spin_12s_linear_infinite]' : 'border-slate-800'
          }`}
        />
        <div
          className={`absolute -inset-2 rounded-full border border-dotted transition-all ${
            isActive ? 'border-sky-400/40 animate-[spin_20s_linear_infinite_reverse]' : 'border-transparent'
          }`}
        />

        {/* 3D Coin Inner Frame */}
        <div
          className={`relative w-full h-full rounded-full overflow-hidden p-1.5 bg-gradient-to-tr from-amber-600 via-amber-300 to-amber-700 shadow-2xl transition-transform duration-500 ${
            isActive ? 'animate-spin-3d' : 'hover:scale-105'
          }`}
        >
          {/* Beveled Metallic Rim */}
          <div className="w-full h-full rounded-full overflow-hidden relative shadow-inner bg-slate-950">
            <img
              src="/e4f_coin.jpg"
              alt="Official E4F Mining Coin"
              className="w-full h-full object-cover rounded-full"
            />

            {/* Subtle Metallic Highlight reflection sheen across coin */}
            {isActive && (
              <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/20 to-transparent opacity-60 pointer-events-none mix-blend-overlay" />
            )}
          </div>
        </div>

        {/* Live Status Floating Tag */}
        <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap">
          {isActive ? (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-950/90 border border-amber-500/80 shadow-[0_0_15px_rgba(245,158,11,0.5)] text-[11px] font-bold text-amber-300">
              <Zap className="w-3.5 h-3.5 text-amber-400 animate-bounce" />
              <span>MINING ACTIVE (8H)</span>
            </div>
          ) : isCompleted ? (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-950/90 border border-emerald-500/80 shadow-[0_0_15px_rgba(16,185,129,0.5)] text-[11px] font-bold text-emerald-300">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
              <span>MINING COMPLETED</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-950/90 border border-slate-700 text-[11px] font-bold text-slate-300 shadow-md">
              <Flame className="w-3.5 h-3.5 text-amber-400" />
              <span>MINING READY</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
