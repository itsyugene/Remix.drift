export interface Coordinates {
  lat: number;
  lng: number;
  accuracy?: number;
  altitude?: number | null;
  heading?: number | null;
  speed?: number | null;
}

export interface DriftPoint {
  id: string;
  coords: Coordinates;
  timestamp: number;
  driftDistance: number; // in meters from initial starting point
  deviceHeading: number; // orientation angle in degrees (0-360)
  note?: string;
  isCustomLogged?: boolean;
}

export interface DriftStats {
  currentDrift: number; // distance in meters from starting point
  maxDrift: number; // max distance from starting point in session
  averageDrift: number; // average distance from starting point
  totalDistance: number; // cumulative distance travelled along the trail
  pointCount: number;
}

export interface MapViewOptions {
  center: [number, number];
  zoom: number;
  followUser: boolean;
  isMapLocked: boolean;
  mapType: 'streets' | 'satellite' | 'dark';
}
