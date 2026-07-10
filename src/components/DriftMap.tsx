import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Place } from '../types.ts';
import { Plus, Minus, Compass, Navigation } from 'lucide-react';
import { hapticFeedback } from '../utils/haptic.ts';

interface DriftMapProps {
  lat: number;
  lng: number;
  radius: number;
  places: Place[];
  accentColor: string;
  deviceHeading: number | null;
  isCollapsed?: boolean;
  onResetCompass?: () => void;
}

export default function DriftMap({ 
  lat, 
  lng, 
  radius, 
  places, 
  accentColor, 
  deviceHeading, 
  isCollapsed = false,
  onResetCompass
}: DriftMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerGroupRef = useRef<L.LayerGroup | null>(null);
  const [tilesLoading, setTilesLoading] = useState(true);
  const [currentZoom, setCurrentZoom] = useState<number>(14);
  const [isPannedAway, setIsPannedAway] = useState<boolean>(false);
  const centerRef = useRef({ lat, lng });

  useEffect(() => {
    centerRef.current = { lat, lng };
  }, [lat, lng]);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Create Map without default zoom control
    const map = L.map(mapContainerRef.current, {
      zoomControl: false,
      attributionControl: true,
      scrollWheelZoom: false,
    });

    mapRef.current = map;

    // Load Dark Carto tiles
    const tileLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    });

    tileLayer.on('loading', () => {
      setTilesLoading(true);
    });

    tileLayer.on('load', () => {
      setTilesLoading(false);
    });

    tileLayer.on('tileerror', () => {
      setTilesLoading(false);
    });

    tileLayer.addTo(map);

    // Group for active dynamic layers
    const markerGroup = L.layerGroup().addTo(map);
    markerGroupRef.current = markerGroup;

    // Set initial view
    const zoomLevel = radius <= 800 ? 15 : radius <= 2000 ? 14 : 13;
    map.setView([lat, lng], zoomLevel);
    setCurrentZoom(zoomLevel);

    // Listen to zoom change events to update manual indicator
    const handleZoomEnd = () => {
      if (mapRef.current) {
        setCurrentZoom(mapRef.current.getZoom());
      }
    };
    map.on('zoomend', handleZoomEnd);

    // Listen to map moveend events to detect when the user has panned away
    const handleMoveEnd = () => {
      if (mapRef.current) {
        const center = mapRef.current.getCenter();
        const dist = center.distanceTo(L.latLng(centerRef.current.lat, centerRef.current.lng));
        setIsPannedAway(dist > 50);
      }
    };
    map.on('moveend', handleMoveEnd);

    // Watch for size changes using ResizeObserver
    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    resizeObserver.observe(mapContainerRef.current);

    return () => {
      if (mapRef.current) {
        mapRef.current.off('zoomend', handleZoomEnd);
        mapRef.current.off('moveend', handleMoveEnd);
      }
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
      markerGroupRef.current = null;
    };
  }, []);

  // Update center, radius ring, and markers when props change
  useEffect(() => {
    const map = mapRef.current;
    const markerGroup = markerGroupRef.current;
    if (!map || !markerGroup) return;

    // Clear previous layers
    markerGroup.clearLayers();

    // Set Viewport dynamically
    const zoomLevel = radius <= 800 ? 15 : radius <= 2000 ? 14 : 13;
    map.setView([lat, lng], zoomLevel, { animate: true });

    // 1. Draw radius ring in meters
    // Calculate size of radius ring
    L.circle([lat, lng], {
      radius: radius,
      color: accentColor,
      weight: 1.5,
      opacity: 0.6,
      fillColor: accentColor,
      fillOpacity: 0.05,
      interactive: false,
    }).addTo(markerGroup);

    // 2. Draw user center dot with rotating compass heading cone if available
    const hasHeading = deviceHeading !== null && deviceHeading !== undefined;
    const rotateStyle = hasHeading ? `transform: rotate(${deviceHeading}deg);` : '';
    const centerIcon = L.divIcon({
      className: '',
      html: `
        <div class="relative w-8 h-8 flex items-center justify-center">
          ${hasHeading ? `
            <div 
              class="absolute inset-0 flex items-center justify-center pointer-events-none transition-transform duration-100" 
              style="${rotateStyle}"
            >
              <!-- Translucent heading cone/pointer -->
              <div 
                class="absolute bottom-1/2 w-8 h-10 origin-bottom opacity-20"
                style="background: conic-gradient(from 150deg at 50% 100%, ${accentColor} 0deg, transparent 60deg, transparent 300deg, ${accentColor} 360deg); clip-path: polygon(50% 0%, 0% 100%, 100% 100%);"
              ></div>
              <!-- Mini sharp pointer arrow -->
              <div 
                class="absolute bottom-1/2 -mb-0.5 w-0 h-0 border-l-[4px] border-r-[4px] border-b-[8px] border-l-transparent border-r-transparent border-b-[#ff4522]"
              ></div>
            </div>
          ` : ''}
          <div class="absolute w-3.5 h-3.5 rounded-full bg-[#ff4522] border-2 border-white shadow-[0_1px_4px_rgba(0,0,0,0.5)] z-10"></div>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });
    L.marker([lat, lng], { icon: centerIcon, interactive: false }).addTo(markerGroup);

    // 3. Draw active markers
    places.forEach((place) => {
      const placeIcon = L.divIcon({
        className: '',
        html: `<div class="w-3 h-3 rounded-full bg-[${accentColor}] border border-[#0b0c12] shadow-[0_1px_4px_rgba(0,0,0,0.5)] transition-all duration-300 hover:scale-125"></div>`,
        iconSize: [12, 12],
        iconAnchor: [6, 6]
      });

      L.marker([place.lat, place.lng], { icon: placeIcon })
        .bindPopup(`
          <div class="font-sans text-neutral-900">
            <h3 class="font-bold text-sm m-0 leading-tight">${place.name}</h3>
            <p class="text-xs text-neutral-500 m-0.5 mt-1 font-mono uppercase tracking-tight">${place.typeLabel}</p>
            <p class="text-xs font-semibold text-neutral-600 m-0 mt-1">${formatMeters(place.distance)} away</p>
          </div>
        `)
        .addTo(markerGroup);
    });

  }, [lat, lng, radius, places, accentColor, deviceHeading]);

  const formatMeters = (m: number) => {
    if (m < 1000) return `${Math.round(m / 10) * 10}m`;
    return `${(m / 1000).toFixed(1)}km`;
  };

  const handleZoomIn = () => {
    if (mapRef.current) {
      mapRef.current.zoomIn();
    }
  };

  const handleZoomOut = () => {
    if (mapRef.current) {
      mapRef.current.zoomOut();
    }
  };

  const handleRecenterAndResetCompass = () => {
    if (mapRef.current) {
      const zoomLevel = radius <= 800 ? 15 : radius <= 2000 ? 14 : 13;
      mapRef.current.setView([lat, lng], zoomLevel, { animate: true });
    }
    if (onResetCompass) {
      onResetCompass();
    }
  };

  const handleRecenterOnly = () => {
    if (mapRef.current) {
      const zoomLevel = radius <= 800 ? 15 : radius <= 2000 ? 14 : 13;
      mapRef.current.setView([lat, lng], zoomLevel, { animate: true });
    }
  };

  return (
    <div 
      className="relative w-full overflow-hidden border rounded-xl bg-[#0b0c12] transition-all duration-500 ease-in-out"
      style={{
        borderColor: isCollapsed ? '#25293a' : `${accentColor}50`,
        boxShadow: isCollapsed ? 'none' : `0 0 14px ${accentColor}20`
      }}
    >
      <div 
        ref={mapContainerRef} 
        id="map"
        className="w-full h-[250px] md:h-[300px] z-10"
        aria-label="Interactive Leaflet Map showing search results"
      />

      {/* Floating Custom Zoom Controls */}
      <div 
        className="absolute top-3 right-3 z-30 flex flex-col rounded-xl overflow-hidden border bg-[#090a10]/95 backdrop-blur-md shadow-[0_4px_20px_rgba(0,0,0,0.65)] transition-all duration-300"
        style={{
          borderColor: `${accentColor}25`
        }}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            hapticFeedback.light();
            handleZoomIn();
          }}
          onDoubleClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
          }}
          className="w-9 h-9 flex items-center justify-center text-[#b7bdd5] hover:text-white transition-colors cursor-pointer border-b border-[#25293a]/50 active:scale-95"
          title="Zoom In"
        >
          <Plus className="w-4 h-4" />
        </button>

        <span className="font-mono text-[9px] font-bold text-[#7e84a3] border-b border-[#25293a]/50 text-center py-1 bg-[#11131f]/30 select-none tracking-tight">
          Z{currentZoom}
        </span>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            hapticFeedback.light();
            handleZoomOut();
          }}
          onDoubleClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
          }}
          className="w-9 h-9 flex items-center justify-center text-[#b7bdd5] hover:text-white transition-colors cursor-pointer active:scale-95"
          title="Zoom Out"
        >
          <Minus className="w-4 h-4" />
        </button>
      </div>

      {/* Floating North Reset / Compass Button Overlay */}
      <button
        type="button"
        id="compass-reset-button"
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          hapticFeedback.light();
          handleRecenterAndResetCompass();
        }}
        className="absolute top-[116px] right-3 z-30 w-9 h-9 flex items-center justify-center rounded-xl border bg-[#090a10]/95 backdrop-blur-md shadow-[0_4px_20px_rgba(0,0,0,0.65)] text-[#b7bdd5] hover:text-white transition-all cursor-pointer active:scale-95 group"
        style={{
          borderColor: `${accentColor}25`
        }}
        title="Reset Map to North & Center View"
        aria-label="Reset Map to North and Center View"
      >
        <div 
          className="relative w-5 h-5 flex items-center justify-center transition-transform duration-300"
          style={{
            transform: `rotate(${deviceHeading ? -deviceHeading : 0}deg)`
          }}
        >
          {/* Compass Icon */}
          <Compass className="w-5 h-5 text-accent transition-colors group-hover:text-white" style={{ color: accentColor }} />
          {/* North Point Indicator Dot */}
          <div className="absolute top-0 w-1 h-1 rounded-full bg-[#ff4522]" />
        </div>
      </button>

      {/* Floating Recenter Button Overlay */}
      <button
        type="button"
        id="recenter-gps-button"
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          hapticFeedback.light();
          handleRecenterOnly();
        }}
        className={`absolute top-[160px] right-3 z-30 w-9 h-9 flex items-center justify-center rounded-xl border bg-[#090a10]/95 backdrop-blur-md shadow-[0_4px_20px_rgba(0,0,0,0.65)] transition-all cursor-pointer active:scale-95 group ${
          isPannedAway 
            ? 'text-white border-[#2ec4b6] animate-pulse shadow-[0_0_12px_rgba(46,196,182,0.4)]' 
            : 'text-[#b7bdd5] hover:text-white'
        }`}
        style={{
          borderColor: isPannedAway ? accentColor : `${accentColor}25`,
          boxShadow: isPannedAway ? `0 0 12px ${accentColor}50, 0 4px 20px rgba(0,0,0,0.65)` : '0 4px 20px rgba(0,0,0,0.65)'
        }}
        title="Recenter Map on Current GPS Location"
        aria-label="Recenter Map on Current GPS Location"
      >
        <Navigation 
          className="w-4 h-4 transition-transform group-hover:scale-110" 
          style={{ 
            color: isPannedAway ? accentColor : undefined,
            transform: 'rotate(45deg)' 
          }} 
        />
      </button>

      {/* Dynamic Radar grid and sweep overlay - pointer-events-none allows map interaction */}
      {!tilesLoading && (
        <div className="absolute inset-0 z-20 pointer-events-none overflow-hidden select-none opacity-30">
          {/* Radar concentric circular grid lines centered */}
          <div 
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[320px] h-[320px] rounded-full border border-dashed opacity-25"
            style={{ borderColor: accentColor }}
          />
          <div 
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[180px] h-[180px] rounded-full border border-dashed opacity-15"
            style={{ borderColor: accentColor }}
          />
          <div 
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60px] h-[60px] rounded-full border border-dashed opacity-15"
            style={{ borderColor: accentColor }}
          />
          
          {/* Sweep arm rotating around the center of the map */}
          <div className="absolute top-1/2 left-1/2 w-[200px] h-[200px] -translate-x-1/2 -translate-y-1/2 origin-center animate-radar-sweep">
            <div 
              className="w-1/2 h-[1.5px] absolute top-1/2 left-1/2 origin-left opacity-60"
              style={{
                background: `linear-gradient(90deg, ${accentColor} 0%, transparent 100%)`,
                boxShadow: `0 0 6px ${accentColor}`
              }}
            />
            {/* Rotating trailing gradient cone */}
            <div 
              className="w-[100px] h-[100px] absolute top-1/2 left-1/2 origin-bottom-left -translate-y-full opacity-10"
              style={{
                background: `conic-gradient(from 180deg at 0% 100%, ${accentColor} 0%, transparent 45%)`,
                clipPath: 'polygon(0% 100%, 100% 100%, 100% 0%)'
              }}
            />
          </div>
        </div>
      )}

      {/* Subtle shimmer / pulse overlay while tiles are loading */}
      <div 
        className={`absolute inset-0 pointer-events-none z-20 flex items-center justify-center bg-[#0b0c12]/40 backdrop-blur-[1px] transition-opacity duration-500 ${
          tilesLoading ? 'opacity-100' : 'opacity-0'
        }`}
      >

        {tilesLoading && (
          <>
            {/* Animated Shimmer gradient slide */}
            <div className="absolute inset-0 overflow-hidden">
              <div 
                className="absolute inset-0 animate-map-shimmer opacity-[0.14]"
                style={{
                  background: `linear-gradient(90deg, transparent 0%, ${accentColor} 50%, transparent 100%)`,
                }}
              />
            </div>
            
            {/* Soft background pulse */}
            <div 
              className="absolute inset-0 animate-pulse bg-current opacity-[0.04]"
              style={{ color: accentColor }}
            />

            {/* Glowing Loading Badge */}
            <div className="absolute bottom-4 right-4 bg-[#090a10]/95 border border-[#25293a] backdrop-blur-md px-3 py-1.5 rounded-lg text-[10px] font-mono uppercase tracking-widest text-[#b7bdd5] flex items-center gap-2 shadow-[0_4px_20px_rgba(0,0,0,0.6)] select-none animate-fadeIn">
              <span className="w-2 h-2 rounded-full animate-ping" style={{ backgroundColor: accentColor }} />
              <span className="font-extrabold tracking-wider">Loading Map Tiles</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
