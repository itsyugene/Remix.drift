import React from 'react';
import { motion } from 'motion/react';
import { Compass as CompassIcon, Navigation } from 'lucide-react';

interface CompassProps {
  heading: number; // in degrees, 0-360
  accuracy?: number; // accuracy of compass or GPS
}

export const Compass: React.FC<CompassProps> = ({ heading, accuracy }) => {
  // Cardinal directions calculation
  const getCardinal = (deg: number) => {
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const index = Math.round(((deg % 360) / 45)) % 8;
    return directions[index];
  };

  return (
    <div className="flex flex-col items-center justify-center bg-slate-900/80 backdrop-blur-md p-6 rounded-2xl border border-slate-800 shadow-xl w-full max-w-xs">
      <div className="flex justify-between items-center w-full mb-4">
        <span className="text-xs font-semibold tracking-wider text-slate-400 uppercase font-sans">
          Heading Sensor
        </span>
        <span className="flex items-center text-[10px] bg-sky-500/10 text-sky-400 px-2 py-0.5 rounded-full border border-sky-500/20 font-mono">
          <CompassIcon className="w-3 h-3 mr-1" />
          ACC: {accuracy ? `${accuracy}°` : 'HIGH'}
        </span>
      </div>

      {/* Main Dial */}
      <div className="relative w-48 h-48 rounded-full border-2 border-slate-700 bg-slate-950 flex items-center justify-center shadow-inner overflow-hidden">
        {/* outer ticks */}
        {[...Array(12)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-3 bg-slate-700"
            style={{
              transform: `rotate(${i * 30}deg) translateY(-88px)`,
            }}
          />
        ))}

        {/* Cardinal Markers on static outer bezel */}
        <div className="absolute top-3 font-bold text-sm text-red-500 font-sans">N</div>
        <div className="absolute right-3 font-bold text-sm text-slate-300 font-sans">E</div>
        <div className="absolute bottom-3 font-bold text-sm text-slate-400 font-sans">S</div>
        <div className="absolute left-3 font-bold text-sm text-slate-300 font-sans">W</div>

        {/* Rotational inner dial mirroring user heading */}
        <motion.div
          className="absolute inset-0 flex items-center justify-center"
          animate={{ rotate: -heading }}
          transition={{ type: 'spring', stiffness: 80, damping: 15 }}
        >
          {/* North needle indicator */}
          <div className="absolute top-6 w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-b-[24px] border-b-red-500" />
          {/* South needle indicator */}
          <div className="absolute bottom-6 w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[24px] border-t-slate-600" />
          
          {/* Crosshairs */}
          <div className="w-full h-[1px] bg-slate-800/60 absolute" />
          <div className="h-full w-[1px] bg-slate-800/60 absolute" />

          {/* Compass ring marking degrees */}
          <div className="absolute w-36 h-36 rounded-full border border-slate-800/40 border-dashed" />
        </motion.div>

        {/* Center Cap & Heading readout */}
        <div className="absolute inset-12 rounded-full bg-slate-900 border border-slate-800 flex flex-col items-center justify-center shadow-lg z-10">
          <span className="text-3xl font-bold tracking-tight font-mono text-slate-100">
            {Math.round(heading)}°
          </span>
          <span className="text-xs font-semibold font-mono text-sky-400 mt-0.5">
            {getCardinal(heading)}
          </span>
        </div>
      </div>

      {/* Mini details bar */}
      <div className="grid grid-cols-2 gap-4 w-full mt-5 border-t border-slate-800/60 pt-4">
        <div className="flex flex-col items-center border-r border-slate-800/60">
          <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">
            Orientation
          </span>
          <span className="text-sm font-bold font-mono text-slate-300 mt-0.5">
            {heading > 180 ? `W ${(360 - heading).toFixed(0)}°` : `E ${heading.toFixed(0)}°`}
          </span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">
            Nav Vector
          </span>
          <div className="flex items-center text-sm font-bold font-mono text-slate-300 mt-0.5">
            <Navigation 
              className="w-3.5 h-3.5 text-sky-400 mr-1"
              style={{ transform: `rotate(${heading}deg)` }}
            />
            REF_DIR
          </div>
        </div>
      </div>
    </div>
  );
};
