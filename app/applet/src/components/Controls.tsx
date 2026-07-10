import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Play, Square, MapPin, RefreshCw, Radio, Settings, AlertTriangle } from 'lucide-react';
import { DriftStats, Coordinates } from '../types';
import { formatDistance } from '../utils';

interface ControlsProps {
  stats: DriftStats;
  isTracking: boolean;
  onToggleTracking: () => void;
  isSimulating: boolean;
  onToggleSimulation: () => void;
  simulationRate: number;
  onSimulationRateChange: (val: number) => void;
  onResetSession: () => void;
  onLogCustomPoint: (note: string) => void;
  currentCoords: Coordinates;
}

export const Controls: React.FC<ControlsProps> = ({
  stats,
  isTracking,
  onToggleTracking,
  isSimulating,
  onToggleSimulation,
  simulationRate,
  onSimulationRateChange,
  onResetSession,
  onLogCustomPoint,
  currentCoords,
}) => {
  const [logNote, setLogNote] = useState('');

  const handleSubmitLog = (e: React.FormEvent) => {
    e.preventDefault();
    if (!logNote.trim()) return;
    onLogCustomPoint(logNote);
    setLogNote('');
  };

  return (
    <div className="flex flex-col gap-5 bg-slate-900/80 backdrop-blur-md p-6 rounded-2xl border border-slate-800 shadow-xl w-full">
      {/* Real-time Status banner */}
      <div className="flex items-center justify-between border-b border-slate-800/60 pb-4">
        <div className="flex items-center gap-2">
          <div className="relative flex h-3 w-3">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isTracking ? 'bg-sky-400' : 'bg-rose-400'} opacity-75`}></span>
            <span className={`relative inline-flex rounded-full h-3 w-3 ${isTracking ? 'bg-sky-500' : 'bg-rose-500'}`}></span>
          </div>
          <span className="text-sm font-bold tracking-tight text-slate-200">
            {isTracking ? 'SESSION: ACTIVE' : 'SESSION: STOPPED'}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
          <Radio className="w-3.5 h-3.5 text-sky-400 animate-pulse" />
          MOCK_GPS: {isSimulating ? 'ON' : 'OFF'}
        </div>
      </div>

      {/* Grid displaying Drift Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/40">
          <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Current Drift</span>
          <div className="text-2xl font-black font-mono text-sky-400 mt-1">
            {formatDistance(stats.currentDrift)}
          </div>
        </div>
        <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/40">
          <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Maximum Drift</span>
          <div className="text-2xl font-black font-mono text-amber-500 mt-1">
            {formatDistance(stats.maxDrift)}
          </div>
        </div>
        <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/40">
          <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Avg Drift</span>
          <div className="text-lg font-bold font-mono text-slate-300 mt-1">
            {formatDistance(stats.averageDrift)}
          </div>
        </div>
        <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/40">
          <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Logged Points</span>
          <div className="text-lg font-bold font-mono text-slate-300 mt-1">
            {stats.pointCount} <span className="text-xs text-slate-500 font-sans">pts</span>
          </div>
        </div>
      </div>

      {/* Current Position Coordinates */}
      <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <MapPin className="w-5 h-5 text-sky-400 flex-shrink-0" />
          <div className="flex flex-col">
            <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Latitude / Longitude</span>
            <span className="text-xs font-mono font-bold text-slate-300 mt-0.5">
              {currentCoords.lat.toFixed(6)}°, {currentCoords.lng.toFixed(6)}°
            </span>
          </div>
        </div>
        {currentCoords.accuracy && (
          <div className="flex flex-col items-end">
            <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Sens_Acc</span>
            <span className="text-xs font-mono text-sky-400 mt-0.5">±{currentCoords.accuracy}m</span>
          </div>
        )}
      </div>

      {/* Session Controls */}
      <div className="flex gap-3">
        <button
          onClick={onToggleTracking}
          className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-sm transition-all shadow-md ${
            isTracking
              ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-950/20'
              : 'bg-sky-600 hover:bg-sky-500 text-white shadow-sky-950/20'
          }`}
        >
          {isTracking ? (
            <>
              <Square className="w-4 h-4 fill-white" /> Stop Tracking
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-white" /> Start Tracking
            </>
          )}
        </button>

        <button
          onClick={onResetSession}
          className="bg-slate-800 hover:bg-slate-700 text-slate-300 p-3 rounded-xl border border-slate-700/60 transition-colors shadow-sm"
          title="Reset Session"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {/* Drift Simulator Controls */}
      <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800/60 flex flex-col gap-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-bold text-slate-300 tracking-wider uppercase">Drift Simulator</span>
          </div>
          <button
            onClick={onToggleSimulation}
            className={`text-xs font-bold py-1 px-2.5 rounded-md border transition-all ${
              isSimulating
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
          >
            {isSimulating ? 'SIMULATOR ACTIVE' : 'ACTIVATE SIM'}
          </button>
        </div>

        {isSimulating && (
          <div className="flex flex-col gap-2">
            <div className="flex justify-between text-[10px] text-slate-400 font-mono">
              <span>Drift Rate / Speed</span>
              <span className="text-sky-400 font-bold">{simulationRate} m/s</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="10"
              step="0.5"
              value={simulationRate}
              onChange={(e) => onSimulationRateChange(parseFloat(e.target.value))}
              className="w-full accent-sky-500 bg-slate-800 h-1 rounded-lg appearance-none cursor-pointer"
            />
          </div>
        )}
      </div>

      {/* Log Custom Drift Point Form */}
      <form onSubmit={handleSubmitLog} className="flex flex-col gap-2">
        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Log Annotation Point</span>
        <div className="flex gap-2">
          <input
            type="text"
            value={logNote}
            onChange={(e) => setLogNote(e.target.value)}
            placeholder="Add marker note (e.g., GPS drift offset...)"
            className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-sky-500 transition-colors placeholder:text-slate-600"
            disabled={!isTracking}
          />
          <button
            type="submit"
            disabled={!isTracking}
            className="bg-sky-600/20 hover:bg-sky-600 text-sky-400 hover:text-white px-4 py-2 rounded-xl text-xs font-bold border border-sky-500/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Log
          </button>
        </div>
      </form>
    </div>
  );
};
