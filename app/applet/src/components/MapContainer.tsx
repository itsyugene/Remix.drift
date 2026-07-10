import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Coordinates, DriftPoint } from '../types';

// Fix Leaflet missing icon issues by defining beautiful custom markers using SVG DivIcon
const createCustomMarker = (color: string, heading: number, isCurrent: boolean) => {
  const pulseHtml = isCurrent
    ? `<div class="absolute -inset-2 bg-${color}-500/20 rounded-full animate-ping"></div>`
    : '';

  const svgIcon = `
    <div class="relative flex items-center justify-center w-8 h-8">
      ${pulseHtml}
      <div class="relative w-6 h-6 rounded-full bg-slate-900 border-2 border-${color}-400 flex items-center justify-center shadow-lg shadow-black/40">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" 
             class="w-4 h-4 text-${color}-400 transition-transform duration-200"
             style="transform: rotate(${heading}deg);">
          <path d="M12 2L2 22l10-6 10 6L12 2z" />
        </svg>
      </div>
    </div>
  `;

  return L.divIcon({
    html: svgIcon,
    className: 'custom-leaflet-icon',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
};

const createStartingMarker = () => {
  const svgIcon = `
    <div class="relative flex items-center justify-center w-8 h-8">
      <div class="w-5 h-5 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center shadow-md">
        <div class="w-1.5 h-1.5 rounded-full bg-white"></div>
      </div>
      <div class="absolute bottom-[-16px] text-[10px] font-bold font-mono bg-emerald-950 text-emerald-400 px-1 py-0.2 rounded border border-emerald-500/30 whitespace-nowrap shadow">
        START
      </div>
    </div>
  `;

  return L.divIcon({
    html: svgIcon,
    className: 'custom-start-icon',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
};

const createDriftMarker = (note: string) => {
  const svgIcon = `
    <div class="relative flex items-center justify-center w-6 h-6 group">
      <div class="w-3.5 h-3.5 rounded-full bg-sky-500 border border-white flex items-center justify-center shadow-md"></div>
      <div class="absolute bottom-6 scale-0 group-hover:scale-100 transition-all duration-150 origin-bottom text-[10px] bg-slate-900 text-slate-200 px-2 py-1 rounded border border-slate-700 whitespace-nowrap shadow-xl z-50">
        ${note}
      </div>
    </div>
  `;

  return L.divIcon({
    html: svgIcon,
    className: 'custom-drift-icon',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
};

// Component to handle auto-panning/centering map
interface MapControllerProps {
  center: Coordinates;
  follow: boolean;
}

const MapController: React.FC<MapControllerProps> = ({ center, follow }) => {
  const map = useMap();

  useEffect(() => {
    if (follow) {
      map.setView([center.lat, center.lng], map.getZoom());
    }
  }, [center, follow, map]);

  return null;
};

interface MapProps {
  currentCoords: Coordinates;
  startCoords: Coordinates | null;
  trail: DriftPoint[];
  followUser: boolean;
  deviceHeading: number;
}

export const MapComponent: React.FC<MapProps> = ({
  currentCoords,
  startCoords,
  trail,
  followUser,
  deviceHeading,
}) => {
  const mapCenter: [number, number] = [currentCoords.lat, currentCoords.lng];

  // Extract polyline points
  const polylinePoints: [number, number][] = trail.map((p) => [p.coords.lat, p.coords.lng]);

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden border border-slate-800 shadow-2xl bg-slate-900">
      <MapContainer
        center={mapCenter}
        zoom={18}
        zoomControl={false}
        className="w-full h-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />

        {/* Trail Polyline */}
        {polylinePoints.length > 1 && (
          <Polyline
            positions={polylinePoints}
            color="#38bdf8"
            weight={3}
            opacity={0.8}
            dashArray="2, 6"
          />
        )}

        {/* Start Coordinates Marker */}
        {startCoords && (
          <Marker position={[startCoords.lat, startCoords.lng]} icon={createStartingMarker()} />
        )}

        {/* Drift Points/Logged Points Markers */}
        {trail
          .filter((p) => p.isCustomLogged && p.note)
          .map((p) => (
            <Marker
              key={p.id}
              position={[p.coords.lat, p.coords.lng]}
              icon={createDriftMarker(p.note || 'Logged point')}
            />
          ))}

        {/* Current User/Sensor Marker */}
        <Marker
          position={mapCenter}
          icon={createCustomMarker('sky', deviceHeading, followUser)}
        />

        {/* Controller to handle centering */}
        <MapController center={currentCoords} follow={followUser} />
      </MapContainer>

      {/* Static Compass Rose Overlay on Map */}
      <div className="absolute top-4 right-4 pointer-events-none z-[1000] bg-slate-950/80 backdrop-blur-md px-2.5 py-1.5 rounded-lg border border-slate-800 shadow flex items-center gap-1.5">
        <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse"></div>
        <span className="text-[10px] font-mono font-bold tracking-wider text-slate-300">
          GPS_GPSD_LOCK
        </span>
      </div>
    </div>
  );
};
