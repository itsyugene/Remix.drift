import React, { useRef, useEffect } from 'react';
import { Place } from '../types.ts';
import { parseHours, formatHM } from '../utils/hoursParser.ts';
import { getCompassDirection, formatDistance } from '../utils/geoUtils.ts';
import { FeedbackControls } from './FeedbackControls.tsx';
import { getFeedback } from '../lib/feedback.ts';
import { AlertTriangle } from 'lucide-react';
import { hapticFeedback, playTargetLockSound } from '../utils/haptic.ts';

interface PlaceCardProps {
  place: Place;
  userLat: number;
  userLng: number;
  key?: string;
  deviceHeading?: number | null;
  soundEnabled?: boolean;
  onChange?: () => void;
}

export default function PlaceCard({ place, userLat, userLng, deviceHeading, soundEnabled, onChange }: PlaceCardProps) {
  const hours = parseHours(place.tags.opening_hours);
  
  const feedback = getFeedback(place.osmType, place.osmId);
  const isSkipped = feedback?.vote === 'down';
  const isGoodDrift = feedback?.vote === 'up';

  // Calculate bearing relative to device orientation for pointing logic
  const relativeBearing = deviceHeading !== undefined && deviceHeading !== null 
    ? (place.bearing - deviceHeading + 360) % 360 
    : null;

  // Check if device is facing within 15 degrees of the place
  const isPointedAt = relativeBearing !== null && (relativeBearing <= 15 || relativeBearing >= 345);

  const prevIsPointedAtRef = useRef<boolean>(false);

  useEffect(() => {
    if (isPointedAt && !prevIsPointedAtRef.current) {
      hapticFeedback.light();
      if (soundEnabled) {
        playTargetLockSound();
      }
    }
    prevIsPointedAtRef.current = isPointedAt;
  }, [isPointedAt, soundEnabled]);

  // Determine hours view properties
  let hoursText = "Hours not mapped in OSM";
  let hoursColor = "text-[#7E84A3]";

  if (hours.state === "open") {
    hoursText = hours.always ? "Open 24/7" : `Open — closes ${formatHM(hours.until || 0)}`;
    hoursColor = "text-[#2EC4B6] font-semibold";
  } else if (hours.state === "closed") {
    hoursText = hours.next !== null ? `Closed — opens ${formatHM(hours.next || 0)}` : "Closed today";
    hoursColor = "text-[#E71D36] font-semibold";
  } else if (hours.state === "unknown") {
    const rawHours = place.tags.opening_hours || "";
    const abbreviated = rawHours.length > 35 ? `${rawHours.slice(0, 32)}...` : rawHours;
    hoursText = `Hours: ${abbreviated} — unverified`;
    hoursColor = "text-[#7E84A3] italic";
  }

  const osmUrl = `https://www.openstreetmap.org/${place.osmType}/${place.osmId}`;
  const directionsUrl = `https://www.openstreetmap.org/directions?from=${userLat}%2C${userLng}&to=${place.lat}%2C${place.lng}`;

  const reportSubject = encodeURIComponent(`[DRIFT] Data/Link Report: ${place.name || 'Unnamed Spot'}`);
  const reportBody = encodeURIComponent(
    `Hi Drift Maintainer,\n\n` +
    `I would like to report an issue with the following place in the DRIFT app:\n` +
    `• Name: ${place.name || 'Unnamed Spot'}\n` +
    `• OSM Entity: ${place.osmType}/${place.osmId}\n` +
    `• Coordinates: ${place.lat}, ${place.lng}\n` +
    `• OSM Link: https://www.openstreetmap.org/${place.osmType}/${place.osmId}\n\n` +
    `Please describe the issue (e.g., inaccurate business hours, closed down, incorrect location, broken links):\n` +
    `[Your feedback here]\n\n` +
    `Thank you!`
  );
  const mailtoUrl = `mailto:multimotika@gmail.com?subject=${reportSubject}&body=${reportBody}`;

  return (
    <article 
      className={`mb-3.5 border rounded-[10px] bg-[#090A10] text-white p-4 hover:border-[#3A4160] flex flex-col justify-between transition-all duration-300 ${
        isPointedAt 
          ? 'border-[#FF4522] scale-[1.01]' 
          : 'border-[#25293A]'
      } ${isSkipped ? 'opacity-[0.72]' : ''}`}
      id={`card-${place.key}`}
    >
      <div className="flex justify-between items-start gap-2.5">
        <div className="flex flex-col gap-1">
          <h3 className={`font-bold text-base leading-tight ${place.named ? 'text-white' : 'text-[#7E84A3] italic'}`}>
            {place.name}
          </h3>
          {isPointedAt && (
            <span className="inline-flex items-center gap-1 text-[9px] font-mono font-extrabold uppercase tracking-wider text-[#2EC4B6] bg-[#2EC4B6]/10 px-2 py-0.5 rounded-full w-max animate-pulse">
              🎯 Target Locked
            </span>
          )}
        </div>
        
        {/* Distance + rotating compass needle with calibration guide */}
        <div className="flex flex-col items-end gap-1.5 self-start">
          <span className="flex items-center gap-1.5 py-1 px-2.5 rounded-full bg-[#10111A] text-[#B7BDD5] border border-[#25293A] text-[11px] font-mono font-bold whitespace-nowrap">
            <span 
              className="inline-block transition-transform duration-300"
              style={{ 
                '--bearing-deg': `${Math.round(deviceHeading !== undefined && deviceHeading !== null ? (place.bearing - deviceHeading + 360) % 360 : place.bearing)}deg`,
                transform: `rotate(${Math.round(deviceHeading !== undefined && deviceHeading !== null ? (place.bearing - deviceHeading + 360) % 360 : place.bearing)}deg)`
              } as React.CSSProperties}
              aria-hidden="true"
            >
              ↑
            </span>
            {getCompassDirection(deviceHeading !== undefined && deviceHeading !== null ? (place.bearing - deviceHeading + 360) % 360 : place.bearing)} — {formatDistance(place.distance)}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mt-1.5">
        <span className="text-[11px] font-bold tracking-wide uppercase text-[#7E84A3] font-mono">
          {place.typeLabel}
        </span>
        {place._morning && (
          <span className="text-[10px] font-bold bg-[#ff9f1c]/10 text-[#ff9f1c] px-2 py-0.5 rounded-full uppercase tracking-wider font-mono">
            morning pick
          </span>
        )}
        {isSkipped && (
          <span className="text-[10px] font-bold bg-[#E71D36]/10 text-[#E71D36] px-2 py-0.5 rounded-full uppercase tracking-wider font-mono">
            skipped
          </span>
        )}
        {isGoodDrift && (
          <span className="text-[10px] font-bold bg-[#2EC4B6]/10 text-[#2EC4B6] px-2 py-0.5 rounded-full uppercase tracking-wider font-mono">
            good drift
          </span>
        )}
      </div>

      <p className={`text-xs mt-1.5 font-sans ${hoursColor}`}>{hoursText}</p>
      
      {place.subTags && (
        <p className="text-[11px] text-[#7E84A3] mt-1 font-mono break-words">{place.subTags}</p>
      )}

      <div className="flex flex-wrap items-center gap-4 mt-3 pb-3 border-b border-dashed border-[#25293A] font-mono text-xs">
        <a 
          href={osmUrl} 
          target="_blank" 
          rel="noopener noreferrer" 
          className="text-[#ff4522] hover:text-[#ff6a4d] no-underline font-bold"
        >
          Open in OSM &rarr;
        </a>
        <a 
          href={directionsUrl} 
          target="_blank" 
          rel="noopener noreferrer" 
          className="text-[#ff4522] hover:text-[#ff6a4d] no-underline font-bold"
        >
          Directions &rarr;
        </a>
        <button
          type="button"
          onClick={() => {
            hapticFeedback.light();
            window.location.href = mailtoUrl;
          }}
          className="group text-[#7E84A3] hover:text-[#ff4522] hover:bg-[#ff4522]/5 px-2.5 py-1 rounded-md border border-[#25293A] hover:border-[#ff4522]/30 text-[10px] ml-auto font-extrabold uppercase tracking-wider transition-all duration-200 cursor-pointer flex items-center gap-1 active:scale-95"
          title={`Report incorrect data or issues for ${place.name || 'Unnamed Spot'} (OSM ID: ${place.osmId})`}
        >
          <AlertTriangle className="w-3.5 h-3.5 text-[#7E84A3] group-hover:text-[#ff4522]" />
          <span>Report incorrect data</span>
        </button>
      </div>

      <FeedbackControls 
        osmType={place.osmType} 
        osmId={place.osmId} 
        placeName={place.name} 
        onChange={onChange}
      />
    </article>
  );
}
