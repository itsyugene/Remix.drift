import { Place } from '../types.ts';
import { parseHours, formatHM } from '../utils/hoursParser.ts';
import { getCompassDirection, formatDistance } from '../utils/geoUtils.ts';
import { FeedbackControls } from './FeedbackControls.tsx';
import { getFeedback } from '../lib/feedback.ts';

interface PlaceCardProps {
  place: Place;
  userLat: number;
  userLng: number;
  accentColor: string; // active category color — drives the card's top border
  onChange?: () => void;
}

// DRIFT v3 card: a light "cream" card on the dark page, colored top-border in the
// active category color. Bearing arrow points TRUE north-relative (no device
// sensor). Deliberately nimble — no target-lock/sound/report clutter.
export default function PlaceCard({ place, userLat, userLng, accentColor, onChange }: PlaceCardProps) {
  const hours = parseHours(place.tags.opening_hours);

  const feedback = getFeedback(place.osmType, place.osmId);
  const isSkipped = feedback?.vote === 'down';
  const isGoodDrift = feedback?.vote === 'up';

  let hoursText = 'Hours not mapped in OSM';
  let hoursColor = '#9a9684';
  if (hours.state === 'open') {
    hoursText = hours.always ? 'Open 24/7' : `Open — closes ${formatHM(hours.until || 0)}`;
    hoursColor = '#1f8a4c';
  } else if (hours.state === 'closed') {
    hoursText = hours.next !== null ? `Closed — opens ${formatHM(hours.next || 0)}` : 'Closed today';
    hoursColor = '#b3402f';
  } else if (hours.state === 'unknown') {
    const raw = place.tags.opening_hours || '';
    const abbr = raw.length > 35 ? `${raw.slice(0, 32)}...` : raw;
    hoursText = `Hours: ${abbr} — unverified`;
    hoursColor = '#8a8576';
  }

  const osmUrl = `https://www.openstreetmap.org/${place.osmType}/${place.osmId}`;
  const directionsUrl = `https://www.openstreetmap.org/directions?from=${userLat}%2C${userLng}&to=${place.lat}%2C${place.lng}`;

  return (
    <article
      className={`mb-2.5 rounded-lg bg-[#fdfaf4] text-[#12131a] p-3.5 shadow-[0_8px_24px_rgba(0,0,0,0.28)] transition-opacity ${
        isSkipped ? 'opacity-[0.72]' : ''
      }`}
      style={{ borderTop: `3px solid ${accentColor}` }}
      id={`card-${place.key}`}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2.5 items-start">
        <h3
          className="min-w-0 text-[1.04rem] leading-tight font-bold break-words"
          style={{ color: place.named ? '#12131a' : '#8a8576' }}
        >
          {place.name}
        </h3>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#e8e3d8] text-[#3a3b40] px-2.5 py-1 whitespace-nowrap font-mono text-[0.74rem] font-semibold">
          <span
            className="inline-block leading-none"
            style={{ transform: `rotate(${Math.round(place.bearing)}deg)` }}
            aria-hidden="true"
          >
            ↑
          </span>
          {getCompassDirection(place.bearing)} · {formatDistance(place.distance)}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2 mt-1.5">
        <span className="text-[0.74rem] font-bold tracking-wide uppercase text-[#5f647d]">{place.typeLabel}</span>
        {place._morning && (
          <span className="text-[0.64rem] font-bold uppercase tracking-wider rounded-full px-1.5 py-0.5 text-[#a8650a] bg-[#fbe7c6]">
            morning pick
          </span>
        )}
        {isSkipped && (
          <span className="text-[0.64rem] font-bold uppercase tracking-wider rounded-full px-1.5 py-0.5 text-[#b3402f] bg-[#f3ded8]">
            skipped
          </span>
        )}
        {isGoodDrift && (
          <span className="text-[0.64rem] font-bold uppercase tracking-wider rounded-full px-1.5 py-0.5 text-[#1f8a4c] bg-[#dcefe2]">
            good drift
          </span>
        )}
      </div>

      <p className="text-[0.78rem] mt-1.5 font-bold" style={{ color: hoursColor }}>
        {hoursText}
      </p>

      {place.subTags && <p className="text-[0.78rem] text-[#747887] mt-1 break-words">{place.subTags}</p>}

      <div className="flex flex-wrap items-center gap-3.5 mt-2.5 pb-2.5 border-b border-dashed border-[#d8d2bf]">
        <a
          href={osmUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#ff4522] no-underline text-[0.82rem] font-bold hover:text-[#ff5c3d]"
        >
          Open in OSM ↗
        </a>
        <a
          href={directionsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#ff4522] no-underline text-[0.82rem] font-bold hover:text-[#ff5c3d]"
        >
          Directions ↗
        </a>
      </div>

      <FeedbackControls osmType={place.osmType} osmId={place.osmId} placeName={place.name} onChange={onChange} />
    </article>
  );
}
