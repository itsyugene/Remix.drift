import React from 'react';
import { Compass, Trash2, MapPin, Clock } from 'lucide-react';
import { DriftPoint } from '../types';
import { formatDistance, formatTime } from '../utils';

interface DriftLogProps {
  trail: DriftPoint[];
  onDeletePoint: (id: string) => void;
}

export const DriftLog: React.FC<DriftLogProps> = ({ trail, onDeletePoint }) => {
  const loggedPoints = trail.filter((p) => p.isCustomLogged);

  return (
    <div className="flex flex-col bg-slate-900/80 backdrop-blur-md p-6 rounded-2xl border border-slate-800 shadow-xl w-full h-full max-h-80 overflow-hidden">
      <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-800/60">
        <h3 className="text-xs font-bold tracking-wider text-slate-400 uppercase font-sans">
          Annotation Logs ({loggedPoints.length})
        </h3>
        {loggedPoints.length > 0 && (
          <span className="text-[9px] font-mono bg-sky-500/10 text-sky-400 px-2 py-0.5 rounded border border-sky-500/20 uppercase">
            Captured
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2.5">
        {loggedPoints.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <MapPin className="w-8 h-8 text-slate-600 mb-2 stroke-1" />
            <span className="text-xs text-slate-500 font-sans">No annotated drift coordinates recorded yet.</span>
            <span className="text-[10px] text-slate-600 font-mono mt-1">Use the input field above to log a point.</span>
          </div>
        ) : (
          loggedPoints.map((point) => (
            <div
              key={point.id}
              className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/60 flex items-center justify-between gap-3 transition-colors hover:bg-slate-950"
            >
              <div className="flex flex-col gap-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-sky-400 truncate max-w-[140px]">
                    {point.note || 'Logged Point'}
                  </span>
                  <span className="text-[9px] bg-slate-800 text-slate-400 px-1.5 py-0.2 rounded font-mono">
                    #{point.id.slice(0, 4)}
                  </span>
                </div>
                
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-500 font-mono">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-600" />
                    {formatTime(point.timestamp)}
                  </span>
                  <span className="flex items-center gap-1 font-bold text-amber-500">
                    <Compass className="w-3 h-3 text-slate-600" />
                    HDG: {point.deviceHeading}°
                  </span>
                  <span className="text-slate-400 font-semibold bg-sky-500/5 px-1 rounded border border-sky-500/10">
                    DRIFT: {formatDistance(point.driftDistance)}
                  </span>
                </div>
              </div>

              <button
                onClick={() => onDeletePoint(point.id)}
                className="text-slate-500 hover:text-rose-400 p-2 rounded-lg transition-colors bg-slate-900/40 hover:bg-rose-500/10"
                title="Delete Point"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
