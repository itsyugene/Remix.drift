import { useState } from 'react';
import { MapPin, Loader2, Check, X } from 'lucide-react';
import { Place } from '../types.ts';
import { calculateDistance } from '../utils/geoUtils.ts';
import {
  recordCheckin,
  checkinsLeft,
  previewReward,
  PROXIMITY_M,
  type Vibe,
} from '../lib/driftPoints.ts';

interface CheckinButtonProps {
  place: Place;
  vibe: Vibe;          // the active tab — decides the reward multiplier
  accentColor: string;
  onEarned?: () => void; // bubble up so the header badge refreshes
}

type UiState =
  | { kind: 'idle' }
  | { kind: 'locating' }
  | { kind: 'earned'; reward: number }
  | { kind: 'error'; msg: string };

// Off-chain check-in: grabs a LIVE GPS fix, verifies you're within PROXIMITY_M
// of the venue, then awards "drift" per the spec formula. Device-only, no chain.
// When you're drifting a city you're not physically in, this will honestly say
// "too far" — which is the point: it proves the presence economics.
export default function CheckinButton({ place, vibe, accentColor, onEarned }: CheckinButtonProps) {
  const [ui, setUi] = useState<UiState>({ kind: 'idle' });

  const left = checkinsLeft(place.key);
  const preview = previewReward(vibe);
  const capped = left <= 0;

  const handleCheckin = () => {
    if (!navigator.geolocation) {
      setUi({ kind: 'error', msg: 'No GPS on this device' });
      return;
    }
    setUi({ kind: 'locating' });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const distanceM = calculateDistance(
          pos.coords.latitude,
          pos.coords.longitude,
          place.lat,
          place.lng,
        );
        const res = recordCheckin({ venueKey: place.key, name: place.name, vibe, distanceM });
        if (res.ok) {
          setUi({ kind: 'earned', reward: res.reward });
          onEarned?.();
          window.setTimeout(() => setUi({ kind: 'idle' }), 2600);
        } else if (res.reason === 'too_far') {
          setUi({ kind: 'error', msg: `Too far — ${res.detail} (be within ${PROXIMITY_M} m)` });
          window.setTimeout(() => setUi({ kind: 'idle' }), 3200);
        } else if (res.reason === 'venue_cap') {
          setUi({ kind: 'error', msg: 'Daily limit here reached (3/24h)' });
          window.setTimeout(() => setUi({ kind: 'idle' }), 3200);
        } else {
          setUi({ kind: 'error', msg: 'No location fix' });
          window.setTimeout(() => setUi({ kind: 'idle' }), 3200);
        }
      },
      (err) => {
        setUi({
          kind: 'error',
          msg: err.code === err.PERMISSION_DENIED ? 'Location permission needed' : 'Location unavailable',
        });
        window.setTimeout(() => setUi({ kind: 'idle' }), 3200);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
    );
  };

  if (ui.kind === 'earned') {
    return (
      <div className="mt-2.5 flex items-center gap-1.5 text-[0.8rem] font-bold" style={{ color: '#1f8a4c' }}>
        <Check className="w-4 h-4" />
        <span>+{ui.reward} drift earned</span>
      </div>
    );
  }

  if (ui.kind === 'error') {
    return (
      <div className="mt-2.5 flex items-center gap-1.5 text-[0.78rem] font-semibold text-[#b3402f]">
        <X className="w-4 h-4 shrink-0" />
        <span>{ui.msg}</span>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={handleCheckin}
      disabled={capped || ui.kind === 'locating'}
      className="mt-2.5 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.78rem] font-bold text-white transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
      style={{ background: capped ? '#8a8576' : accentColor }}
      title={capped ? 'Daily limit reached for this spot' : `Earn ~${preview.total} drift if you're here now`}
    >
      {ui.kind === 'locating' ? (
        <>
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span>Checking…</span>
        </>
      ) : capped ? (
        <span>Checked in today</span>
      ) : (
        <>
          <MapPin className="w-3.5 h-3.5" />
          <span>Check in · +{preview.total}</span>
        </>
      )}
    </button>
  );
}
