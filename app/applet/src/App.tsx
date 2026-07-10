import React, { useState, useEffect, useRef } from 'react';
import { Compass as CompassIcon, Navigation, RotateCcw, HelpCircle, GitCommit, Compass } from 'lucide-react';
import { MapComponent } from './components/MapContainer';
import { Compass as BigCompass } from './components/Compass';
import { Controls } from './components/Controls';
import { DriftLog } from './components/DriftLog';
import { Coordinates, DriftPoint, DriftStats } from './types';
import { calculateDistance, simulateDrift } from './utils';

// Starting reference position (San Francisco Golden Gate coordinates as default if GPS not authorized)
const DEFAULT_COORDS: Coordinates = {
  lat: 37.8199,
  lng: -122.4783,
  accuracy: 5,
  altitude: 45,
  speed: 0,
};

export default function App() {
  const [currentCoords, setCurrentCoords] = useState<Coordinates>(DEFAULT_COORDS);
  const [startCoords, setStartCoords] = useState<Coordinates | null>(null);
  const [trail, setTrail] = useState<DriftPoint[]>([]);
  const [deviceHeading, setDeviceHeading] = useState<number>(45); // Default orientation (NE)
  
  // States for toggles
  const [isTracking, setIsTracking] = useState<boolean>(true);
  const [followUser, setFollowUser] = useState<boolean>(true);
  const [isSimulating, setIsSimulating] = useState<boolean>(true); // Active by default for rich preview
  const [simulationRate, setSimulationRate] = useState<number>(2.5); // meters per second/step
  
  // Simulated rotation for preview environments
  const [isRotatingSim, setIsRotatingSim] = useState<boolean>(true);

  // Stats calculation state
  const [stats, setStats] = useState<DriftStats>({
    currentDrift: 0,
    maxDrift: 0,
    averageDrift: 0,
    totalDistance: 0,
    pointCount: 0,
  });

  const geoWatchIdRef = useRef<number | null>(null);
  const simulationIntervalRef = useRef<number | null>(null);

  // Initialize starting coordinate on first track or simulation
  useEffect(() => {
    if (!startCoords && currentCoords) {
      setStartCoords(currentCoords);
    }
  }, [currentCoords, startCoords]);

  // Track Device Orientation (Heading)
  useEffect(() => {
    const handleOrientation = (e: DeviceOrientationEvent) => {
      // webkitCompassHeading is standard on iOS Safari, alpha is normal on Android
      const heading = (e as any).webkitCompassHeading ?? (e.alpha !== null ? 360 - e.alpha : null);
      if (heading !== null) {
        setDeviceHeading(heading);
        setIsRotatingSim(false); // disable simulator once real sensor reports
      }
    };

    window.addEventListener('deviceorientation', handleOrientation);
    return () => {
      window.removeEventListener('deviceorientation', handleOrientation);
    };
  }, []);

  // Simulating heading change if no device sensor is present (so the preview looks active and animated!)
  useEffect(() => {
    if (!isRotatingSim) return;
    
    const interval = setInterval(() => {
      setDeviceHeading((prev) => (prev + 1.2) % 360);
    }, 150);

    return () => clearInterval(interval);
  }, [isRotatingSim]);

  // Real GPS Geolocation Watcher
  useEffect(() => {
    if (!isTracking || isSimulating) {
      if (geoWatchIdRef.current !== null) {
        navigator.geolocation.clearWatch(geoWatchIdRef.current);
        geoWatchIdRef.current = null;
      }
      return;
    }

    if ('geolocation' in navigator) {
      geoWatchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
          const coords: Coordinates = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
            altitude: position.coords.altitude,
            speed: position.coords.speed,
          };
          setCurrentCoords(coords);
          
          if (!startCoords) {
            setStartCoords(coords);
          }

          // Add to trail if tracking
          addTrailPoint(coords);
        },
        (error) => {
          console.error('GPS Geolocation Error:', error);
          // Gracefully fallback to simulation mode if real GPS is blocked or inside sandboxed iframe
          setIsSimulating(true);
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    }

    return () => {
      if (geoWatchIdRef.current !== null) {
        navigator.geolocation.clearWatch(geoWatchIdRef.current);
      }
    };
  }, [isTracking, isSimulating, startCoords]);

  // Simulated GPS Drift and Walking movement
  useEffect(() => {
    if (!isTracking || !isSimulating) {
      if (simulationIntervalRef.current !== null) {
        clearInterval(simulationIntervalRef.current);
        simulationIntervalRef.current = null;
      }
      return;
    }

    // Run interval to simulate continuous drift walks
    simulationIntervalRef.current = window.setInterval(() => {
      setCurrentCoords((prev) => {
        // Walk forward in heading direction with small random sensor noise/drift
        const headingWithNoise = (deviceHeading + (Math.random() * 20 - 10) + 360) % 360;
        const nextCoords = simulateDrift(prev, headingWithNoise, simulationRate);
        addTrailPoint(nextCoords);
        return nextCoords;
      });
    }, 1500);

    return () => {
      if (simulationIntervalRef.current !== null) {
        clearInterval(simulationIntervalRef.current);
      }
    };
  }, [isTracking, isSimulating, deviceHeading, simulationRate]);

  // Add coordinates to trail list and compute distance
  const addTrailPoint = (coords: Coordinates, customNote?: string, forceLog: boolean = false) => {
    setTrail((prevTrail) => {
      // Find initial coordinate to calculate reference drift
      const baseCoords = startCoords || coords;
      const driftDistance = calculateDistance(coords, baseCoords);

      const newPoint: DriftPoint = {
        id: Math.random().toString(36).substring(2, 9),
        coords,
        timestamp: Date.now(),
        driftDistance,
        deviceHeading: Math.round(deviceHeading),
        note: customNote,
        isCustomLogged: forceLog || !!customNote,
      };

      const updatedTrail = [...prevTrail, newPoint];

      // Re-calculate statistics based on new trail point
      const pointCount = updatedTrail.filter((p) => p.isCustomLogged).length;
      const drifts = updatedTrail.map((p) => p.driftDistance);
      const currentDrift = driftDistance;
      const maxDrift = drifts.length > 0 ? Math.max(...drifts) : 0;
      const averageDrift = drifts.length > 0 ? parseFloat((drifts.reduce((a, b) => a + b, 0) / drifts.length).toFixed(1)) : 0;

      // Calculate total path distance traversed
      let totalDistance = 0;
      for (let i = 1; i < updatedTrail.length; i++) {
        totalDistance += calculateDistance(updatedTrail[i - 1].coords, updatedTrail[i].coords);
      }

      setStats({
        currentDrift,
        maxDrift,
        averageDrift,
        totalDistance: parseFloat(totalDistance.toFixed(1)),
        pointCount,
      });

      return updatedTrail;
    });
  };

  // Toggle follow user / map locking mode with rotated compass button
  const handleToggleMapFollow = () => {
    setFollowUser((prev) => !prev);
    // Pause simulated rotation once user interacts with map follow mode
    setIsRotatingSim(false);
  };

  const handleResetSession = () => {
    setStartCoords(currentCoords);
    setTrail([]);
    setStats({
      currentDrift: 0,
      maxDrift: 0,
      averageDrift: 0,
      totalDistance: 0,
      pointCount: 0,
    });
  };

  const handleLogCustomPoint = (note: string) => {
    addTrailPoint(currentCoords, note, true);
  };

  const handleDeletePoint = (id: string) => {
    setTrail((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 text-slate-100 font-sans overflow-hidden">
      {/* Header Bar */}
      <header className="bg-slate-900/60 backdrop-blur-md border-b border-slate-800/80 px-6 py-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="bg-sky-500/10 p-2 rounded-xl border border-sky-500/20 text-sky-400">
            <CompassIcon className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-slate-100 flex items-center gap-1.5">
              RemixDrift
              <span className="text-[9px] bg-sky-500/20 text-sky-300 font-mono font-black px-1.5 py-0.5 rounded tracking-wide border border-sky-500/30">
                PRO_GPS_V2
              </span>
            </h1>
            <p className="text-[10px] text-slate-500 font-medium">Coordinate Accuracy & Location Deviation Utility</p>
          </div>
        </div>

        {/* Dynamic Map Lock Toggle Button with rotating compass icon */}
        <div className="flex items-center gap-3">
          <button
            id="toggle-map-button"
            onClick={handleToggleMapFollow}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold border transition-all shadow-sm ${
              followUser
                ? 'bg-sky-500/15 text-sky-400 border-sky-500/30 shadow-sky-950/20'
                : 'bg-slate-800 text-slate-400 border-slate-700/60'
            }`}
          >
            {/* The rotating compass icon, mirroring device heading */}
            <Navigation
              className="w-4 h-4 text-sky-400 transition-transform duration-200"
              style={{ transform: `rotate(${deviceHeading}deg)` }}
            />
            <span>{followUser ? 'Map Locking: Active' : 'Lock Map to Heading'}</span>
          </button>
        </div>
      </header>

      {/* Main Content Dashboard */}
      <main className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        {/* Left Control Column */}
        <section className="w-full md:w-[380px] p-4 md:p-6 flex flex-col gap-5 border-r border-slate-900 overflow-y-auto shrink-0 bg-slate-950 z-20">
          {/* Controls Panel */}
          <Controls
            stats={stats}
            isTracking={isTracking}
            onToggleTracking={() => setIsTracking((prev) => !prev)}
            isSimulating={isSimulating}
            onToggleSimulation={() => setIsSimulating((prev) => !prev)}
            simulationRate={simulationRate}
            onSimulationRateChange={setSimulationRate}
            onResetSession={handleResetSession}
            onLogCustomPoint={handleLogCustomPoint}
            currentCoords={currentCoords}
          />

          {/* Large Sensor Compass */}
          <BigCompass heading={deviceHeading} accuracy={currentCoords.accuracy ? Math.floor(currentCoords.accuracy / 2) : undefined} />

          {/* Logs Panel */}
          <DriftLog trail={trail} onDeletePoint={handleDeletePoint} />
        </section>

        {/* Map Stage Section */}
        <section className="flex-1 p-4 md:p-6 relative h-full flex flex-col bg-slate-950">
          <MapComponent
            currentCoords={currentCoords}
            startCoords={startCoords}
            trail={trail}
            followUser={followUser}
            deviceHeading={deviceHeading}
          />
        </section>
      </main>
    </div>
  );
}
